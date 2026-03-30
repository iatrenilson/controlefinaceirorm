import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  const supabaseUrl = env.VITE_SUPABASE_URL || "https://zcwgdkauggldqlrozcky.supabase.co";
  const supabasePublishableKey =
    env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    env.VITE_SUPABASE_ANON_KEY ||
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpjd2dka2F1Z2dsZHFscm96Y2t5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM5ODAwODAsImV4cCI6MjA4OTU1NjA4MH0.N0D-ZNhoBeL6yy4qb8Nfo3MxkuOh5nQQXZGQj6XfhOI";
  const supabaseProjectId = env.VITE_SUPABASE_PROJECT_ID || "zcwgdkauggldqlrozcky";

  return {
    base: "/",
    server: {
      host: "::",
      port: process.env.PORT ? Number(process.env.PORT) : 8080,
      hmr: {
        overlay: false,
      },
    },
    define: {
      "import.meta.env.VITE_SUPABASE_URL": JSON.stringify(supabaseUrl),
      "import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY": JSON.stringify(supabasePublishableKey),
      "import.meta.env.VITE_SUPABASE_PROJECT_ID": JSON.stringify(supabaseProjectId),
    },
    plugins: [react()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
      dedupe: ["react", "react-dom", "react/jsx-runtime"],
    },
  };
});
