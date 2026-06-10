import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Force dark mode on all pages consistently
document.documentElement.classList.add("dark");

createRoot(document.getElementById("root")!).render(<App />);
