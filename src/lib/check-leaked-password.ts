import { supabase } from "@/integrations/supabase/client";

export async function checkLeakedPassword(password: string): Promise<{ leaked: boolean; count: number }> {
  try {
    const { data, error } = await supabase.functions.invoke("check-password", {
      body: { password },
    });

    if (error) {
      console.error("Error checking password:", error);
      return { leaked: false, count: 0 }; // Don't block if service fails
    }

    return data as { leaked: boolean; count: number };
  } catch {
    return { leaked: false, count: 0 };
  }
}
