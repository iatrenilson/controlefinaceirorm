import { useEffect, type RefObject } from "react";

// PDF aberto num quadro (iframe) dentro de uma janela do site: clicando no PDF, o teclado passa para o quadro e o Esc
// não chega mais à janela para fechá-la. Assim que o foco entra no quadro, ele volta para a janela (que precisa de
// tabIndex); rolar e clicar nos botões do PDF continuam funcionando com o mouse.
export function useEscComPdf(janela: RefObject<HTMLElement>) {
  useEffect(() => {
    const aoPerderFoco = () => setTimeout(() => {
      const ativo = document.activeElement;
      if (ativo instanceof HTMLIFrameElement && janela.current?.contains(ativo)) janela.current.focus({ preventScroll: true });
    }, 0);
    window.addEventListener("blur", aoPerderFoco);
    return () => window.removeEventListener("blur", aoPerderFoco);
  }, [janela]);
}
