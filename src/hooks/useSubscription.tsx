import { useAppContext } from "@/hooks/useAppContext";

export const useSubscription = () => {
  const { loading, hasAccess, isTrialActive, isTrialExpired, hoursLeft, subscriptionExpiresAt, trialStartedAt, planName } = useAppContext();
  return { loading, hasAccess, isTrialActive, isTrialExpired, hoursLeft, subscriptionExpiresAt, trialStartedAt, planName };
};
