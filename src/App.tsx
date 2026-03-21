import { ThemeProvider } from "@/components/theme-provider";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import { AuthProvider } from "@lovable.dev/cloud-auth-js";
import ProtectedRoute from "./components/ProtectedRoute";
import Login from "./pages/Login";
import FinanceControl from "./pages/FinanceControl";

function App() {
  return (
    <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
      <AuthProvider backendUrl={import.meta.env.VITE_BACKEND_URL}>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/financeiro"
              element={
                <ProtectedRoute>
                  <FinanceControl />
                </ProtectedRoute>
              }
            />
            <Route path="*" element={<Login />} /> {/* Fallback to login */}
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
