import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";

const TRIAL_HOURS = 24;

interface AppContextValue {
  user: User | null;
  loading: boolean;
  isAdmin: boolean;
  isModerator: boolean;
  isRestricted: boolean;
  hasAccess: boolean;
  isTrialActive: boolean;
  isTrialExpired: boolean;
  hoursLeft: number;
  trialStartedAt: string | null;
  subscriptionExpiresAt: string | null;
  planName: string | null;
  signOut: () => Promise<void>;
}

const AppContext = createContext<AppContextValue | null>(null);

export const AppProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [isAdmin, setIsAdmin] = useState(false);
  const [isModerator, setIsModerator] = useState(false);
  const [isRestricted, setIsRestricted] = useState(false);
  const [trialStartedAt, setTrialStartedAt] = useState<string | null>(null);
  const [subscriptionExpiresAt, setSubscriptionExpiresAt] = useState<string | null>(null);
  const [planName, setPlanName] = useState<string | null>(null);
  const [dataLoading, setDataLoading] = useState(false);

  // Auth listener
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setAuthLoading(false);
    });
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error?.message?.includes("Refresh Token Not Found")) {
        supabase.auth.signOut();
        setUser(null);
      } else {
        setUser(session?.user ?? null);
      }
      setAuthLoading(false);
    });
    return () => subscription.unsubscribe();
  }, []);

  // Fetch role + subscription in parallel once user is known
  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setIsAdmin(false);
      setIsModerator(false);
      setIsRestricted(false);
      setTrialStartedAt(null);
      setSubscriptionExpiresAt(null);
      setPlanName(null);
      setDataLoading(false);
      return;
    }

    setDataLoading(true);

    Promise.all([
      supabase.from("user_roles").select("role").eq("user_id", user.id),
      supabase.from("subscriptions")
        .select("trial_started_at, subscription_expires_at, plan_name")
        .eq("user_id", user.id)
        .maybeSingle(),
    ]).then(async ([rolesResult, subResult]) => {
      // Roles
      if (!rolesResult.error && rolesResult.data) {
        setIsAdmin(rolesResult.data.some((r) => r.role === "admin"));
        setIsModerator(rolesResult.data.some((r) => r.role === "moderator"));
        setIsRestricted(rolesResult.data.some((r) => r.role === ("restrito" as any)));
      }

      // Subscription
      if (subResult.error || !subResult.data) {
        // Create fallback record
        const { data: newSub } = await supabase
          .from("subscriptions")
          .insert({ user_id: user.id, trial_started_at: new Date().toISOString() })
          .select("trial_started_at, subscription_expires_at, plan_name")
          .single();
        if (newSub) {
          setTrialStartedAt(newSub.trial_started_at);
          setSubscriptionExpiresAt(newSub.subscription_expires_at);
          setPlanName(newSub.plan_name);
        }
      } else {
        setTrialStartedAt(subResult.data.trial_started_at);
        setSubscriptionExpiresAt(subResult.data.subscription_expires_at);
        setPlanName(subResult.data.plan_name);
      }

      setDataLoading(false);
    });
  }, [user, authLoading]);

  const loading = authLoading || dataLoading;

  // Compute access flags
  const now = new Date();
  let hasAccess = false;
  let isTrialActive = false;
  let isTrialExpired = false;
  let hoursLeft = 0;

  if (!loading) {
    if (isAdmin || isModerator) {
      hasAccess = true;
    } else if (subscriptionExpiresAt && new Date(subscriptionExpiresAt) > now) {
      hasAccess = true;
    } else if (trialStartedAt) {
      const trialEnd = new Date(new Date(trialStartedAt).getTime() + TRIAL_HOURS * 60 * 60 * 1000);
      const msLeft = trialEnd.getTime() - now.getTime();
      hoursLeft = Math.max(0, msLeft / (1000 * 60 * 60));
      if (msLeft > 0) {
        hasAccess = true;
        isTrialActive = true;
      } else {
        isTrialExpired = true;
      }
    } else {
      isTrialExpired = true;
    }
  }

  const signOut = async () => { await supabase.auth.signOut(); };

  return (
    <AppContext.Provider value={{
      user, loading,
      isAdmin, isModerator, isRestricted,
      hasAccess, isTrialActive, isTrialExpired, hoursLeft,
      trialStartedAt, subscriptionExpiresAt, planName,
      signOut,
    }}>
      {children}
    </AppContext.Provider>
  );
};

export const useAppContext = () => {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useAppContext must be used within AppProvider");
  return ctx;
};
