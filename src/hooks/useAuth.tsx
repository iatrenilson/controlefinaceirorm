import { useAppContext } from "@/hooks/useAppContext";

export const useAuth = () => {
  const { user, loading, signOut } = useAppContext();
  return { user, loading, signOut };
};
