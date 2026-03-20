// Stub local para substituir @lovable.dev/cloud-auth-js
// Usa Supabase diretamente para OAuth
import { supabase } from "../supabase/client";

type SignInOptions = {
  redirect_uri?: string;
  extraParams?: Record<string, string>;
};

export const lovable = {
  auth: {
    signInWithOAuth: async (provider: "google" | "apple", opts?: SignInOptions) => {
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: opts?.redirect_uri || window.location.origin,
        },
      });
      if (error) return { error };
      return { redirected: true };
    },
  },
};
