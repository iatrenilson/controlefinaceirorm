import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export const useUserRole = () => {
  const { user, loading: authLoading } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [isModerator, setIsModerator] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) {
      setLoading(true);
      return;
    }

    if (!user) {
      setIsAdmin(false);
      setIsModerator(false);
      setLoading(false);
      return;
    }

    const fetchRole = async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);

      if (!error && data) {
        setIsAdmin(data.some((r) => r.role === "admin"));
        setIsModerator(data.some((r) => r.role === "moderator"));
      } else {
        setIsAdmin(false);
        setIsModerator(false);
      }
      setLoading(false);
    };

    fetchRole();
  }, [user, authLoading]);

  return { isAdmin, isModerator, loading };
};
