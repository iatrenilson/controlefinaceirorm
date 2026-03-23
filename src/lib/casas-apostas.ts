export interface CasaAposta {
  nome: string;
  logo: string;
}

export const CASAS_APOSTAS: CasaAposta[] = [
  { nome: "Bet365", logo: "https://www.google.com/s2/favicons?domain=bet365.com&sz=32" },
  { nome: "Betano", logo: "https://www.google.com/s2/favicons?domain=betano.com&sz=32" },

  { nome: "Sportingbet", logo: "https://www.google.com/s2/favicons?domain=sportingbet.com&sz=32" },
  { nome: "Betfair", logo: "https://www.google.com/s2/favicons?domain=betfair.com&sz=32" },
  { nome: "KTO", logo: "https://www.google.com/s2/favicons?domain=kto.com&sz=32" },
  { nome: "Pixbet", logo: "https://www.google.com/s2/favicons?domain=pixbet.com&sz=32" },
  { nome: "Novibet", logo: "https://www.google.com/s2/favicons?domain=novibet.com&sz=32" },
  { nome: "1xBet", logo: "https://www.google.com/s2/favicons?domain=1xbet.com&sz=32" },
  { nome: "Pinnacle", logo: "https://www.google.com/s2/favicons?domain=pinnacle.com&sz=32" },
  { nome: "Betsul", logo: "https://www.google.com/s2/favicons?domain=betsul.com&sz=32" },
  { nome: "Rivalo", logo: "https://www.google.com/s2/favicons?domain=rivalo.com&sz=32" },
  { nome: "Parimatch", logo: "https://www.google.com/s2/favicons?domain=parimatch.com&sz=32" },
  { nome: "Stake", logo: "https://www.google.com/s2/favicons?domain=stake.com&sz=32" },
  { nome: "Superbet", logo: "https://www.google.com/s2/favicons?domain=superbet.com&sz=32" },
  { nome: "Betsson", logo: "https://www.google.com/s2/favicons?domain=betsson.com&sz=32" },
  { nome: "F12.Bet", logo: "https://www.google.com/s2/favicons?domain=f12.bet&sz=32" },
  { nome: "Estrela Bet", logo: "https://www.google.com/s2/favicons?domain=estrelabet.com&sz=32" },
  { nome: "Galera Bet", logo: "https://www.google.com/s2/favicons?domain=galerabet.com&sz=32" },
  { nome: "Mr. Jack Bet", logo: "https://www.google.com/s2/favicons?domain=mrjack.bet&sz=32" },
  { nome: "Vai de Bet", logo: "https://www.google.com/s2/favicons?domain=vaidebet.com&sz=32" },
  { nome: "Cassino Pix", logo: "https://www.google.com/s2/favicons?domain=cassinopix.com&sz=32" },
  { nome: "BR4Bet", logo: "https://www.google.com/s2/favicons?domain=br4bet.com&sz=32" },
  { nome: "Luva Bet", logo: "https://www.google.com/s2/favicons?domain=luvabet.com&sz=32" },
  { nome: "Seguro Bet", logo: "https://www.google.com/s2/favicons?domain=segurobet.com&sz=32" },
  { nome: "Reals Bet", logo: "https://www.google.com/s2/favicons?domain=realsbet.com&sz=32" },
  { nome: "Outro", logo: "" },
];

export const getCasaLogo = (nome: string): string => {
  const casa = CASAS_APOSTAS.find(c => c.nome === nome);
  return casa?.logo || "";
};
