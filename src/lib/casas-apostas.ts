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
  { nome: "Superbet", logo: "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAzMiAzMiI+PHJlY3Qgd2lkdGg9IjMyIiBoZWlnaHQ9IjMyIiByeD0iNSIgZmlsbD0iI2UzMDUxMiIvPjx0ZXh0IHg9IjE2IiB5PSIyMyIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZm9udC1mYW1pbHk9IkFyaWFsIEJsYWNrLHNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMjAiIGZvbnQtd2VpZ2h0PSI5MDAiIGZpbGw9IndoaXRlIj5TPC90ZXh0Pjwvc3ZnPg==" },
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
  { nome: "Betboo", logo: "https://www.google.com/s2/favicons?domain=betboo.com&sz=32" },
  { nome: "BetMGM", logo: "https://www.google.com/s2/favicons?domain=betmgm.com&sz=32" },
  { nome: "7Games", logo: "https://www.google.com/s2/favicons?domain=7games.bet&sz=32" },
  { nome: "Betão", logo: "https://www.google.com/s2/favicons?domain=betao.com&sz=32" },
  { nome: "R7.bet", logo: "https://www.google.com/s2/favicons?domain=r7.bet&sz=32" },
  { nome: "Outro", logo: "" },
];

export const getCasaLogo = (nome: string): string => {
  const casa = CASAS_APOSTAS.find(c => c.nome === nome);
  return casa?.logo || "";
};
