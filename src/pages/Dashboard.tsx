import { Navigate } from "react-router-dom";

// Dashboard is now handled by Index.tsx
export default function Dashboard() {
  return <Navigate to="/" replace />;
}
