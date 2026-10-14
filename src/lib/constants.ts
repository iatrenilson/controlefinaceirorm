// Número WhatsApp para aquisição de plano (formato internacional sem '+')
export const WHATSAPP_NUMBER = "5592993161828";

export const WHATSAPP_LINK = `https://wa.me/${WHATSAPP_NUMBER}?text=Ol%C3%A1%2C%20quero%20adquirir%20um%20plano%20no%20RW%20Investimentos!`;

// Monta link do WhatsApp com texto. No PC abre o WhatsApp Web direto (sem redirecionamento),
// pois o redirect de wa.me/api.whatsapp.com corrompe emojis no WhatsApp Web.
export function whatsappUrl(phone: string, text: string) {
  const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
  const base = isMobile ? "https://api.whatsapp.com/send" : "https://web.whatsapp.com/send";
  return `${base}?phone=${phone}&text=${encodeURIComponent(text)}`;
}
