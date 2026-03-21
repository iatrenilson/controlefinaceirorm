import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Aplica dark mode antes de renderizar para evitar flash branco
const savedTheme = localStorage.getItem("theme");
if (savedTheme !== "light") {
  document.documentElement.classList.add("dark");
  if (!savedTheme) localStorage.setItem("theme", "dark");
}

createRoot(document.getElementById("root")!).render(<App />);
