import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { protegerContraArquivoSolto } from "./components/ArrastarArquivo";

// Force dark mode on all pages consistently
document.documentElement.classList.add("dark");

protegerContraArquivoSolto();

createRoot(document.getElementById("root")!).render(<App />);
