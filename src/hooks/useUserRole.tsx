import { useAppContext } from "@/hooks/useAppContext";

export const useUserRole = () => {
  const { isAdmin, isModerator, isRestricted, loading } = useAppContext();
  return { isAdmin, isModerator, isRestricted, loading };
};
