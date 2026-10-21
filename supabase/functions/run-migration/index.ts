import { Pool } from "https://deno.land/x/postgres@v0.17.0/mod.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const forbidden = () =>
  new Response(JSON.stringify({ error: "Acesso negado" }), {
    status: 403,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    // Admins only: the site's public anon key also passes the default JWT check,
    // so look up who the token belongs to
    const token = (req.headers.get("Authorization") ?? "").replace("Bearer ", "");
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );
    const { data: { user } } = await supabaseClient.auth.getUser(token);
    if (!user) return forbidden();

    const body = await req.json().catch(() => ({}));
    const customSql: string | null = body.sql ?? null;

    const pool = new Pool(Deno.env.get("SUPABASE_DB_URL")!, 1, true);
    const conn = await pool.connect();

    try {
      // Check user_roles directly rather than has_role: the live database has two has_role overloads
      const { rows: adminRows } = await conn.queryArray(
        "SELECT 1 FROM public.user_roles WHERE user_id = $1 AND role = 'admin'",
        [user.id]
      );
      if (!adminRows.length) return forbidden();

      // If custom SQL provided, execute it and return
      if (customSql) {
        const result = await conn.queryArray(customSql);
        return new Response(JSON.stringify({ ok: true, rows: result.rows }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      await conn.queryArray(`
        CREATE TABLE IF NOT EXISTS public.subscriptions (
          id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
          user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
          trial_started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          subscription_expires_at TIMESTAMPTZ,
          plan_name TEXT DEFAULT 'trial',
          created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          UNIQUE(user_id)
        )
      `);

      await conn.queryArray(`ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY`);

      await conn.queryArray(`
        DO $$ BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM pg_policies WHERE tablename='subscriptions' AND policyname='Users can view own subscription'
          ) THEN
            CREATE POLICY "Users can view own subscription"
              ON public.subscriptions FOR SELECT TO authenticated
              USING (auth.uid() = user_id);
          END IF;
        END $$
      `);

      await conn.queryArray(`
        DO $$ BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM pg_policies WHERE tablename='subscriptions' AND policyname='Admins can manage subscriptions'
          ) THEN
            CREATE POLICY "Admins can manage subscriptions"
              ON public.subscriptions FOR ALL TO authenticated
              USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'))
              WITH CHECK (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'));
          END IF;
        END $$
      `);

      await conn.queryArray(`
        CREATE OR REPLACE FUNCTION public.handle_new_user_subscription()
        RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
        BEGIN
          INSERT INTO public.subscriptions (user_id, trial_started_at)
          VALUES (NEW.id, NOW())
          ON CONFLICT (user_id) DO NOTHING;
          RETURN NEW;
        END;
        $$
      `);

      await conn.queryArray(`DROP TRIGGER IF EXISTS on_auth_user_created_subscription ON auth.users`);
      await conn.queryArray(`
        CREATE TRIGGER on_auth_user_created_subscription
          AFTER INSERT ON auth.users
          FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user_subscription()
      `);

      await conn.queryArray(`
        INSERT INTO public.subscriptions (user_id, trial_started_at)
        SELECT id, COALESCE(created_at, NOW()) FROM auth.users
        WHERE id NOT IN (SELECT user_id FROM public.subscriptions)
        ON CONFLICT (user_id) DO NOTHING
      `);

      return new Response(JSON.stringify({ ok: true, message: "Migration applied successfully" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } finally {
      conn.release();
      await pool.end();
    }
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
