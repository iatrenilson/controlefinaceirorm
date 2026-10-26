// Lê CNH ou RG (PDF ou foto) com OCR no próprio navegador e devolve os campos do cadastro.
// O documento não sai do computador: só o motor de OCR e o idioma português são baixados da CDN.

const PDFJS = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
const PDFJS_WORKER = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
const PDFLIB = "https://cdnjs.cloudflare.com/ajax/libs/pdf-lib/1.17.1/pdf-lib.min.js";
const TESSERACT = "https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js";

export interface DadosDocumento {
  nome?: string; cpf?: string; rg?: string; rgEhCpf?: boolean; orgaoEmissor?: string; dataExpedicao?: string;
  dataNascimento?: string; localNascimento?: string; ufNascimento?: string;
  nomePai?: string; nomeMae?: string; estadoCivil?: string; filiacaoUnica?: boolean; cnh?: boolean; cnhAntiga?: boolean;
  ufOrgao?: string; siglaOrgao?: string; nomeOrgao?: string; temOrgaoExpedidor?: boolean;
}

const scripts: Record<string, Promise<any>> = {};
function carregarScript(src: string, global: string): Promise<any> {
  const w = window as any;
  if (w[global]) return Promise.resolve(w[global]);
  scripts[src] ??= new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = src;
    s.crossOrigin = "anonymous";
    s.onload = () => (w[global] ? resolve(w[global]) : reject(new Error(`${global} não carregou`)));
    s.onerror = () => { delete scripts[src]; reject(new Error(`${global} não carregou`)); };
    document.head.appendChild(s);
  });
  return scripts[src];
}

// ─── Leitura dos campos a partir do texto do OCR ────────────────────────────

const UF = "AC|AL|AP|AM|BA|CE|DF|ES|GO|MA|MT|MS|MG|PA|PB|PR|PE|PI|RJ|RN|RS|RO|RR|SC|SP|SE|TO";
const CONECTORES = new Set(["DA", "DE", "DO", "DAS", "DOS", "E"]);
// Rótulos e textos impressos que não são nome de pessoa ("PERMISSÃO ACC CAT HAB" saía como pai na CNH antiga; "NÃO CONSTA"
// é o pai que não existe; "MAIOR DE 65 ANOS" vem no RG antigo)
const NAO_E_NOME = /\b(REP[ÚU]BLICA|FEDERATIVA|MINIST[ÉE]RIO|CARTEIRA|NACIONAL|HABILITA|ASSINATURA|ASSINAD[OA]|DIGITALMENTE|PORTADOR|INSTITUTO|IDENTIFICA|IDENTIDADE|[ÓO]RG[ÃA]O|EXPEDIDOR|EMISSOR|V[ÁA]LIDA|TERRIT[ÓO]RIO|DEPARTAMENTO|TR[ÂA]NSITO|SECRETARIA|GOVERNO|BRASILEIR[OA]|NACIONALIDADE|NATURALIDADE|FILIA[ÇC][ÃA]O|SOBRENOME|REGISTRO|CATEGORIA|VALIDADE|OBSERVA|DOCUMENTO|CERTID[ÃA]O|CART[ÓO]RIO|SERPRO|DETRAN|DENATRAN|CONTRAN|SENATRAN|ESTADO|PERMISS[ÃA]O|ACC|CAT|HAB|N[ÃA]O\s+CONSTA|MAIOR|VIA)\b/;

export function cpfValido(d: string): boolean {
  if (!/^\d{11}$/.test(d) || /^(\d)\1{10}$/.test(d)) return false;
  for (const n of [9, 10]) {
    let s = 0;
    for (let i = 0; i < n; i++) s += Number(d[i]) * (n + 1 - i);
    if ((s * 10) % 11 % 10 !== Number(d[n])) return false;
  }
  return true;
}

function data(s: string): string | undefined {
  const m = s.match(/(\d{2})\s?[/.\-]\s?(\d{2})\s?[/.\-]\s?(\d{4})/);
  if (!m) return;
  const [, d, mo, y] = m;
  if (+mo < 1 || +mo > 12 || +d < 1 || +d > 31 || +y < 1900 || +y > 2100) return;
  return `${y}-${mo}-${d}`;
}

// Todas as datas da linha, tolerando uma barra perdida pelo OCR ("1107/2022"); usar só em linhas de data
function datasTolerantes(s: string): string[] {
  const out: string[] = [];
  for (const m of s.matchAll(/(?<!\d)(\d{2})\s?[/.\-]?\s?(\d{2})\s?[/.\-]?\s?(\d{4})(?!\d)/g)) {
    const d = data(`${m[1]}/${m[2]}/${m[3]}`);
    if (d) out.push(d);
  }
  return out;
}

