// Lê CNH ou RG (PDF ou foto) com OCR no próprio navegador e devolve os campos do cadastro.
// O documento não sai do computador: só o motor de OCR e o idioma português são baixados da CDN.

const PDFJS = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
const PDFJS_WORKER = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
const PDFLIB = "https://cdnjs.cloudflare.com/ajax/libs/pdf-lib/1.17.1/pdf-lib.min.js";
const TESSERACT = "https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js";

export interface DadosDocumento {
  nome?: string; cpf?: string; rg?: string; rgEhCpf?: boolean; orgaoEmissor?: string; dataExpedicao?: string;
  dataNascimento?: string; localNascimento?: string; ufNascimento?: string;
  nomePai?: string; nomeMae?: string; estadoCivil?: string; filiacaoUnica?: boolean;
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
const NAO_E_NOME = /\b(REP[ÚU]BLICA|FEDERATIVA|MINIST[ÉE]RIO|CARTEIRA|NACIONAL|HABILITA|ASSINATURA|PORTADOR|INSTITUTO|IDENTIFICA|IDENTIDADE|[ÓO]RG[ÃA]O|EXPEDIDOR|EMISSOR|V[ÁA]LIDA|TERRIT[ÓO]RIO|DEPARTAMENTO|TR[ÂA]NSITO|SECRETARIA|GOVERNO|BRASILEIR[OA]|NACIONALIDADE|FILIA[ÇC][ÃA]O|SOBRENOME|REGISTRO|CATEGORIA|VALIDADE|OBSERVA|DOCUMENTO|CERTID[ÃA]O|CART[ÓO]RIO|SERPRO|DETRAN|ESTADO)\b/;

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

// Maior sequência de palavras em MAIÚSCULAS da linha (o OCR deixa letras soltas e lixo nas pontas)
function nomeDe(linha: string): string | undefined {
  const tokens = linha.replace(/[^A-Za-zÀ-ÖØ-öø-ÿ'\s]/g, " ").split(/\s+/).filter(Boolean);
  let melhor: string[] = [], atual: string[] = [];
  const fechar = () => {
    while (atual.length && CONECTORES.has(atual[atual.length - 1])) atual.pop();
    if (atual.length > melhor.length) melhor = atual;
    atual = [];
  };
  for (const t of tokens) {
    const maiuscula = t === t.toUpperCase() && /[A-ZÀ-Ý]/.test(t);
    const aceita = atual.length ? t.length >= 2 || CONECTORES.has(t) : t.length >= 3 && !CONECTORES.has(t);
    if (maiuscula && aceita) atual.push(t); else fechar();
  }
  fechar();
  const nome = melhor.join(" ");
  if (melhor.filter(t => !CONECTORES.has(t)).length < 2 || nome.length < 6 || nome.length > 70 || NAO_E_NOME.test(nome)) return;
  return nome;
}

function cidadeUf(s: string): { cidade: string; uf: string } | undefined {
  const m = s.match(new RegExp(`([A-ZÀ-Ý][A-ZÀ-Ý' ]{1,40}?)\\s*[,/\\-]\\s*(${UF})\\b`));
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

const ESTADO_CIVIL: [RegExp, string][] = [
  [/SOLTEIR/i, "Solteiro(a)"], [/CASAD/i, "Casado(a)"], [/DIVORCIAD/i, "Divorciado(a)"],
  [/VI[UÚ]V/i, "Viúvo(a)"], [/UNI[ÃA]O\s+EST/i, "União Estável"],
];

export function extrairCampos(texto: string): DadosDocumento {
  const L = texto.split(/\n/).map(l => l.replace(/[|[\]{}“”"]/g, " ").replace(/\s+/g, " ").trim()).filter(Boolean);
  const r: DadosDocumento = {};
  const ehCNH = /HABILITA|SOBRENOME|DOC\.?\s*IDENTIDADE|SENATRAN|RENACH/i.test(texto);
  const depois = (i: number, n: number) => L.slice(i + 1, i + 1 + n);

  // CPF formatado em qualquer lugar; sem pontuação só perto do rótulo "CPF" (outros números têm 11 dígitos, ex. registro da CNH)
  for (const m of texto.matchAll(/\d{3}\s?\.\s?\d{3}\s?\.\s?\d{3}\s?[-–]\s?\d{2}(?!\d)/g)) {
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

    if (!r.nome && /NOME\s+E\s+SOBRENOME|^NOME\s*\/\s*NAME\b|^NOME\s*:?$|^NOME\s*:/i.test(l)) {
      const resto = l.replace(/.*?(NOME\s+E\s+SOBRENOME|NOME\s*\/\s*NAME|NOME)\s*:?/i, "");
      for (const c of [resto, ...depois(i, 2)]) { const n = nomeDe(c); if (n) { r.nome = n; break; } }
    }

    // CNH: "3 DATA, LOCAL E UF DE NASCIMENTO" -> "16/02/1996, MANAUS, AM"
    if (/LOCAL\s+E\s+UF\s+DE\s+NASC|DATA,?\s*LOCAL/i.test(l)) {
      for (const c of depois(i, 2)) {
        const d = data(c);
        if (!d) continue;
        r.dataNascimento ??= d;
        const cu = cidadeUf(c.slice(c.search(/\d{4}/) + 4));
        if (cu && !r.localNascimento) { r.localNascimento = cu.cidade; r.ufNascimento = cu.uf; }
        break;
      }
    }
    if (!r.dataNascimento && /NASCIMENTO|DATE OF BIRTH|DT\.?\s*NASC/i.test(l)) {
      for (const c of [l, ...depois(i, 2)]) { const d = data(c); if (d) { r.dataNascimento = d; break; } }
    }
    if (!r.localNascimento && /NATURA[LT]IDADE|PLACE OF BIRTH|NATURAL DE/i.test(l)) {
      const resto = l.replace(/.*?(NATURA[LT]IDADE|PLACE OF BIRTH|NATURAL DE)\s*:?/i, "");
      for (const c of [resto, ...depois(i, 2)]) {
        const cu = cidadeUf(c);
        if (cu) { r.localNascimento = cu.cidade; r.ufNascimento = cu.uf; break; }
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
    // RG antigo: "REGISTRO GERAL" / "RG"
    if (!r.rg && !r.rgEhCpf && /REGISTRO\s+GERAL|^R\.?\s?G\.?\s*[:Nº°]/i.test(l)) {
      for (const c of [l.replace(/.*?(REGISTRO\s+GERAL|R\.?\s?G\.?)/i, ""), ...depois(i, 2)]) {
        if (data(c)) continue;
        const num = c.replace(/(\d)[.\s](?=\d)/g, "$1").match(/\b(\d{5,13}(?:-?[\dXx])?)\b/);
        if (num) { r.rg = num[1].replace(/[^\dXx]/g, ""); break; }
      }
    }

    // RG: "data de expedição"; CIN: "Data de Emissão"; CNH: "4a DATA EMISSÃO" — todas entram como data de expedição do documento
    // Na CNH a validade vem ao lado da emissão: data futura nunca é expedição
    if (!r.dataExpedicao && /EXPEDI[ÇC][ÃA]O|DATA\s+(?:DE\s+)?EMISS[ÃA]O|ISSUE\s+DATE/i.test(l)) {
      const hoje = new Date().toISOString().slice(0, 10);
      for (const c of [l, ...depois(i, 4)]) {
        const d = datasTolerantes(c).find(x => x <= hoje);
        if (d) { r.dataExpedicao = d; break; }
      }
    }

    if (/FILIA[ÇCG][ÃA]O|FILIATION/i.test(l) && !r.nomePai && !r.nomeMae) {
      const nomes: string[] = [];
      const resto = l.replace(/.*?(FILIA[ÇCG][ÃA]O|FILIATION)\s*:?/i, "");
      for (const c of [resto, ...depois(i, 8)]) {
        if (/[ÓO]RG[ÃA]O|EXPEDIDOR|NACIONALIDADE|NATURAL|OBSERVA|ASSINATURA|LOCAL|DATA|CPF|REGISTRO|CATEGORIA|VALIDADE/i.test(c)) break;
        for (const parte of c.split(/\s\/\s/)) { const n = nomeDe(parte); if (n && !nomes.includes(n)) nomes.push(n); }
        if (nomes.length >= 2) break;
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
const completo = (r: DadosDocumento) =>
  !!(r.nome && r.cpf && r.dataNascimento && r.localNascimento && ((r.nomePai && r.nomeMae) || (r.filiacaoUnica && (r.nomePai || r.nomeMae))));

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
function prepararParaOCR(img: CanvasImageSource & { width: number; height: number }): HTMLCanvasElement {
  const escala = Math.max(0.3, Math.min(3, 1900 / img.width, 2400 / Math.max(img.width, img.height)));
  const c = document.createElement("canvas");
  c.width = Math.round(img.width * escala); c.height = Math.round(img.height * escala);
  const ctx = c.getContext("2d")!;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, 0, 0, c.width, c.height);
  const d = ctx.getImageData(0, 0, c.width, c.height), p = d.data;
  for (let i = 0; i < p.length; i += 4) { const g = 0.299 * p[i] + 0.587 * p[i + 1] + 0.114 * p[i + 2]; p[i] = p[i + 1] = p[i + 2] = g; }
  ctx.putImageData(d, 0, 0);
  return c;
}

// JPEGs embutidos no PDF (CNH-e e CIN digital trazem frente/verso como imagem), sem QR codes nem ícones
async function jpegsDoPDF(L: any, bytes: Uint8Array): Promise<Blob[]> {
  const doc = await L.PDFDocument.load(bytes, { ignoreEncryption: true });
  const N = (s: string) => L.PDFName.of(s);
  const out: Blob[] = [], vistos = new Set<string>();
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
      if (sub !== N("Image") || d.get(N("Filter")) !== N("DCTDecode")) continue;
      const w = d.get(N("Width"))?.asNumber?.() ?? 0, h = d.get(N("Height"))?.asNumber?.() ?? 0;
      if (w < 400 || h < 250 || (w / h > 0.85 && w / h < 1.18)) continue;
      out.push(new Blob([st.contents], { type: "image/jpeg" }));
    }
  };
  for (const page of doc.getPages().slice(0, 3)) visitar(page.node.Resources(), 0);
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
      const linhas = new Map<number, { x: number; s: string }[]>();
      for (const it of tc.items as { str: string; transform: number[] }[]) {
        if (!it.str?.trim()) continue;
        const y = Math.round(it.transform[5] / 3);
        (linhas.get(y) ?? linhas.set(y, []).get(y)!).push({ x: it.transform[4], s: it.str });
      }
      for (const y of [...linhas.keys()].sort((a, b) => b - a)) texto += linhas.get(y)!.sort((a, b) => a.x - b.x).map(i => i.s).join(" ") + "\n";
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

// ─── Leitura completa ───────────────────────────────────────────────────────

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
      mesclar(r, extrairCampos(texto));
      if (!imagens.length) imagens = paginas;
    } else {
      const u = URL.createObjectURL(file); urls.push(u);
      imagens = [await carregarImagem(u)];
    }
    if (completo(r) || !imagens.length) return r;

    const Tesseract = await tesseractPromise;
    progresso?.("Preparando leitura...");
    const worker = await Tesseract.createWorker("por");
    try {
      const preparadas = imagens.map(prepararParaOCR);
      // 1ª passada como bloco único (lê melhor acentos); se faltar algo, 2ª como texto esparso (melhor em fundo colorido)
      for (const [passada, psm] of [[1, "6"], [2, "11"]] as const) {
        await worker.setParameters({ tessedit_pageseg_mode: psm });
        for (let i = 0; i < preparadas.length && !completo(r); i++) {
          progresso?.(`Lendo documento... ${passada === 1 ? "" : "(revisão) "}${i + 1}/${preparadas.length}`);
          const { data } = await worker.recognize(preparadas[i]);
          textos.push(data.text);
          mesclar(r, extrairCampos(data.text));
          mesclar(mrz, lerMRZ(data.text));
        }
        if (completo(r)) break;
      }
    } finally {
      await worker.terminate();
    }
    if (!r.nome && mrz.nome) r.nome = nomeComAcento(mrz.nome, textos);
    mesclar(r, mrz);
    if (r.rgEhCpf && r.cpf) r.rg ||= r.cpf;
    return r;
  } finally {
    urls.forEach(u => URL.revokeObjectURL(u));
  }
}