// Maior sequência de palavras em MAIÚSCULAS da linha (o OCR deixa letras soltas e lixo nas pontas).
// O OCR às vezes lê uma maiúscula como minúscula ("RuBEM" na CNH do Rubem fez o nome sair sem o primeiro nome):
// palavra com poucas minúsculas (uma; duas com 7 letras ou mais) conta como maiúscula se começa em maiúscula ou tem
// 4 maiúsculas ou mais ("orLEILSON"); começando e terminando em maiúscula, até metade minúscula ("JosE"); e os
// conectores (de, da, dos...) valem em qualquer caixa no meio do nome.
// Rótulos como "Nome" e "Data" continuam fora, e palavra sem vogal ("ZFPS CD", lixo da foto) quebra a sequência.
// comFim: mantém o conector ou a letra solta do fim ("…OLIVEIRA DO N"), que é onde cola a continuação da linha de baixo
const VOGAL = /[AEIOUYÀ-ÆÈ-ÏÒ-ÖÙ-Ý]/;
function nomeDe(linha: string, comFim = false): string | undefined {
  const tokens = linha.replace(/[^A-Za-zÀ-ÖØ-öø-ÿ'\s]/g, " ").split(/\s+/).filter(Boolean);
  let melhor: string[] = [], atual: string[] = [];
  // letra solta só vale no meio do nome ("REGINA APARECIDA DOS R FERRAZ", sobrenome abreviado no documento)
  const fechar = () => {
    while (!comFim && atual.length && (CONECTORES.has(atual[atual.length - 1]) || atual[atual.length - 1].length === 1)) atual.pop();
    if (atual.length > melhor.length) melhor = atual;
    atual = [];
  };
  const conta = (t: string, re: RegExp) => (t.match(re) || []).length;
  for (const t of tokens) {
    const T = t.toUpperCase();
    const conector = CONECTORES.has(T);
    const minus = conta(t, /[a-zß-ÿ]/g), maius = conta(t, /[A-ZÀ-Ý]/g);
    const maiuscula = maius > 0 && (minus === 0 || (conector && atual.length > 0)
      || (t.length >= 3 && minus <= (t.length >= 7 ? 2 : 1) && (/^[A-ZÀ-Ý]/.test(t) || maius >= 4))
      || (t.length >= 4 && /^[A-ZÀ-Ý].*[A-ZÀ-Ý]$/.test(t) && minus * 2 <= t.length));
    const aceita = atual.length ? (VOGAL.test(T) || T.length === 1) : T.length >= 3 && !conector && VOGAL.test(T);
    if (maiuscula && aceita) atual.push(T); else fechar();
  }
  fechar();
  const nome = melhor.join(" ");
  if (melhor.filter(t => !CONECTORES.has(t)).length < 2 || nome.length < 6 || nome.length > 70 || NAO_E_NOME.test(nome)) return;
  return nome;
}

// "MANACAPURU, AM", "COARI-AM", "MANAUS/AM"; cidade com hífen no nome também ("JI-PARANA, RO" saía "PARANA")
function cidadeUf(s: string): { cidade: string; uf: string } | undefined {
  const m = s.match(new RegExp(`([A-ZÀ-Ý][A-ZÀ-Ý' ]*(?:-[A-ZÀ-Ý][A-ZÀ-Ý' ]*?)?)\\s*[,/\\-]\\s*(${UF})\\b`));
  if (!m) return;
  const cidade = m[1].trim().split(" ").filter((t, i, a) => !(i === 0 && t.length <= 2 && a.length > 1)).join(" ");
  return cidade.length >= 3 ? { cidade, uf: m[2] } : undefined;
}

const ehFeminino = (nome: string) => {
  const p = nome.split(" ")[0];
  return /A$/.test(p) || /(ANE|ENE|INE|ETE|ICE|UTH|ETH)$/.test(p);
};

function filiacao(r: DadosDocumento, nomes: string[]) {
  if (!nomes.length || r.nomePai || r.nomeMae) return;
  if (nomes.length === 1) { if (ehFeminino(nomes[0])) r.nomeMae = nomes[0]; else r.nomePai = nomes[0]; return; }
  const [a, b] = nomes;
  if (ehFeminino(a) && !ehFeminino(b)) { r.nomeMae = a; r.nomePai = b; } else { r.nomePai = a; r.nomeMae = b; }
}

// Estado emissor do RG/CIN pelo cabeçalho ("ESTADO DE AMAZONAS"); nomes compostos primeiro
const UF_POR_ESTADO: [string, string][] = [
  ["MATO GROSSO DO SUL", "MS"], ["RIO GRANDE DO NORTE", "RN"], ["RIO GRANDE DO SUL", "RS"], ["DISTRITO FEDERAL", "DF"],
  ["ESPIRITO SANTO", "ES"], ["MINAS GERAIS", "MG"], ["RIO DE JANEIRO", "RJ"], ["SANTA CATARINA", "SC"], ["SAO PAULO", "SP"],
  ["MATO GROSSO", "MT"], ["ACRE", "AC"], ["ALAGOAS", "AL"], ["AMAPA", "AP"], ["AMAZONAS", "AM"], ["BAHIA", "BA"],
  ["CEARA", "CE"], ["GOIAS", "GO"], ["MARANHAO", "MA"], ["PARAIBA", "PB"], ["PARANA", "PR"], ["PARA", "PA"],
  ["PERNAMBUCO", "PE"], ["PIAUI", "PI"], ["RONDONIA", "RO"], ["RORAIMA", "RR"], ["SERGIPE", "SE"], ["TOCANTINS", "TO"],
];
const RE_ESTADO = new RegExp(`\\bESTADO\\s+D[EOA]S?\\s+(${UF_POR_ESTADO.map(([n]) => n).join("|")})\\b`);
// Sigla do órgão pelo nome impresso no RG
const SIGLA_POR_NOME: [RegExp, string][] = [
  [/SEGURANCA\s+PUBLICA/, "SSP"], [/POLICIA\s+CIVIL/, "PC"], [/DEFESA\s+SOCIAL/, "SDS"],
  [/FELIX\s+PACHECO/, "IFP"], [/INSTITUTO\s+GERAL\s+DE\s+PERICIAS/, "IGP"], [/DETRAN|DEPARTAMENTO\s+(?:ESTADUAL\s+)?DE\s+TRANSITO/, "DETRAN"],
];
const SIGLAS = "SSP|SESP|SEJUSP|SSPDS|SDS|SESDC|SSPC|PC|DETRAN|DPF|SPTC|IFP|IGP|ITEP|DGPC|POLITEC|SEGUP|SJS|SECC|PCAM|MD";

const ESTADO_CIVIL: [RegExp, string][] = [
  [/SOLTEIR/i, "Solteiro(a)"], [/CASAD/i, "Casado(a)"], [/DIVORCIAD/i, "Divorciado(a)"],
  [/VI[UÚ]V/i, "Viúvo(a)"], [/UNI[ÃA]O\s+EST/i, "União Estável"],
];

// Linha que começa com rótulo de outro campo (o valor procurado não está nela)
const RE_LINHA_ROTULO = /^(DOC\b|DOC\.|CPF\b|REGISTRO|NOME\b|FILIA[ÇCG][ÃA]O|DATA\b|R\.?\s?G\b|ASSINATURA|OBSERVA|CERT)/i;

// Pedaço de nome quebrado na linha de baixo ("MED" de "AH"/"MED"): só palavras em maiúsculas curtas, nada mais na linha
function pedacoDe(linha: string): string[] | undefined {
  const tokens = linha.replace(/[^A-Za-zÀ-ÖØ-öø-ÿ'\s]/g, " ").split(/\s+/).filter(Boolean);
  const maius = tokens.filter(t => t === t.toUpperCase() && /[A-ZÀ-Ý]/.test(t) && !(t.length === 1 && !VOGAL.test(t)));
  if (!maius.length || maius.length > 3 || tokens.some(t => !maius.includes(t) && t.length >= 3)) return;
  return maius;
}

// Nome da filiação que continua na linha de baixo. Na CNH antiga a linha corta no meio da palavra, com 27 letras
// ("FRANCISCO SOARES ANTONIO AH" + "MED" = AHMED): pedaço curto gruda na última palavra; palavra inteira entra com espaço
function colarQuebra(nome: string, pedaco: string[]): string {
  const ult = nome.split(" ").pop()!;
  const [p, ...resto] = pedaco;
  const grudar = !CONECTORES.has(ult) && (ult.length <= 3 || p.length <= 3);
  return [nome + (grudar ? "" : " ") + p, ...resto].join(" ");
}

export function extrairCampos(texto: string): DadosDocumento {
  // "1" no fim ou no meio de um número lido como "]", "l" ou "I" ("1927547] SSP AM" é o RG 19275471)
  const L = texto.split(/\n/).map(l => l.replace(/(?<=\d)[\]lI](?=\d|\s|$)|(?<=\d)\|(?=\d)/g, "1")
    .replace(/[|[\]{}“”"]/g, " ").replace(/\s+/g, " ").trim()).filter(Boolean);
  const r: DadosDocumento = {};
  const ehCNH = /HABILITA|SOBRENOME|DOC\.?\s*IDENTIDADE|SENATRAN|RENACH/i.test(texto);
  // CNH modelo antigo (até 2022): "NOME" sem "SOBRENOME", letra de máquina com a filiação quebrando em 27 letras
  const cnhAntiga = ehCNH && !/SOBRENOME/i.test(texto) && /PERMISS[ÃA]O|DATA\s+NASCIMENTO/i.test(texto);
  if (ehCNH) r.cnh = true;
  if (cnhAntiga) r.cnhAntiga = true;
  const depois = (i: number, n: number) => L.slice(i + 1, i + 1 + n);
  const hoje = new Date().toISOString().slice(0, 10);

  // CPF formatado em qualquer lugar ("932.695.952-04", "273.380.102 34" com o hífen perdido no OCR, ou "135681592-87" do
  // RG antigo); sem pontuação nenhuma só perto do rótulo "CPF" (outros números têm 11 dígitos, ex. registro da CNH)
  for (const m of texto.matchAll(/(?<!\d)(?:\d{3}\s?\.\s?\d{3}\s?\.\s?\d{3}\s?[-–.]?\s?|\d{9}\s?[-–]\s?)\d{2}(?!\d)/g)) {
    const d = m[0].replace(/\D/g, "");
    if (cpfValido(d)) { r.cpf = d; break; }
  }
  for (let i = 0; i < L.length && !r.cpf; i++) {
    if (!/\bCPF\b/i.test(L[i])) continue;
    for (const c of [L[i], ...depois(i, 2)]) {
      const d = c.match(/(?<!\d)\d{11}(?!\d)/)?.[0];
      if (d && cpfValido(d)) { r.cpf = d; break; }
    }
  }

  for (let i = 0; i < L.length; i++) {
    const l = L[i];

    // "NOME E SOBRENOME" (CNH), "Nome / Name" (CIN), "NOME:" ou "NOME FULANO DE TAL" (RG antigo, rótulo ao lado)
    if (!r.nome && /NOME\s+E\s+SOBRENOME|^NOME\s*\/\s*NAME\b|^NOME\s*:?$|^NOME\s*:|^NOME\s+(?!D[AOE]\s|SOCIAL)[A-ZÀ-Ý]{2,}\s+[A-ZÀ-Ý]{2,}/i.test(l)) {
      const resto = l.replace(/.*?(NOME\s+E\s+SOBRENOME|NOME\s*\/\s*NAME|NOME)\s*:?/i, "");
      for (const c of [resto, ...depois(i, 2)]) { const n = nomeDe(c); if (n) { r.nome = n; break; } }
    }

    // CNH: "3 DATA, LOCAL E UF DE NASCIMENTO" -> "16/02/1996, MANAUS, AM". Vale mais que a regra geral abaixo
    if (/LOCAL\s+E\s+UF\s+DE\s+NASC|DATA,?\s*LOCAL/i.test(l)) {
      for (const c of depois(i, 2)) {
        const d = data(c);
        if (!d) continue;
        r.dataNascimento = d;
        const cu = cidadeUf(c.slice(c.search(/\d{4}/) + 4));
        if (cu) { r.localNascimento = cu.cidade; r.ufNascimento = cu.uf; }
        break;
      }
    }
    // "DATA DE NASCIMENTO", "DT. NASC.", "Nascimento:"; a palavra NASCIMENTO sozinha no meio da linha é sobrenome
    // ("LEANDRO DO NASCIMENTO OLIVEIRA" fazia a 1ª habilitação virar nascimento). No RG antigo a data fica em cima do rótulo
    if (!r.dataNascimento && /\bDATA\s*(?:DE\s*)?NASC|DATE\s+OF\s+BIRTH|\bDT\.?\s*(?:DE\s*)?NASC|^NASCIMENTO\b|\bNASC(?:IMENTO)?\s*[:.]/i.test(l)) {
      for (const c of [l, ...depois(i, 2), L[i - 1] ?? ""]) { const d = data(c); if (d && d < hoje) { r.dataNascimento = d; break; } }
    }
    // Naturalidade embaixo do rótulo (CIN), ao lado ou em cima dele (RG do Amazonas: "COARI-AM 20/08/1955" / "NATURALIDADE")
    if (!r.localNascimento && /NATURA[LT]IDADE|PLACE OF BIRTH|NATURAL DE/i.test(l)) {
      const resto = l.replace(/.*?(NATURA[LT]IDADE|PLACE OF BIRTH|NATURAL DE)\s*:?/i, "");
      const [prox, prox2] = depois(i, 2);
      for (const c of [resto, prox && !RE_LINHA_ROTULO.test(prox) ? prox : "", L[i - 1] ?? "", prox2 ?? ""]) {
        const cu = cidadeUf(c);
        if (!cu) continue;
        r.localNascimento = cu.cidade; r.ufNascimento = cu.uf;
        // RG: a data ao lado da naturalidade é a de nascimento
        const d = !ehCNH && !r.dataNascimento ? data(c) : undefined;
        if (d && d < hoje) r.dataNascimento = d;
        break;
      }
    }

    // CNH: "4c DOC IDENTIDADE / ÓRG EMISSOR / UF" -> "20167415 SSP AM"
    if (!r.rg && /DOC\.?\s*IDENTIDADE/i.test(l)) {
      for (const c of depois(i, 2)) {
        const linhaNum = c.replace(/(\d)[.\s](?=\d)/g, "$1");
        const num = linhaNum.match(/\b(\d{4,13}(?:-?[\dXx])?)\b/);
        if (!num) continue;
        r.rg = num[1].replace(/[^\dXx]/g, "");
        // sigla do órgão logo depois do número, seguida da UF: "SSP AM", "MD DF", "SSP/AM"
        const org = linhaNum.slice((num.index ?? 0) + num[0].length).match(new RegExp(`\\b([A-Z]{2,8})\\s*[/\\-]?\\s*(${UF})\\b`));
        if (org) r.orgaoEmissor = `${org[1]}-${org[2]}`;
        break;
      }
    }
    // CIN: o número do RG é o próprio CPF
    if (/REGISTRO\s+GERAL\s*[-–]\s*CPF/i.test(l)) r.rgEhCpf = true;
    // RG antigo: "REGISTRO GERAL" / "RG", às vezes com a data de expedição na mesma linha; o OCR esparso deixa
    // "REGISTRO" sozinho numa linha e o número na de baixo
    if (!r.rg && !r.rgEhCpf && (/REGISTRO\s+GERAL|^R\.?\s?G\.?\s*[:Nº°]/i.test(l) || (!ehCNH && /^REGISTRO$/i.test(l)))) {
      for (const c of [l.replace(/.*?(REGISTRO\s+GERAL|REGISTRO|R\.?\s?G\.?)/i, ""), ...depois(i, 2)]) {
        const semDatas = c.replace(/\d{2}\s?[/.\-]\s?\d{2}\s?[/.\-]\s?\d{4}/g, " ");
        const num = semDatas.replace(/(\d)[.\s](?=\d)/g, "$1").match(/\b(\d{5,13}(?:-?[\dXx])?)\b/);
        if (num) { r.rg = num[1].replace(/[^\dXx]/g, ""); break; }
      }
    }

    // RG: "data de expedição"; CIN: "Data de Emissão"; CNH: "4a DATA EMISSÃO" — todas entram como data de expedição do documento
    // Na CNH a validade vem ao lado da emissão: data futura nunca é expedição. No RG a data pode vir em cima do rótulo
    if (!r.dataExpedicao && /EXPEDI[ÇC][ÃA]O|DATA\s+(?:DE\s+)?EMISS[ÃA]O|ISSUE\s+DATE/i.test(l)) {
      for (const c of [l, ...depois(i, 4), ...(ehCNH ? [] : [L[i - 1] ?? "", L[i - 2] ?? ""])]) {
        const d = datasTolerantes(c).find(x => x <= hoje);
        if (d) { r.dataExpedicao = d; break; }
      }
    }

    if (/FILIA[ÇCG][ÃA]O|FILIATION/i.test(l) && !r.nomePai && !r.nomeMae) {
      const nomes: string[] = [];
      // mesmo nome lido duas vezes, com ou sem espaço ("ROSENILDA BATISTA LEMOS" / "ROSENILDA BATISTALEMOS")
      const novo = (n: string) => !nomes.some(x => semAcento(x).replace(/ /g, "") === semAcento(n).replace(/ /g, ""));
      const resto = l.replace(/.*?(FILIA[ÇCG][ÃA]O|FILIATION)\s*:?/i, "");
      let ultimo = -1; // nome da linha anterior, que pode continuar nesta
      let linhaCheia: string | undefined; // essa linha com o fim que o nome descarta ("…OLIVEIRA DO N")
      let pendente: string | undefined;
      for (const c of [resto, ...depois(i, 8)]) {
        if (/[ÓO]RG[ÃA]O|EXPEDIDOR|NACIONALIDADE|NATURAL|OBSERVA|ASSINATURA|LOCAL|DATA|CPF|REGISTRO|CATEGORIA|VALIDADE|PERMISS[ÃA]O|\bACC\b|CAT\.?\s*HAB/i.test(c)) break;
        const achados = c.split(/\s\/\s/).map(p => nomeDe(p)).filter((n): n is string => !!n);
        if (achados.length) {
          if (nomes.length >= 2) break;
          // RG: palavra sozinha entre o 1º e o 2º nome é o fim do 1º ("ALEXANDRE BUSTAMANTE" / "RODRIGUES" / "NEUZA MAGALHAES")
          if (pendente && ultimo >= 0) nomes[ultimo] += ` ${pendente}`;
          pendente = undefined;
          const antes = nomes.length;
          for (const n of achados) if (novo(n)) nomes.push(n);
          ultimo = nomes.length > antes ? nomes.length - 1 : -1;
          linhaCheia = nomeDe(c, true);
          continue;
        }
        const pedaco = ultimo >= 0 ? pedacoDe(c) : undefined;
        pendente = undefined;
        if (pedaco && cnhAntiga && linhaCheia && linhaCheia.length >= 25 && linhaCheia.length <= 30) {
          // CNH antiga: a linha cheia (27 letras) continua na de baixo, às vezes no meio da palavra
          // ("ELINALDO JOSE OLIVEIRA DO N" / "ASCIMENTO" = DO NASCIMENTO)
          nomes[ultimo] = colarQuebra(linhaCheia, pedaco);
        } else if (pedaco && !ehCNH && pedaco.length === 1 && pedaco[0].length >= 4 && !NAO_E_NOME.test(pedaco[0])) {
          pendente = pedaco[0];
          continue;
        }
        ultimo = -1;
        if (nomes.length >= 2) break;
      }
      // RG/CIN: o OCR às vezes devolve o 1º nome da filiação ANTES do rótulo (verso da CIN digital: saía só o pai).
      // Faltando nome, vale o começo da linha do rótulo ou a linha de cima, se não for o nome do titular ("NOME" logo acima)
      if (!ehCNH && nomes.length < 2 && !/\bNOME\b/i.test(L[i - 1] ?? "") && !/\bNOME\b/i.test(L[i - 2] ?? "")) {
        for (const c of [l.slice(0, l.search(/FILIA[ÇCG][ÃA]O|FILIATION/i)), L[i - 1] ?? ""]) {
          const n = nomeDe(c);
          if (n && novo(n) && semAcento(n) !== semAcento(r.nome ?? "")) { nomes.unshift(n); break; }
        }
      }
      filiacao(r, nomes);
      // CNH-e é imagem limpa: um nome só significa que o documento só tem um dos pais
      if (ehCNH && nomes.length === 1) r.filiacaoUnica = true;
    }

    if (!r.estadoCivil && /ESTADO\s+CIVIL/i.test(l)) {
      for (const c of [l.replace(/.*ESTADO\s+CIVIL/i, ""), ...depois(i, 3)]) {
        const ec = ESTADO_CIVIL.find(([re]) => re.test(c));
        if (ec) { r.estadoCivil = ec[1]; break; }
      }
    }
  }
  // RG/CIN: sigla escrita ("SSP/PA"); senão, estado do cabeçalho + órgão pelo nome. A CNH fica de fora:
  // nela o estado do cabeçalho é o do DETRAN, e o órgão do RG vem da linha "DOC IDENTIDADE / ÓRG EMISSOR / UF"
  if (!ehCNH) {
    const sa = semAcento(texto.toUpperCase());
    const escrita = sa.match(new RegExp(`\\b(${SIGLAS})\\s*[/\\-]\\s*(${UF})\\b`));
    if (escrita && !r.orgaoEmissor) r.orgaoEmissor = `${escrita[1]}-${escrita[2]}`;
    const est = sa.match(RE_ESTADO);
    if (est) r.ufOrgao = UF_POR_ESTADO.find(([n]) => n === est[1])![1];
    const sigla = SIGLA_POR_NOME.find(([re]) => re.test(sa));
    if (sigla) r.siglaOrgao = sigla[1];
    // CIN: o campo "Órgão Expedidor / Card Issuer" nomeia o instituto; guarda a linha mais completa com o nome dele
    if (/[ÓO]RG[ÃA]O\s+EXPEDIDOR|CARD\s+ISSUER/i.test(texto)) r.temOrgaoExpedidor = true;
    for (const linha of L) {
      const m = semAcento(linha).match(/\bINSTITUTO(?:\s+[A-Z]{2,})+/);
      if (m && (!r.nomeOrgao || m[0].split(" ").length > r.nomeOrgao.split(" ").length)) r.nomeOrgao = m[0];
    }
  }
  if (r.rgEhCpf && r.cpf) r.rg = r.cpf;
  return r;
}

// Faixa MRZ (CIN/passaporte): só usada no fim, para preencher o que os rótulos não deram
function lerMRZ(texto: string): DadosDocumento {
  const r: DadosDocumento = {};
  const num = (s: string) => s.replace(/[OQDU]/g, "0").replace(/[IL]/g, "1").replace(/Z/g, "2").replace(/S/g, "5").replace(/B/g, "8").replace(/G/g, "6").replace(/[T/]/g, "7");
  const dvMRZ = (s: string) => s.split("").reduce((t, ch, i) => t + Number(ch) * [7, 3, 1][i % 3], 0) % 10;
  for (const bruta of texto.split("\n")) {
    const l = bruta.replace(/\s/g, "").toUpperCase();
    if ((l.match(/</g) || []).length < 2) continue;
    const nomeMRZ = l.match(/^([A-Z]+(?:<[A-Z]+)*)<<([A-Z]+(?:<[A-Z]+)*)<*$/);
    if (nomeMRZ && !r.nome) r.nome = `${nomeMRZ[2].replace(/</g, " ")} ${nomeMRZ[1].replace(/</g, " ")}`.trim();
    if (!r.cpf && /^I.?BRA/.test(l)) {
      const digitos = num(l.slice(5)).replace(/\D/g, "");
      for (let i = 0; i + 11 <= digitos.length && !r.cpf; i++) if (cpfValido(digitos.slice(i, i + 11))) r.cpf = digitos.slice(i, i + 11);
    }
    const nasc = l.match(/([0-9OQDUILZSBGT/]{6})([0-9OQDUILZSBGT/])[MF<]/);
    if (nasc && !r.dataNascimento) {
      const yymmdd = num(nasc[1]);
      if (/^\d{6}$/.test(yymmdd) && dvMRZ(yymmdd) === Number(num(nasc[2]))) {
        const aa = +yymmdd.slice(0, 2), ano = aa > new Date().getFullYear() % 100 ? 1900 + aa : 2000 + aa;
        r.dataNascimento = data(`${yymmdd.slice(4, 6)}/${yymmdd.slice(2, 4)}/${ano}`);
      }
    }
  }
  return r;
}

const semAcento = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "");

// O nome da MRZ não tem acento: se as mesmas palavras aparecem numa linha do documento, usa a grafia com acento
function nomeComAcento(nomeMRZ: string, textos: string[]): string {
  const alvo = semAcento(nomeMRZ).split(" ");
  for (const t of textos) for (const linha of t.split("\n")) {
    const tokens = linha.replace(/[^A-Za-zÀ-ÖØ-öø-ÿ'\s]/g, " ").split(/\s+/).filter(Boolean);
    for (let i = 0; i + alvo.length <= tokens.length; i++) {
      const janela = tokens.slice(i, i + alvo.length);
      if (janela.every((tk, j) => semAcento(tk).toUpperCase() === alvo[j])) return janela.join(" ").toUpperCase();
    }
  }
  return nomeMRZ;
}

const mesclar = (destino: DadosDocumento, fonte: DadosDocumento) => {
  for (const [k, v] of Object.entries(fonte) as [keyof DadosDocumento, never][]) if (v && !destino[k]) destino[k] = v;
};
// Iniciais das palavras do nome do órgão: "INSTITUTO DE IDENTIFICACAO ADERSON CONCEICAO DE MELO" -> "IIACM"
const siglaDoNome = (nome: string) => nome.split(" ").filter(p => !CONECTORES.has(p)).map(p => p[0]).join("");

// Junta o que um texto rendeu; o nome do órgão fica com a versão mais completa (no verso da CIN ele quebra em duas linhas)
function juntar(r: DadosDocumento, c: DadosDocumento) {
  const maisCompleto = !!c.nomeOrgao && (!r.nomeOrgao || c.nomeOrgao.split(" ").length > r.nomeOrgao.split(" ").length);
  mesclar(r, c);
  if (maisCompleto) r.nomeOrgao = c.nomeOrgao;
}

// Nomes e sobrenomes mais comuns, para separar palavras que o OCR grudou
const NOMES_COMUNS = new Set((
  "JOSE JOAO ANTONIO FRANCISCO CARLOS PAULO PEDRO LUCAS LUIZ LUIS MARCOS GABRIEL RAFAEL DANIEL MARCELO BRUNO EDUARDO " +
  "FELIPE RAIMUNDO RODRIGO MANOEL MANUEL MATEUS MATHEUS ANDRE FERNANDO FABIO LEONARDO GUSTAVO GUILHERME LEANDRO TIAGO " +
  "THIAGO ANDERSON RICARDO MARCIO JORGE ALEXANDRE ROBERTO EDSON SERGIO CLAUDIO JULIO VITOR VICTOR MIGUEL ARTHUR ARTUR " +
  "DAVI DAVID HENRIQUE SEBASTIAO VINICIUS DIEGO SAMUEL JONAS ISAIAS ELIAS CICERO BENEDITO GERALDO JOAQUIM SILVIO WILLIAM " +
  "WELLINGTON ADRIANO ALEX CRISTIANO EVANDRO NILSON MILTON NELSON HELIO ROGERIO RENATO MAURICIO OSVALDO OSMAR VALDIR " +
  "WALDIR WAGNER ELTON EVERTON EWERTON RAFAELA MARIA ANA FRANCISCA ANTONIA ADRIANA JULIANA MARCIA FERNANDA PATRICIA " +
  "ALINE SANDRA CAMILA AMANDA BRUNA JESSICA LETICIA JULIA LUCIANA VANESSA MARIANA GABRIELA VERA KELLY SIMONE CRISTINA " +
  "ROSA LUCIA HELENA RITA RAIMUNDA TERESA TEREZA SONIA CLAUDIA ELIANE ROSANGELA JOSEFA LUIZA LUISA BEATRIZ LARISSA " +
  "RAQUEL DEBORA TATIANA DANIELA RENATA CAROLINA CARLA PAULA REGINA ROSANA SUELI SUELY LUZIA MARLENE GRACA GRACAS " +
  "CONCEICAO APARECIDA FATIMA SOCORRO NAZARE AUXILIADORA EDNA IRENE IVONE MARTA ELIZABETH ROSILENE GISELE DENISE " +
  "MONICA ANGELA MIRIAM NEUZA SILVA SANTOS OLIVEIRA SOUZA SOUSA RODRIGUES FERREIRA ALVES PEREIRA LIMA GOMES COSTA " +
  "RIBEIRO MARTINS CARVALHO ALMEIDA LOPES SOARES FERNANDES VIEIRA BARBOSA ROCHA DIAS NASCIMENTO ANDRADE MOREIRA NUNES " +
  "MARQUES MACHADO MENDES FREITAS CARDOSO RAMOS GONCALVES SANTANA TEIXEIRA ARAUJO CAVALCANTE MONTEIRO BATISTA MELO " +
  "MELLO CASTRO CAMPOS MOURA BEZERRA PINTO NOGUEIRA BRITO MIRANDA REIS CORREIA CORREA PINHEIRO QUEIROZ MOTA SALES " +
  "FARIAS FARIA AGUIAR BRAGA LEITE SAMPAIO AZEVEDO BARROS CUNHA MORAES MORAIS CRUZ FONSECA GUIMARAES MEDEIROS SIQUEIRA " +
  "PAIVA MATOS JESUS NEVES XAVIER TAVARES VASCONCELOS LEMOS LEAL ABREU FIGUEIREDO PRADO BRANDAO MAIA GUEDES PIRES " +
  "SENA DUARTE BORGES FILHO JUNIOR NETO SOBRINHO JAIME ANA IAN EVA LUZ RUI IVO LIA ELI ADA GIL DAN BIA NEY ZOE"
).split(" "));

// Junta duas leituras do mesmo nome. Mesmas letras: fica a com mais espaços (palavras grudadas na outra). Uma igual à
// outra com algo a mais no começo ou no fim: fica a mais longa se o que sobra são até 3 letras coladas ("JESUILA" x
// "ESUILA", "AHMED" x "AH") ou nomes conhecidos inteiros; palavra solta desconhecida é lixo ("ACAO JOSE...", "PIA").
// Fora isso, fica a primeira
function melhorNome(a?: string, b?: string): string | undefined {
  if (!a || !b || a === b) return a || b;
  const sa = a.replace(/ /g, ""), sb = b.replace(/ /g, "");
  if (sa === sb) return b.split(" ").length > a.split(" ").length ? b : a;
  const [curto, longo] = sa.length < sb.length ? [a, b] : [b, a];
  for (const [cola, sobra] of [[longo.endsWith(curto), longo.slice(0, longo.length - curto.length)],
    [longo.startsWith(curto), longo.slice(curto.length)]] as [boolean, string][]) {
    if (!cola || !sobra.trim()) continue;
    const solta = sobra.startsWith(" ") || sobra.endsWith(" ");
    const palavras = sobra.trim().split(" ");
    if (!solta && palavras.length === 1 && sobra.length <= 3) return longo;
    if (solta && palavras.every(p => NOMES_COMUNS.has(semAcento(p)) || CONECTORES.has(p))) return longo;
    return curto;
  }
  return a;
}

// Duas leituras da mesma imagem (limiar local e da página inteira): uma completa a outra, e nos nomes fica a melhor
function consenso(a: DadosDocumento, b: DadosDocumento): DadosDocumento {
  const r: DadosDocumento = { ...b };
  for (const [k, v] of Object.entries(a) as [keyof DadosDocumento, never][]) if (v !== undefined) r[k] = v;
  for (const k of ["nome", "nomePai", "nomeMae"] as const) r[k] = melhorNome(a[k], b[k]);
  // um dos pais só numa das leituras: a filiação não é de um só
  if (r.nomePai && r.nomeMae) delete r.filiacaoUnica;
  for (const k of Object.keys(r) as (keyof DadosDocumento)[]) if (r[k] === undefined) delete r[k];
  return r;
}

// Palavras grudadas pelo OCR ("OLIVEIRASICSU", "MIGUELTEOFILO", "BATISTALEMOS", "DEOLIVEIRA"): separa quando as duas
// partes são nomes conhecidos — da lista comum ou de outro nome do mesmo documento (pais e filho dividem sobrenomes)
function separarGrudadas(nome: string | undefined, conhecidas: Set<string>): string | undefined {
  if (!nome) return nome;
  return nome.split(" ").map(p => {
    const s = semAcento(p);
    if (s.length < 6 || s.length !== p.length || NOMES_COMUNS.has(s)) return p;
    for (let k = 2; k <= s.length - 3; k++) {
      const a = s.slice(0, k), b = s.slice(k);
      if ((k >= 3 && conhecidas.has(a) || CONECTORES.has(a) && b.length >= 4) && conhecidas.has(b)) return `${p.slice(0, k)} ${p.slice(k)}`;
    }
    return p;
  }).join(" ");
}

// Sem sigla escrita: CIN usa o instituto do "Órgão Expedidor"; RG antigo, o órgão do cabeçalho (padrão SSP); + estado emissor
function finalizar(r: DadosDocumento): DadosDocumento {
  if (!r.orgaoEmissor) {
    const sigla = r.temOrgaoExpedidor && r.nomeOrgao ? siglaDoNome(r.nomeOrgao) : r.siglaOrgao;
    if (r.ufOrgao) r.orgaoEmissor = `${sigla ?? "SSP"}-${r.ufOrgao}`;
    else if (sigla && r.temOrgaoExpedidor) r.orgaoEmissor = sigla;
  }
  if (r.rgEhCpf && r.cpf) r.rg ||= r.cpf;
  // A CNH imprime nomes e cidade sem acento: acento lido nela é invenção do OCR ("SEBASTIÃO" de SEBASTIAO). Em qualquer
  // documento, "Ã" antes de "A" é sujeira ("CINTRÃAO")
  for (const k of ["nome", "nomePai", "nomeMae", "localNascimento"] as const) {
    const v = r[k]?.replace(/[ÃÁÂÀ](?=A)/g, "");
    if (v) r[k] = r.cnh ? semAcento(v) : v;
  }
  const conhecidas = new Set([...NOMES_COMUNS, ...[r.nome, r.nomePai, r.nomeMae].flatMap(n => semAcento(n ?? "").split(" ")).filter(p => p.length >= 3)]);
  r.nome = separarGrudadas(r.nome, conhecidas);
  r.nomePai = separarGrudadas(r.nomePai, conhecidas);
  r.nomeMae = separarGrudadas(r.nomeMae, conhecidas);
  for (const k of ["nome", "nomePai", "nomeMae"] as const) if (!r[k]) delete r[k];
  return r;
}

// A CNH antiga não tem naturalidade: nela a leitura acaba quando acha a data de emissão (no verso)
const completo = (r: DadosDocumento) =>
  !!(r.nome && r.cpf && r.dataNascimento && (r.rg || r.rgEhCpf) && (r.localNascimento || (r.cnhAntiga && r.dataExpedicao))
    && ((r.nomePai && r.nomeMae) || (r.filiacaoUnica && (r.nomePai || r.nomeMae))));

// ─── Imagens do documento ───────────────────────────────────────────────────

function carregarImagem(src: string): Promise<HTMLImageElement> {
  return new Promise((ok, erro) => {
    const img = new Image();
    img.onload = () => ok(img);
    img.onerror = () => erro(new Error("imagem não pôde ser aberta"));
    img.src = src;
  });
}

// Tons de cinza e largura boa para o OCR (letras pequenas ficam ilegíveis abaixo de ~1500px)
function prepararParaOCR(img: CanvasImageSource & { width: number; height: number }, semBordas = false): HTMLCanvasElement {
  const escala = Math.max(0.3, Math.min(3, 1900 / img.width, 2400 / Math.max(img.width, img.height)));
  const c = document.createElement("canvas");
  c.width = Math.round(img.width * escala); c.height = Math.round(img.height * escala);
  const ctx = c.getContext("2d")!;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, 0, 0, c.width, c.height);
  const d = ctx.getImageData(0, 0, c.width, c.height), p = d.data;
  for (let i = 0; i < p.length; i += 4) { const g = 0.299 * p[i] + 0.587 * p[i + 1] + 0.114 * p[i + 2]; p[i] = p[i + 1] = p[i + 2] = g; }
  if (semBordas) apagarBordas(p, c.width, c.height);
  ctx.putImageData(d, 0, 0);
  return c;
}

// Fundo vira branco e o cinza escurece (curva com expoente 2). Só na CNH modelo antigo, de letra cinza fina: sem isso a
// data de emissão do verso saía ilegível. Na CNH nova a curva engrossa a letra preta e piora a leitura ("1" virava "]")
function escurecerCinza(c: HTMLCanvasElement) {
  const ctx = c.getContext("2d")!, d = ctx.getImageData(0, 0, c.width, c.height), p = d.data, n = p.length / 4;
  const hist = new Uint32Array(256);
  for (let i = 0; i < p.length; i += 4) hist[p[i]]++;
  let fundo = 255;
  for (let acc = hist[255]; fundo > 0 && acc < n * 0.1; acc += hist[--fundo]);
  if (fundo < 60) return;
  for (let i = 0; i < p.length; i += 4) { const v = Math.min(1, p[i] / fundo); p[i] = p[i + 1] = p[i + 2] = 255 * v * v; }
  ctx.putImageData(d, 0, 0);
}

// Apaga as bordas das caixas da CNH: o traço horizontal fino e comprido e tudo o que encosta nele (cantos e laterais).
// Colada na 1ª letra, a lateral da caixa fazia o OCR ler "[TAMARA" (ITAMARA), "orLEILSON" (ORLEILSON) e "Ez" (ALESSANDRO).
// Bloco escuro grande (foto, cabeçalho preto) não é borda e fica como está.
function apagarBordas(p: Uint8ClampedArray, w: number, h: number) {
  const n = w * h, hist = new Uint32Array(256);
  for (let k = 0; k < n; k++) hist[p[k * 4]]++;
  let fundo = 255;
  for (let acc = hist[255]; fundo > 0 && acc < n * 0.1; acc += hist[--fundo]);
  const escuro = new Uint8Array(n);
  for (let k = 0; k < n; k++) escuro[k] = p[k * 4] < fundo * 0.62 ? 1 : 0;
  // sementes: traços horizontais com 5% da largura ou mais, finos (claro 4 px acima e abaixo em 80% do traço)
  const t = 4, minimo = Math.round(w * 0.05), semente = new Uint8Array(n), sementes: number[] = [];
  for (let y = t; y < h - t; y++) {
    for (let x = 0; x < w;) {
      if (!escuro[y * w + x]) { x++; continue; }
      const x0 = x;
      let ult = x;
      while (x < w && (escuro[y * w + x] || x - ult <= 2)) { if (escuro[y * w + x]) ult = x; x++; }
      if (ult - x0 + 1 >= minimo) {
        let claros = 0;
        for (let k = x0; k <= ult; k++) claros += 2 - escuro[(y - t) * w + k] - escuro[(y + t) * w + k];
        if (claros >= 1.6 * (ult - x0 + 1)) for (let k = y * w + x0; k <= y * w + ult; k++) if (escuro[k]) { semente[k] = 1; sementes.push(k); }
      }
      x = ult + 1;
    }
  }
  const visto = new Uint8Array(n), apagar = new Uint8Array(n), fila = new Int32Array(n), limite = n * 0.04;
  for (const s of sementes) {
    if (visto[s]) continue;
    let fim = 0;
    fila[fim++] = s; visto[s] = 1;
    for (let i = 0; i < fim; i++) {
      const k = fila[i], x = k % w, y = (k - x) / w;
      for (let yy = Math.max(0, y - 1); yy <= Math.min(h - 1, y + 1); yy++)
        for (let xx = Math.max(0, x - 1); xx <= Math.min(w - 1, x + 1); xx++) {
          const kk = yy * w + xx;
          if (escuro[kk] && !visto[kk]) { visto[kk] = 1; fila[fim++] = kk; }
        }
    }
    // grudada num bloco escuro grande: só o traço sai
    for (let i = 0; i < fim; i++) if (fim <= limite || semente[fila[i]]) apagar[fila[i]] = 1;
  }
  // pinta com o fundo, com 2 px de folga (a borda tem meio-tom em volta)
  for (let k = 0; k < n; k++) {
    if (!apagar[k]) continue;
    const x = k % w, y = (k - x) / w;
    for (let yy = Math.max(0, y - 2); yy <= Math.min(h - 1, y + 2); yy++)
      for (let xx = Math.max(0, x - 2); xx <= Math.min(w - 1, x + 2); xx++) { const q = (yy * w + xx) * 4; p[q] = p[q + 1] = p[q + 2] = fundo; }
  }
}

// JPEGs embutidos no PDF (CNH-e e CIN digital trazem frente/verso como imagem), sem QR codes nem ícones. O filtro pode vir
// numa lista ("[/DCTDecode]") ou com compressão por cima ("[/FlateDecode /DCTDecode]", fotos coladas num PDF): antes essas
// imagens ficavam de fora e o OCR lia a página inteira, com as fotos pequenas e de lado
async function jpegsDoPDF(L: any, bytes: Uint8Array): Promise<Blob[]> {
  const doc = await L.PDFDocument.load(bytes, { ignoreEncryption: true });
  const N = (s: string) => L.PDFName.of(s);
  const achadas: { dados: Uint8Array; inflar: boolean }[] = [], vistos = new Set<string>();
  const visitar = (res: any, prof: number) => {
    const xo = res?.lookup(N("XObject"), L.PDFDict);
    if (!xo) return;
    for (const [, ref] of xo.entries()) {
      if (vistos.has(String(ref))) continue;
      vistos.add(String(ref));
      const st = doc.context.lookup(ref);
      if (!(st instanceof L.PDFRawStream)) continue;
      const d = st.dict, sub = d.get(N("Subtype"));
      if (sub === N("Form") && prof < 3) { visitar(d.lookup(N("Resources"), L.PDFDict), prof + 1); continue; }
      const f = d.get(N("Filter")), filtros = f instanceof L.PDFArray ? f.asArray() : [f];
      const jpeg = filtros[filtros.length - 1] === N("DCTDecode") && filtros.slice(0, -1).every((x: any) => x === N("FlateDecode"));
      if (sub !== N("Image") || !jpeg || filtros.length > 2) continue;
      const w = d.get(N("Width"))?.asNumber?.() ?? 0, h = d.get(N("Height"))?.asNumber?.() ?? 0;
      if (w < 400 || h < 250 || (w / h > 0.85 && w / h < 1.18)) continue;
      achadas.push({ dados: st.contents, inflar: filtros.length === 2 });
    }
  };
  for (const page of doc.getPages().slice(0, 3)) visitar(page.node.Resources(), 0);
  const out: Blob[] = [];
  for (const { dados, inflar } of achadas) {
    try {
      const jpeg = inflar ? await new Response(new Blob([dados]).stream().pipeThrough(new DecompressionStream("deflate"))).arrayBuffer() : dados;
      out.push(new Blob([jpeg], { type: "image/jpeg" }));
    } catch { /* imagem que não abre fica de fora; sobra a página renderizada */ }
  }
  return out;
}

async function textoEPaginasDoPDF(pdfjs: any, bytes: Uint8Array, renderizar: boolean): Promise<{ texto: string; paginas: HTMLCanvasElement[] }> {
  const pdf = await pdfjs.getDocument({ data: bytes }).promise;
  try {
    let texto = "";
    const paginas: HTMLCanvasElement[] = [];
    for (let n = 1; n <= Math.min(pdf.numPages, 3); n++) {
      const page = await pdf.getPage(n);
      const tc = await page.getTextContent();
      const linhas = new Map<number, { x: number; w: number; h: number; s: string }[]>();
      for (const it of tc.items as { str: string; transform: number[]; width: number; height: number }[]) {
        if (!it.str?.trim()) continue;
        const y = Math.round(it.transform[5] / 3);
        (linhas.get(y) ?? linhas.set(y, []).get(y)!).push({ x: it.transform[4], w: it.width, h: it.height || Math.abs(it.transform[3]) || 10, s: it.str });
      }
      // pedaços colados da mesma palavra ("Tr" + "indade") se juntam sem espaço
      for (const y of [...linhas.keys()].sort((a, b) => b - a)) {
        const itens = linhas.get(y)!.sort((a, b) => a.x - b.x);
        texto += itens.map((it, k) => {
          const ant = itens[k - 1];
          return (ant && it.x - (ant.x + ant.w) > Math.max(0.8, ant.h * 0.2) ? " " : "") + it.s;
        }).join("").replace(/\s+/g, " ").trim() + "\n";
      }
      if (renderizar && n <= 2) {
        const vp = page.getViewport({ scale: 2.5 });
        const c = document.createElement("canvas");
        c.width = Math.ceil(vp.width); c.height = Math.ceil(vp.height);
        const ctx = c.getContext("2d")!;
        ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height);
        await page.render({ canvasContext: ctx, viewport: vp, intent: "print" }).promise;
        paginas.push(c);
      }
    }
    return { texto, paginas };
  } finally {
    await pdf.destroy();
  }
}

// ─── Laudo psicológico: nome e CPF do avaliado ──────────────────────────────

const ROTULO_LAUDO = /\b(Sexo|Estado\s+Civil|Escolaridade|Idade|CPF|Profiss[ãa]o|RG|Data|Naturalidade|Nacionalidade|Endere[çc]o)\b\s*:?/i;
const antesDoRotulo = (s: string) => { const k = s.search(ROTULO_LAUDO); return (k >= 0 ? s.slice(0, k) : s).trim(); };

// O laudo tem "Nome" e "CPF" da clínica, do avaliado e da psicóloga: vale o bloco "Identificação do Avaliado"
export function camposDoLaudo(texto: string): { nome?: string; cpf?: string } {
  const L = texto.split("\n").map(l => l.replace(/[|]/g, " ").replace(/\s+/g, " ").trim()).filter(Boolean);
  const ini = Math.max(0, L.findIndex(l => /IDENTIFICA[ÇC][ÃA]O\s+DO\s+AVALIAD/i.test(l)));
  const r: { nome?: string; cpf?: string } = {};
  for (let i = ini; i < L.length && !r.nome; i++) {
    const m = L[i].match(/\bNome(?:\s+completo)?\s*:\s*(.*)$/i);
    if (!m) continue;
    let nome = antesDoRotulo(m[1]);
    // o nome longo quebra na célula: a continuação vem na linha seguinte, às vezes junto de "Sexo: ..."
    const cont = L[i + 1] ? antesDoRotulo(L[i + 1]) : "";
    if (cont && /^[A-Za-zÀ-ÖØ-öø-ÿ' ]+$/.test(cont) && !/\bNome\b/i.test(L[i + 1])) nome += " " + cont;
    nome = nome.replace(/[^A-Za-zÀ-ÖØ-öø-ÿ' ]/g, " ").replace(/\s+/g, " ").trim();
    if (nome.split(" ").length >= 2 && !/CL[IÍ]NICA|CONSULT[OÓ]RIO|LTDA|INSTITUTO/i.test(nome)) r.nome = nome.toUpperCase();
  }
  const resto = L.slice(ini).join("\n");
  for (const m of resto.matchAll(/\d{3}\s?\.\s?\d{3}\s?\.\s?\d{3}\s?[-–]\s?\d{2}(?!\d)/g)) {
    const d = m[0].replace(/\D/g, "");
    if (cpfValido(d)) { r.cpf = d; break; }
  }
  return r;
}

export async function lerLaudo(file: File, progresso?: (msg: string) => void): Promise<{ nome?: string; cpf?: string }> {
  const ehPDF = file.type === "application/pdf" || /\.pdf$/i.test(file.name);
  let imagens: (HTMLImageElement | HTMLCanvasElement)[] = [];
  let url = "";
  try {
    progresso?.("Lendo o laudo...");
    if (ehPDF) {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const pdfjs = await carregarScript(PDFJS, "pdfjsLib").then(lib => { lib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER; return lib; });
      const { texto } = await textoEPaginasDoPDF(pdfjs, bytes.slice(), false);
      const r = camposDoLaudo(texto);
      if (r.nome && r.cpf) return r;
      imagens = (await textoEPaginasDoPDF(pdfjs, bytes.slice(), true)).paginas; // laudo escaneado
    } else {
      url = URL.createObjectURL(file);
      imagens = [await carregarImagem(url)];
    }
    const Tesseract = await carregarScript(TESSERACT, "Tesseract");
    const worker = await Tesseract.createWorker("por");
    const r: { nome?: string; cpf?: string } = {};
    try {
      await worker.setParameters({ tessedit_pageseg_mode: "6" });
      for (let i = 0; i < imagens.length && !(r.nome && r.cpf); i++) {
        progresso?.(`Lendo o laudo... ${i + 1}/${imagens.length}`);
        const { data } = await worker.recognize(prepararParaOCR(imagens[i]));
        const c = camposDoLaudo(data.text);
        r.nome ||= c.nome; r.cpf ||= c.cpf;
      }
    } finally {
      await worker.terminate();
    }
    return r;
  } finally {
    if (url) URL.revokeObjectURL(url);
  }
}

// ─── Leitura completa ───────────────────────────────────────────────────────

// Rótulo no começo de cada linha do OCR. Os de campo (FILIAÇÃO, DOC IDENTIDADE, CPF, DATA, NATURALIDADE...) marcam a
// coluna do valor: na linha do rótulo e nas de baixo, palavra que termina antes dela é lixo da foto ao lado
// ("IRES ADAUMIR ARAUJO BATISTA", "ZFS DA ERINALDO EDUARDO CABRAL", "REA MANAUS/AM")
const RE_ROTULO = /\b(?:NOME|FILIA[ÇCG][ÃA]O|FILIATION|NATURA[LT]IDADE|NACIONALIDADE|DOC\.?|CPF|DATA|LOCAL|REGISTRO|VALIDADE|ASSINATURA|OBSERVA[ÇC][ÕO]ES|PERMISS[ÃA]O|ACC|HABILITA[ÇC][ÃA]O|SEXO)\b/i;
const RE_ROTULO_COLUNA = /^(?:NOME|FILIA|NATURA|NACIONALIDADE|DOC|CPF|DATA|LOCAL)/i;
type Palavra = { text: string; confidence: number; bbox: Caixa };
const linhasDoOCR = (data: any): { words?: Palavra[] }[] =>
  (data?.blocks ?? []).flatMap((b: any) => (b.paragraphs ?? []).flatMap((p: any) => p.lines ?? []));

function textoDoOCR(data: any): string {
  const linhas = linhasDoOCR(data);
  if (!linhas.length) return String(data?.text ?? "");
  let coluna = -1, resta = 0;
  return linhas.map(l => {
    let ws = (l.words ?? []).filter(w => w.text?.trim());
    if (!ws.length) return "";
    // altura da letra pelas palavras bem lidas (o lixo da foto vem com caixas altas)
    const boas = ws.filter(w => w.confidence >= 60), base = boas.length ? boas : ws;
    const alturas = base.map(w => w.bbox.y1 - w.bbox.y0).sort((a, b) => a - b), altura = alturas[alturas.length >> 1];
    const linha = ws.map(w => w.text).join(" ");
    const m = linha.match(RE_ROTULO);
    if (m) {
      let k = 0;
      for (let pos = 0; k < ws.length - 1 && pos + ws[k].text.length < m.index!; k++) pos += ws[k].text.length + 1;
      // o número do campo na frente do rótulo ("4c DOC IDENTIDADE", "3 DATA, LOCAL", "2 e 1 NOME") faz parte dele
      for (let n = 0; n < 3 && k > 0 && ws[k - 1].text.length <= 2 && ws[k].bbox.x0 - ws[k - 1].bbox.x1 < altura * 1.5; n++) k--;
      // só vale como coluna se antes do rótulo há só lixo (palavra curta ou ilegível): com outro rótulo mal lido antes
      // ("Naturatidade / Place of Birth Data de Validade"), o valor da esquerda sumiria
      if (RE_ROTULO_COLUNA.test(m[0]) && ws.slice(0, k).every(w => w.text.length <= 3 || w.confidence < 60)) {
        coluna = ws[k].bbox.x0; resta = 7;
        ws = ws.slice(k);
      } else { coluna = -1; resta = 0; }
    } else if (coluna >= 0 && resta-- > 0) {
      // fica o valor a partir da coluna e as palavras coladas nele com espaço normal (rótulo centralizado, como no cartão
      // do CPF, deixa o começo do nome antes da coluna); sai o que está antes, separado por um vão ou por pontuação
      // (sobra da borda lida como "—")
      const tem = (w: Palavra) => /[A-Za-zÀ-ÿ0-9]/.test(w.text);
      const j = ws.findIndex(w => w.bbox.x1 >= coluna - altura && tem(w));
      let s = j < 0 ? ws.length : j;
      while (s > 0 && s < ws.length && tem(ws[s - 1]) && ws[s].bbox.x0 - ws[s - 1].bbox.x1 < altura * 0.8) s--;
      ws = ws.slice(s);
    }
    return ws.map(w => w.text).join(" ");
  }).join("\n");
}

// Palavras de verdade lidas com confiança: perto de zero numa foto de documento deitada
const legiveis = (data: any) => linhasDoOCR(data).flatMap(l => l.words ?? []).filter(w => w.confidence >= 75 && /[A-Za-zÀ-ÿ]{3,}/.test(w.text)).length;

function girar(c: HTMLCanvasElement, graus: number): HTMLCanvasElement {
  const g = document.createElement("canvas");
  const deitado = graus % 180 !== 0;
  g.width = deitado ? c.height : c.width; g.height = deitado ? c.width : c.height;
  const ctx = g.getContext("2d")!;
  ctx.translate(g.width / 2, g.height / 2);
  ctx.rotate((graus * Math.PI) / 180);
  ctx.drawImage(c, -c.width / 2, -c.height / 2);
  return g;
}

// RG antigo sem o rótulo FILIAÇÃO legível: os pais vêm nas linhas logo abaixo do nome do titular, às vezes com o fim
// do nome do pai sozinho na linha de baixo ("ALEXANDRE BUSTAMANTE" / "RODRIGUES" / "NEUZA MAGALHAES")
function filiacaoAbaixoDoNome(textos: string[], nome: string): string[] {
  const alvo = semAcento(nome).replace(/ /g, "");
  for (const t of textos) {
    const L = t.split("\n").map(l => l.replace(/[|[\]{}“”"]/g, " ").replace(/\s+/g, " ").trim()).filter(Boolean);
    const i = L.findIndex(l => semAcento(nomeDe(l) ?? "").replace(/ /g, "") === alvo);
    if (i < 0) continue;
    const nomes: string[] = [];
    let pendente: string | undefined;
    for (const c of L.slice(i + 1, i + 6)) {
      if (datasTolerantes(c).length || RE_LINHA_ROTULO.test(c) || /NATURA[LT]|\bCPF\b|\bDOC\b/i.test(c)) break;
      const n = nomeDe(c);
      if (n) {
        if (pendente && nomes.length === 1) nomes[0] += ` ${pendente}`;
        pendente = undefined;
        nomes.push(n);
        if (nomes.length === 2) break;
        continue;
      }
      const p = pedacoDe(c);
      pendente = p && p.length === 1 && p[0].length >= 4 && nomes.length === 1 && !NAO_E_NOME.test(p[0]) ? p[0] : undefined;
    }
    if (nomes.length) return nomes;
  }
  return [];
}

export async function lerDocumento(file: File, progresso?: (msg: string) => void): Promise<DadosDocumento> {
  const r: DadosDocumento = {}, mrz: DadosDocumento = {};
  const textos: string[] = [];
  const ehPDF = file.type === "application/pdf" || /\.pdf$/i.test(file.name);
  let imagens: (HTMLImageElement | HTMLCanvasElement)[] = [];
  const urls: string[] = [];

  try {
    progresso?.("Abrindo documento...");
    const tesseractPromise = carregarScript(TESSERACT, "Tesseract");
    if (ehPDF) {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const [pdfjs, L] = await Promise.all([
        carregarScript(PDFJS, "pdfjsLib").then(lib => { lib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER; return lib; }),
        carregarScript(PDFLIB, "PDFLib"),
      ]);
      const jpegs = await jpegsDoPDF(L, bytes.slice());
      for (const b of jpegs.slice(0, 4)) { const u = URL.createObjectURL(b); urls.push(u); imagens.push(await carregarImagem(u)); }
      const { texto, paginas } = await textoEPaginasDoPDF(pdfjs, bytes.slice(), imagens.length === 0);
      juntar(r, extrairCampos(texto));
      if (!imagens.length) imagens = paginas;
    } else {
      const u = URL.createObjectURL(file); urls.push(u);
      imagens = [await carregarImagem(u)];
    }
    if (completo(r) || !imagens.length) return finalizar(r);

    const Tesseract = await tesseractPromise;
    progresso?.("Preparando leitura...");
    const worker = await Tesseract.createWorker("por");
    try {
      const preparadas = imagens.map(img => prepararParaOCR(img, true)), escurecidas = new Set<number>();
      // 1ª passada como bloco único (lê melhor acentos); se faltar algo, 2ª como texto esparso (melhor em fundo colorido).
      // Limiar local (Sauvola): com o limiar único da página, o cabeçalho preto da CNH antiga fazia sumir o texto cinza fino
      // (a linha inteira do CPF e da data de nascimento)
      for (const [passada, psm] of [[1, "6"], [2, "11"]] as const) {
        await worker.setParameters({ tessedit_pageseg_mode: psm, thresholding_method: "2" });
        for (let i = 0; i < preparadas.length && !completo(r); i++) {
          progresso?.(`Lendo documento... ${passada === 1 ? "" : "(revisão) "}${i + 1}/${preparadas.length}`);
          // a frente já disse que é CNH antiga: o resto (verso, e a frente de novo na revisão) vai com o cinza escurecido
          if (r.cnhAntiga && !escurecidas.has(i)) { escurecerCinza(preparadas[i]); escurecidas.add(i); }
          let { data } = await worker.recognize(preparadas[i], {}, { text: true, blocks: true });
          // Foto do documento deitada (imagem em pé com quase nada legível) ou de cabeça para baixo (nada legível): tenta
          // girada e fica com a que lê melhor
          const lidas = passada === 1 ? legiveis(data) : 99;
          if (lidas < 6) {
            for (const graus of preparadas[i].height > preparadas[i].width ? [90, 270] : lidas <= 2 ? [180] : []) {
              const girada = girar(preparadas[i], graus);
              const outra = (await worker.recognize(girada, {}, { text: true, blocks: true })).data;
              if (legiveis(outra) > Math.max(6, legiveis(data) * 2)) { data = outra; preparadas[i] = girada; break; }
            }
          }
          const texto = textoDoOCR(data);
          textos.push(texto);
          let campos = extrairCampos(texto);
          // Lado com dados (tem rótulo de campo) é lido de novo com o limiar da página inteira, e as duas leituras se
          // corrigem: letra que some numa ("ESUILA") aparece na outra, palavras grudadas numa ("KLEITONALEXANDRE") vêm
          // separadas na outra, a data cinza do verso da CNH antiga ilegível numa sai na outra
          if (passada === 1 && RE_ROTULO.test(texto)) {
            progresso?.(`Conferindo a leitura... ${i + 1}/${preparadas.length}`);
            await worker.setParameters({ thresholding_method: "0" });
            const outra = textoDoOCR((await worker.recognize(preparadas[i], {}, { text: true, blocks: true })).data);
            await worker.setParameters({ thresholding_method: "2" });
            textos.push(outra);
            campos = consenso(campos, extrairCampos(outra));
          }
          juntar(r, campos);
          mesclar(mrz, lerMRZ(data.text));
        }
        if (completo(r)) break;
      }
    } finally {
      await worker.terminate();
    }
    if (!r.nome && mrz.nome) r.nome = nomeComAcento(mrz.nome, textos);
    mesclar(r, mrz);
    // RG antigo com rótulos ilegíveis: pais logo abaixo do nome, e o número com dígito ("0484901-9") em qualquer linha
    if (!textos.some(t => /HABILITA|SOBRENOME|DOC\.?\s*IDENTIDADE|SENATRAN|RENACH/i.test(t))) {
      if (r.nome && !r.nomePai && !r.nomeMae) filiacao(r, filiacaoAbaixoDoNome(textos, r.nome));
      for (const t of textos) {
        const m = r.rg || r.rgEhCpf ? null : t.match(/(?<![\d./])\d{1,2}\.?\d{3}\.?\d{3}-[\dXx](?![\d/])/);
        if (m) { r.rg = m[0].replace(/[^\dXx]/g, ""); break; }
      }
    }
    return finalizar(r);
  } finally {
    urls.forEach(u => URL.revokeObjectURL(u));
  }
}

// ─── Comprovante de residência: endereço ────────────────────────────────────
// Formatos vistos nas contas de Manaus (texto como o pdf.js monta as linhas):
//   Amazonas Energia: "AL GENEBRA, 08, QD-G4" / "PONTA NEGRA Consulte pela Chave..." / "69.037-225 - MANAUS - AM Chave..."
//   Âmbar Energia:    "R. WALDIR NORMANDO , 106 BL-2A USAR P/ DÉBITO..." / "PLANALTO, AME 106 - Número da UC..." /
//                     "ZONA CENTRO-OESTE - CEP 69.044-236 - MANAUS - AM ..."
//   Águas de Manaus:  "RUA CONDE MARANHAO-20-CIDADE NOVA - MUNDO NOVO-MANAUS-" / "AM-CEP:69005000", ou
//                     "RUA BENJAMIN CONSTANT-112-PETROPOLIS-MANAUS-AM-Cep:" com o número no fim da linha de baixo
//   Declaração do site: "... na RUA BENTO FERNANDES, Nº 77, AME 77- TANCREDO NEVES, Cep: 69.087-671– MANAUS-AM"
// O endereço da própria empresa (CNPJ na linha ou na de baixo, ou CEP da sede) é ignorado.

export interface DadosEndereco {
  cep?: string; logradouro?: string; numero?: string; complemento?: string; bairro?: string; cidade?: string; uf?: string;
}

const RE_LOGRADOURO = /(?:^|[^A-Za-zÀ-ÿ])((?:RUA|R\.|AVENIDA|AV\.?|ALAMEDA|AL\.?|TRAVESSA|TRAV\.?|TV\.?|BECO|BC\.?|ESTRADA|ESTR\.?|EST\.?|RODOVIA|ROD\.?|CONJUNTO|CONJ\.?|CJ\.?|CONDOM[IÍ]NIO|COND\.?|RESIDENCIAL|PRA[CÇ]A|P[CÇ]A\.?|LARGO|LG\.?|VILA|VL\.?|VIELA|PASSAGEM|LADEIRA|RAMAL)\s+[A-ZÀ-Ý0-9].*)$/i;
// Cabeçalho da empresa: a busca da rua do cliente não sobe além dele
const RE_CABECALHO_EMPRESA = /CNPJ|INSC\.?\s*ESTADUAL|INSCRI[ÇC][ÃA]O\s+ESTADUAL|\bS\/A\b/i;
// O OCR às vezes troca o ponto do CEP por vírgula ("69,093-415")
const RE_CEP_ROTULO = /\bCEP\s*[:.-]?\s*(\d{2}[.,]?\d{3}\s?-?\s?\d{3})(?!\d)/i;
const RE_CEP_SOLTO = /(?<!\d)(\d{2}[.,]\d{3}-\d{3}|\d{5}-\d{3})(?!\d)/;
const RE_CEP_QUALQUER = /(?<!\d)(\d{2}[.,]?\d{3}-?\d{3})(?!\d)/;
const CEP_NO_FIM = /\bCEP\s*[:.-]?\s*$/i;
// Sedes da Âmbar/Amazonas Energia e da Águas de Manaus: o CEP delas sai em toda conta (no OCR, às vezes com um dígito trocado)
const CEP_EMPRESA = ["69058807", "69035093"];
const ehCepDeEmpresa = (cep: string) => CEP_EMPRESA.some(e => [...e].filter((d, k) => d !== cep[k]).length <= 1);
// Linhas entre a rua e o CEP que não são bairro (rótulos da conta)
const NAO_BAIRRO = /CONSULTE|CHAVE|C[ÓO]DIGO|M[ÊE]S|NOTA|DATA|VIA\b|PAGAMENTO|FATURA|EMISS|VENCIMENTO|TOTAL|VALOR|CLIENTE|CONSUMO|LEITURA|MEDIDOR|CPF|CNPJ|ENDERE|REFER|CLASSE|TARIFA|MATR[ÍI]CULA|INSTALA/i;
// Palavras da conta que grudam no fim do endereço ("106 BL-2A USAR P/ DÉBITO AUTOMÁTICO")
const RE_RUIDO = /^(USAR|D[ÉE]BITO|AUTOM[ÁA]TICO|N[ÚU]MERO|UC|VENCIMENTO|M[ÊE]S|FATURAD\w*|TARIFA|NOTA|S[ÉE]RIE|DATA|EMISS\w*|CONSULTE|CHAVE|PROTOCOLO|C[ÓO]DIGO|REFER\w*|TOTAL|VALOR|CPF|CNPJ|MATR[ÍI]CULA|CLIENTE|CONSUMO|LEITURA|MEDIDOR)$/i;

// Corta o que vem depois de códigos, datas e rótulos colados na mesma linha ("QD-G4 2550775-3 01/2026" -> "QD-G4");
// endereço em maiúsculas para na primeira palavra com minúsculas ("PONTA NEGRA Consulte pela..." -> "PONTA NEGRA")
function semLixo(s: string): string {
  const tokens = s.trim().split(/\s+/).filter(Boolean);
  const emMaiusculas = !!tokens[0] && tokens[0] === tokens[0].toUpperCase() && /[A-ZÀ-Ý0-9]/.test(tokens[0]);
  const out: string[] = [];
  for (const t of tokens) {
    if (/^\d{2}\/\d{2,4}(\/\d{4})?$|^\d{6,}$|^\d{5,}-\d$|^R\$/.test(t)) break;
    if (RE_RUIDO.test(t.replace(/[.:,;]+$/, ""))) break;
    if (emMaiusculas && /[a-zà-ÿ]/.test(t) && !/^N[º°o]\.?$/.test(t)) break;
    out.push(t);
  }
  return out.join(" ").replace(/[\s,;–-]+$/, "").trim();
}

// "RUA X, Nº 77, AME 77- BAIRRO, MANAUS-AM" / "RUA X-112-BAIRRO-MANAUS-AM" -> rua, número, complemento, bairro, cidade, UF
function partesDoEndereco(txt: string): DadosEndereco {
  const r: DadosEndereco = {};
  const t = txt.replace(new RegExp(RE_CEP_ROTULO.source, "gi"), " - ").replace(new RegExp(RE_CEP_SOLTO.source, "g"), " - ");
  // Com vírgulas, o hífen só separa quando tem espaço do lado ("AME 77- TANCREDO NEVES"); sem vírgulas (água), todo hífen separa
  const sep = t.includes(",") ? /\s*,\s*|\s+[-–]\s*|\s*[-–]\s+|–/ : /\s*[-–,]\s*/;
  const partes = t.split(sep).map(semLixo).filter(Boolean);
  if (!partes.length) return r;
  const NUM = String.raw`(\d{1,6}|\d{1,3}(?:\.\d{3})+)`;
  const ehNumero = (s: string) => new RegExp(`^(?:N[º°O.]?\\s*)?${NUM}[A-Z]?$|^S\\/?N$`, "i").test(s);
  const ehCompl = (s: string) => /\d|S\/N/i.test(s) || s.length <= 2 || /^(APTO?|APT|AP|AME|CASA|BLOCO|BL|QD|QUADRA|LT|LOTE|TORRE|SALA|ANDAR|FUNDOS|FDS|CONJ|COND|KM|LOJA|BOX|C)\b/i.test(s);
  const cidUf = (s: string) => s.match(new RegExp(`^([A-ZÀ-Ý][A-Za-zÀ-ÿ' ]+?)(?:\\s*[/-]\\s*|\\s+)(${UF})$`, "i"));
  r.logradouro = partes[0];
  let k = 1;
  // número sozinho ("Nº 77", "2880", "4.400"), ou seguido do complemento na mesma parte ("106 BL-2A")
  const numComResto = partes[k]?.match(new RegExp(`^(?:N[º°O.]?\\s*)?${NUM}\\s+(.+)$`, "i"));
  if (partes[k] && ehNumero(partes[k])) { r.numero = partes[k].replace(/^N[º°O.]?\s*/i, "").replace(/\./g, ""); k++; }
  else if (numComResto) { r.numero = numComResto[1].replace(/\./g, ""); partes[k] = numComResto[2]; }
  else {
    // Número dentro da rua, sem vírgula ("AV TORQUATO TAPAJOS 204 TORRE B", "LG PRETO S/N AME S/N"): antes dele vêm
    // tipo + nome (2 palavras ou mais), para não pegar ruas de nome numérico ("RUA 7 DE SETEMBRO 123")
    const pals = partes[0].split(" ");
    const x = pals.findIndex((p, idx) => idx >= 2 && /^(\d{1,5}[A-Z]?|S\/N)$/i.test(p));
    if (x >= 2) {
      r.logradouro = pals.slice(0, x).join(" ").replace(/\s+N[º°O.]?$/i, "");
      r.numero = pals[x].toUpperCase();
      const resto = pals.slice(x + 1).join(" ");
      if (resto) partes.splice(1, 0, resto);
    }
  }
  let fim = partes.length;
  for (let x = partes.length - 1; x >= k; x--) {
    const cu = cidUf(partes[x]);
    if (cu) { r.cidade = cu[1].trim(); r.uf = cu[2].toUpperCase(); fim = x; break; }
    if (new RegExp(`^(${UF})$`, "i").test(partes[x])) {
      r.uf = partes[x].toUpperCase();
      if (x - 1 >= k && !ehCompl(partes[x - 1])) { r.cidade = partes[x - 1]; fim = x - 1; } else fim = x;
      break;
    }
  }
  const compl: string[] = [], bairros: string[] = [];
  for (const p of partes.slice(k, fim)) (ehCompl(p) ? compl : bairros).push(p);
  if (bairros.length) r.bairro = bairros[0];
  const resto = [...compl, ...bairros.slice(1)];
  if (resto.length) r.complemento = resto.join(" - ");
  return r;
}

// Tipo do logradouro por extenso: "AL GENEBRA" -> "ALAMEDA GENEBRA", "R. WALDIR NORMANDO" -> "RUA WALDIR NORMANDO"
// ("LG" fica como está: pode ser Largo ou Lago)
const TIPO_POR_EXTENSO: [RegExp, string][] = [
  [/^R\.?$/, "RUA"], [/^AV\.?$/, "AVENIDA"], [/^AL\.?$/, "ALAMEDA"], [/^(TV|TRAV)\.?$/, "TRAVESSA"], [/^BC\.?$/, "BECO"],
  [/^(EST|ESTR)\.?$/, "ESTRADA"], [/^ROD\.?$/, "RODOVIA"], [/^(CONJ|CJ)\.?$/, "CONJUNTO"], [/^COND\.?$/, "CONDOMÍNIO"],
  [/^VL\.?$/, "VILA"], [/^P[CÇ]A\.?$/, "PRAÇA"],
];

export function extrairEndereco(texto: string): DadosEndereco {
  const r = enderecoDoTexto(texto);
  if (r.logradouro) {
    const [tipo, ...nome] = r.logradouro.split(" ");
    const extenso = TIPO_POR_EXTENSO.find(([re]) => re.test(tipo.toUpperCase()));
    if (extenso && nome.length) r.logradouro = [extenso[1], ...nome].join(" ");
  }
  for (const k of Object.keys(r) as (keyof DadosEndereco)[]) if (!r[k]) delete r[k];
  return r;
}

// Linha só de complemento, entre a rua e o CEP ("APTO 312", "BLOCO 2")
const RE_LINHA_COMPLEMENTO = /^(APTO?|APT|AP|BLOCO|BL|CASA|QD|QUADRA|LT|LOTE|TORRE|SALA|ANDAR|FUNDOS|KM|LOJA|BOX|EDIF[IÍ]CIO|ED)\b/i;

function enderecoDoTexto(texto: string): DadosEndereco {
  const L = texto.split(/\n/).map(l => l.replace(/[|[\]{}“”"]/g, " ").replace(/\s+/g, " ").trim()).filter(Boolean);
  // "Cep:" no fim da linha: o número vem na linha de baixo, às vezes depois de outro texto ("PIS(...) R$ 0,00 69063010")
  const linhaDoCep = (i: number) => {
    if (!CEP_NO_FIM.test(L[i]) || !L[i + 1]) return L[i];
    const n = L[i + 1].match(RE_CEP_QUALQUER);
    return n ? `${L[i]} ${L[i + 1].slice(n.index)}` : L[i];
  };
  // A linha da rua mais perto acima do CEP; havendo mais de uma ("LG PRETO S/N" e "LG PRETO", ou a rua e o
  // "COND RESID ..."), vale a que tem número ou S/N
  const ruaAcima = (i: number) => {
    const achadas: { j: number; rua: string }[] = [];
    for (let k = i; k >= Math.max(0, i - 8); k--) {
      if (k < i && RE_CABECALHO_EMPRESA.test(L[k]) && !/CPF/i.test(L[k])) break;
      const m = L[k].match(RE_LOGRADOURO);
      if (m) achadas.push({ j: k, rua: m[1] });
    }
    return achadas.find(a => /\d|S\/N/i.test(a.rua)) ?? achadas[0] ?? null;
  };

  // CEPs do documento, tirando o da empresa: CNPJ na linha, na de baixo ou nas 3 de cima (o "CPF/CNPJ" do cliente
  // não conta), razão social logo acima, ou CEP da sede. "CEP:" com o número ilegível (o OCR leu um dígito a mais)
  // ainda serve para achar o endereço, só que sem o CEP
  const cnpj = (s?: string) => !!s && /CNPJ/i.test(s) && !/CPF/i.test(s);
  let melhor: { i: number; cep?: string; nota: number } | null = null;
  for (let i = 0; i < L.length; i++) {
    const linha = linhaDoCep(i);
    const m = linha.match(RE_CEP_ROTULO) ?? linha.match(RE_CEP_SOLTO);
    let cep = m?.[1].replace(/\D/g, "");
    if (cep && (cep.length !== 8 || /^0+$/.test(cep))) cep = undefined;
    if (!cep && !/\bCEP\b/i.test(linha)) continue;
    if (cep && ehCepDeEmpresa(cep)) continue;
    if ([linha, L[i + 1], L[i - 1], L[i - 2], L[i - 3]].some(cnpj) || /\bS\/A\b|\bS\.A\.?(?:\s|$)|LTDA|EIRELI/i.test(`${L[i - 1] ?? ""} ${L[i - 2] ?? ""}`)) continue;
    const nota = (ruaAcima(i) ? 2 : 0) + (cep ? 2 : 0) + (cep?.startsWith("69") ? 1 : 0);
    if (!melhor || nota > melhor.nota) melhor = { i, cep, nota };
  }
  if (!melhor) return {};
  const { i, cep } = melhor;
  const linhaCep = linhaDoCep(i);
  // Cidade/UF na linha do CEP ("69.037-225 - MANAUS - AM Chave de acesso...", "CEP 69.044-236 - MANAUS - AM 2546653-4")
  const cidadeDaLinha = () => {
    const resto = linhaCep.replace(RE_CEP_ROTULO, " ").replace(RE_CEP_SOLTO, " ");
    const m = resto.match(new RegExp(`(?:^|[^A-Za-zÀ-ÿ])([A-ZÀ-Ý][A-ZÀ-Ý' ]{1,40}?)\\s*[-/–]\\s*(${UF})(?![A-Za-zÀ-ÿ])`));
    return m ? { cidade: m[1].trim(), uf: m[2] } : {};
  };
  const achou = ruaAcima(i);
  if (!achou) return { cep, ...cidadeDaLinha() };
  const { j, rua } = achou;

  // Endereço inteiro numa linha (água, declaração), às vezes quebrado na linha de baixo
  if (j === i || (j === i - 1 && (/[-,–]\s*$/.test(L[j]) || new RegExp(`^(${UF})\\b|^N[º°O]`, "i").test(L[i])))) {
    const junto = j === i ? (rua + (linhaCep.length > L[i].length ? linhaCep.slice(L[i].length) : ""))
      : rua + (/-\s*$/.test(rua) ? "" : " ") + linhaCep;
    return { cep, ...partesDoEndereco(junto) };
  }

  // Rua/número numa linha e o resto embaixo, até o CEP: complemento em linha própria ("APTO 312"), depois
  // bairro, prédio ou complemento e cidade ("PLANALTO, AME 106", "CENTRO - SMART DOWNTOWN - MANAUS")
  const r: DadosEndereco = { cep, ...partesDoEndereco(rua) };
  delete r.cidade; delete r.uf;
  if (r.bairro) { r.complemento = r.complemento ? `${r.complemento} - ${r.bairro}` : r.bairro; delete r.bairro; }
  const juntarCompl = (...p: string[]) => { r.complemento = [r.complemento, ...p].filter(Boolean).join(" - "); };
  for (let k = j + 1; k < i; k++) {
    const linha = semLixo(L[k]);
    if (!linha) continue;
    if (RE_LINHA_COMPLEMENTO.test(linha)) { juntarCompl(linha); continue; }
    if (r.bairro) continue;
    const partes = linha.split(/\s*,\s*|\s+[-–]\s*|\s*[-–]\s+/).filter(Boolean);
    if (!partes.length || !/^[A-ZÀ-Ý][A-ZÀ-Ý' .]{2,}$/.test(partes[0]) || NAO_BAIRRO.test(partes[0])) continue;
    // "COL TERRA NOVA COND RESID ALLEGRO CLUBE": bairro antes, condomínio vai para o complemento
    const cond = partes[0].match(/^(.+?)\s+((?:COND|CONJ|CJ|RESID|RESIDENCIAL|EDIF|ED)\b.*)$/);
    r.bairro = cond ? cond[1] : partes[0];
    const resto = partes.slice(1);
    // três partes ou mais: a última é a cidade ("... - MANAUS")
    if (resto.length >= 2 && /^[A-ZÀ-Ý][A-ZÀ-Ý' ]+$/.test(resto[resto.length - 1])) r.cidade = resto.pop();
    juntarCompl(...(cond ? [cond[2]] : []), ...resto.filter(p => /\d|^[A-ZÀ-Ý]{2}/.test(p)));
  }
  return { ...r, ...cidadeDaLinha() };
}

// Recorte do bloco do endereço (da linha da rua até a do CEP) na imagem original, ampliado e com contraste esticado:
// a letra miúda de foto de conta em papel térmico ("1908" saía "19") é bem melhor lida assim do que na página inteira
type Fonte = CanvasImageSource & { width: number; height: number };
type Caixa = { x0: number; y0: number; x1: number; y1: number };
function recorteDoEndereco(data: any, fonte: Fonte, escala: number): HTMLCanvasElement | null {
  const linhas: { text: string; bbox: Caixa; words: { bbox: Caixa }[] }[] =
    (data?.blocks ?? []).flatMap((b: any) => (b.paragraphs ?? []).flatMap((p: any) => p.lines ?? []))
      .map((l: any) => ({ text: String(l.text ?? "").trim(), bbox: l.bbox, words: l.words ?? [] })); // o texto vem com "\n" no fim
  // de baixo para cima: o bloco do cliente vem depois do cabeçalho da empresa
  for (let c = linhas.length - 1; c >= 0; c--) {
    if (!/\bCEP\b/i.test(linhas[c].text)) continue;
    const digitos = linhas[c].text.replace(/\D/g, "");
    if (digitos.length >= 8 && ehCepDeEmpresa(digitos.slice(0, 8))) continue;
    const acima = linhas.slice(Math.max(0, c - 5), c);
    if (acima.some(l => /CNPJ/i.test(l.text) && !/CPF/i.test(l.text))) continue;
    const r = acima.findIndex(l => RE_LOGRADOURO.test(l.text));
    if (r < 0) continue;
    const bloco = [...acima.slice(r), linhas[c]];
    const alturas = bloco.map(l => l.bbox.y1 - l.bbox.y0).sort((a, b) => a - b);
    const altura = alturas[Math.floor(alturas.length / 2)];
    // Só a coluna do endereço: em cada linha, as palavras até o primeiro vão grande (a coluna da direita fica de fora)
    const fimDaColuna = (l: (typeof bloco)[number]) => {
      const ws = [...l.words].sort((a, b) => a.bbox.x0 - b.bbox.x0);
      if (!ws.length) return l.bbox.x1;
      let fim = ws[0].bbox.x1;
      for (const w of ws.slice(1)) { if (w.bbox.x0 - fim > altura * 2.5) break; fim = w.bbox.x1; }
      return fim;
    };
    const x0 = Math.min(...bloco.map(l => l.bbox.x0)), x1 = Math.max(...bloco.map(fimDaColuna));
    const y0 = bloco[0].bbox.y0, y1 = bloco[bloco.length - 1].bbox.y1;
    const margem = altura * 0.35;
    const ox = Math.max(0, (x0 - margem) / escala), oy = Math.max(0, (y0 - margem) / escala);
    const ow = Math.min(fonte.width - ox, (x1 - x0 + 2 * margem) / escala), oh = Math.min(fonte.height - oy, (y1 - y0 + 2 * margem) / escala);
    if (ow < 20 || oh < 10) return null;
    // letra com uns 36 px de altura, que é onde o OCR lê melhor
    const z = Math.max(1, Math.min(3.5, 36 / (altura / escala), 3600 / ow));
    const cv = document.createElement("canvas");
    cv.width = Math.round(ow * z); cv.height = Math.round(oh * z);
    const ctx = cv.getContext("2d")!;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(fonte, ox, oy, ow, oh, 0, 0, cv.width, cv.height);
    // tons de cinza; o contraste vai do 2% mais escuro ao 2% mais claro (papel desbotado, sombra da foto)
    const d = ctx.getImageData(0, 0, cv.width, cv.height), p = d.data, hist = new Array(256).fill(0);
    for (let i = 0; i < p.length; i += 4) { const g = Math.round(0.299 * p[i] + 0.587 * p[i + 1] + 0.114 * p[i + 2]); p[i] = g; hist[g]++; }
    const total = p.length / 4;
    let lo = 0, hi = 255, acc = 0;
    while (lo < 255 && (acc += hist[lo]) < total * 0.02) lo++;
    acc = 0;
    while (hi > 0 && (acc += hist[hi]) < total * 0.02) hi--;
    const f = hi > lo ? 255 / (hi - lo) : 1;
    for (let i = 0; i < p.length; i += 4) { const g = Math.max(0, Math.min(255, (p[i] - lo) * f)); p[i] = p[i + 1] = p[i + 2] = g; }
    ctx.putImageData(d, 0, 0);
    return cv;
  }
  return null;
}

// Lê o comprovante (PDF com texto, PDF escaneado ou foto) e devolve o endereço; o OCR só roda se o texto não trouxer o CEP
export async function lerComprovanteEndereco(file: File, progresso?: (msg: string) => void): Promise<DadosEndereco> {
  const ehPDF = file.type === "application/pdf" || /\.pdf$/i.test(file.name);
  let imagens: (HTMLImageElement | HTMLCanvasElement)[] = [];
  let url = "";
  try {
    progresso?.("Abrindo comprovante...");
    const tesseractPromise = carregarScript(TESSERACT, "Tesseract");
    if (ehPDF) {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const pdfjs = await carregarScript(PDFJS, "pdfjsLib").then(lib => { lib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER; return lib; });
      const { texto } = await textoEPaginasDoPDF(pdfjs, bytes.slice(), false);
      const r = extrairEndereco(texto);
      if (r.cep && r.logradouro) return r;
      imagens = (await textoEPaginasDoPDF(pdfjs, bytes.slice(), true)).paginas; // conta escaneada ou foto dentro do PDF
    } else {
      url = URL.createObjectURL(file);
      imagens = [await carregarImagem(url)];
    }
    if (!imagens.length) return {};
    const Tesseract = await tesseractPromise;
    progresso?.("Preparando leitura...");
    const worker = await Tesseract.createWorker("por");
    let melhor: DadosEndereco = {};
    const nota = (r: DadosEndereco) => (r.cep ? 2 : 0) + (r.logradouro ? 2 : 0) + (r.numero ? 1 : 0) + (r.bairro ? 1 : 0) + (r.complemento ? 0.5 : 0);
    try {
      // Conta comprida (foto ou página inteira): o endereço fica no alto, então a metade de cima vai primeiro, ampliada
      const fontes: Fonte[] = imagens.flatMap(img => {
        if (img.height <= img.width * 1.25) return [img];
        const topo = document.createElement("canvas");
        topo.width = img.width; topo.height = Math.round(img.height / 2);
        topo.getContext("2d")!.drawImage(img, 0, 0);
        return [topo, img];
      });
      for (const [passada, psm] of [[1, "6"], [2, "11"]] as const) {
        for (let i = 0; i < fontes.length; i++) {
          progresso?.(`Lendo comprovante... ${passada === 1 ? "" : "(revisão) "}${i + 1}/${fontes.length}`);
          await worker.setParameters({ tessedit_pageseg_mode: psm });
          const prep = prepararParaOCR(fontes[i]);
          const { data } = await worker.recognize(prep, {}, { text: true, blocks: true });
          let r = extrairEndereco(data.text);
          // Achou o bloco do endereço: lê de novo só ele, ampliado; o que sair melhor manda, o outro completa
          const recorte = recorteDoEndereco(data, fontes[i], prep.width / fontes[i].width);
          if (recorte) {
            await worker.setParameters({ tessedit_pageseg_mode: "6" });
            const z = extrairEndereco((await worker.recognize(recorte)).data.text);
            r = nota(z) >= nota(r) ? { ...r, ...z } : { ...z, ...r };
          }
          if (r.cep && r.logradouro && r.numero) return r;
          if (nota(r) > nota(melhor)) melhor = r;
        }
      }
    } finally {
      await worker.terminate();
    }
    return melhor;
  } finally {
    if (url) URL.revokeObjectURL(url);
  }
}
