import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import { fileURLToPath } from "url";
import { createWriteStream } from "fs";
import archiver from "archiver";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const SUPABASE_URL = "https://qubkmecpxbsdphtmwvvw.supabase.co";
const SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF1YmttZWNweGJzZHBodG13dnZ3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDE0Mjk0MiwiZXhwIjoyMDg5NzE4OTQyfQ.lfdJ0AoAqNIKWtJVFHk9IbIw887ADgOl6nUcBMEVNsA";

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

const BACKUP_DIR = "C:/Users/Operador M.D/Downloads/rwinvestimentos_backup";
const SQL_DIR = path.join(BACKUP_DIR, "database");

function escapeSQL(val) {
  if (val === null || val === undefined) return "NULL";
  if (typeof val === "boolean") return val ? "TRUE" : "FALSE";
  if (typeof val === "number") return String(val);
  if (typeof val === "object") return `'${JSON.stringify(val).replace(/'/g, "''")}'`;
  return `'${String(val).replace(/'/g, "''")}'`;
}

async function exportTable(tableName, schema = "public") {
  console.log(`  Exportando ${tableName}...`);
  let allRows = [];
  let from = 0;
  const batchSize = 1000;

  while (true) {
    const { data, error } = await supabase
      .schema(schema)
      .from(tableName)
      .select("*")
      .range(from, from + batchSize - 1);

    if (error) {
      console.warn(`    Aviso: ${tableName} - ${error.message}`);
      break;
    }
    if (!data || data.length === 0) break;
    allRows = allRows.concat(data);
    if (data.length < batchSize) break;
    from += batchSize;
  }

  if (allRows.length === 0) return `-- Tabela ${tableName}: sem dados\n\n`;

  const cols = Object.keys(allRows[0]);
  const insertLines = allRows.map(row => {
    const vals = cols.map(c => escapeSQL(row[c])).join(", ");
    return `  (${vals})`;
  });

  return [
    `-- Tabela: ${tableName} (${allRows.length} registros)`,
    `INSERT INTO ${schema === "public" ? "" : schema + "."}${tableName} (${cols.map(c => `"${c}"`).join(", ")}) VALUES`,
    insertLines.join(",\n"),
    "ON CONFLICT DO NOTHING;",
    "",
  ].join("\n") + "\n";
}

async function exportAuthUsers() {
  console.log("  Exportando auth.users...");
  const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users?page=1&per_page=1000`, {
    headers: {
      "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
      "apikey": SERVICE_ROLE_KEY,
    },
  });
  const data = await res.json();
  const users = data.users || [];
  console.log(`    ${users.length} usuários encontrados`);

  const lines = ["-- ================================================"];
  lines.push("-- AUTH USERS (para referência - não importar diretamente)");
  lines.push("-- Use o Supabase Dashboard > Authentication para recriar");
  lines.push("-- ================================================");
  lines.push("");

  users.forEach(u => {
    lines.push(`-- Usuário: ${u.email} | ID: ${u.id} | Criado: ${u.created_at}`);
    lines.push(`-- Role: ${u.role || "authenticated"} | Confirmado: ${u.email_confirmed_at ? "sim" : "não"}`);
    lines.push("");
  });

  return { sql: lines.join("\n") + "\n", users };
}

async function main() {
  console.log("🔄 Iniciando backup completo do RW Investimentos...\n");

  // Criar diretórios
  if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });
  if (!fs.existsSync(SQL_DIR)) fs.mkdirSync(SQL_DIR, { recursive: true });

  // ── 1. EXPORTAR DADOS DO BANCO ──
  console.log("📦 Exportando dados do banco de dados...");

  const tables = [
    "profiles",
    "subscriptions",
    "wallets",
    "delay_clientes",
    "delay_transacoes",
    "delay_share_links",
    "notifications",
    "email_queue",
    "clientes",
    "emprestimos",
    "transacoes",
  ];

  let fullSQL = `-- ================================================
-- BACKUP COMPLETO: RW Investimentos
-- Data: ${new Date().toISOString()}
-- Projeto Supabase: qubkmecpxbsdphtmwvvw
-- ================================================
-- INSTRUÇÕES DE IMPORTAÇÃO:
-- 1. Crie novo projeto no Supabase
-- 2. Execute primeiro o schema (schema.sql)
-- 3. Depois execute este arquivo (data.sql)
-- ================================================

SET session_replication_role = replica; -- desabilita foreign keys temporariamente

`;

  // Exportar auth users
  const { sql: authSQL, users } = await exportAuthUsers();
  fullSQL += authSQL;

  // Exportar tabelas
  for (const table of tables) {
    try {
      const sql = await exportTable(table);
      fullSQL += sql;
    } catch (e) {
      console.warn(`  Tabela ${table} não encontrada, pulando...`);
    }
  }

  fullSQL += "\nSET session_replication_role = DEFAULT;\n";

  fs.writeFileSync(path.join(SQL_DIR, "data.sql"), fullSQL, "utf8");
  console.log(`  ✅ data.sql gerado\n`);

  // ── 2. EXPORTAR SCHEMA DAS MIGRATIONS ──
  console.log("📋 Exportando schema das migrations...");
  const migrationsDir = path.join(__dirname, "supabase", "migrations");
  let schemaSQL = `-- ================================================
-- SCHEMA: RW Investimentos
-- Execute este arquivo ANTES do data.sql
-- ================================================\n\n`;

  if (fs.existsSync(migrationsDir)) {
    const migFiles = fs.readdirSync(migrationsDir).sort();
    for (const f of migFiles) {
      if (f.endsWith(".sql")) {
        schemaSQL += `-- Migration: ${f}\n`;
        schemaSQL += fs.readFileSync(path.join(migrationsDir, f), "utf8");
        schemaSQL += "\n\n";
      }
    }
    console.log(`  ${migFiles.length} migrations incluídas`);
  } else {
    schemaSQL += "-- Nenhuma migration encontrada\n";
  }

  fs.writeFileSync(path.join(SQL_DIR, "schema.sql"), schemaSQL, "utf8");
  console.log(`  ✅ schema.sql gerado\n`);

  // ── 3. EXPORTAR EDGE FUNCTIONS ──
  console.log("⚡ Copiando edge functions...");
  const functionsDir = path.join(__dirname, "supabase", "functions");
  const backupFunctionsDir = path.join(BACKUP_DIR, "supabase", "functions");
  if (fs.existsSync(functionsDir)) {
    copyDirSync(functionsDir, backupFunctionsDir);
    console.log("  ✅ Edge functions copiadas\n");
  }

  // ── 4. COPIAR CÓDIGO FONTE FRONTEND ──
  console.log("💻 Copiando código fonte frontend...");
  const srcDir = path.join(__dirname, "src");
  copyDirSync(srcDir, path.join(BACKUP_DIR, "src"));

  const publicDir = path.join(__dirname, "public");
  if (fs.existsSync(publicDir)) copyDirSync(publicDir, path.join(BACKUP_DIR, "public"));

  const filesToCopy = [
    "package.json", "package-lock.json", "vite.config.ts",
    "tailwind.config.ts", "tsconfig.json", "tsconfig.app.json",
    "tsconfig.node.json", "components.json", "postcss.config.js",
    "eslint.config.js", "index.html",
  ];

  for (const f of filesToCopy) {
    const src = path.join(__dirname, f);
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, path.join(BACKUP_DIR, f));
    }
  }
  console.log("  ✅ Frontend copiado\n");

  // ── 5. GERAR README ──
  const readme = `# Backup RW Investimentos
Data: ${new Date().toLocaleString("pt-BR")}

## Conteúdo
- \`src/\` — Código fonte React/TypeScript
- \`public/\` — Arquivos públicos (logos, etc.)
- \`supabase/functions/\` — Edge Functions Supabase
- \`database/schema.sql\` — Schema do banco (rodar PRIMEIRO)
- \`database/data.sql\` — Dados de usuários e clientes (rodar DEPOIS)
- \`package.json\` — Dependências do projeto

## Como importar no Lovable
1. Crie um novo projeto no Lovable
2. Crie um projeto no Supabase
3. No Supabase: SQL Editor → execute \`schema.sql\`
4. No Supabase: SQL Editor → execute \`data.sql\`
5. Faça upload das edge functions em Supabase > Edge Functions
6. No Lovable: importe o código da pasta \`src/\`

## Usuários (${users.length} cadastrados)
${users.map(u => `- ${u.email} (${u.id})`).join("\n")}
`;

  fs.writeFileSync(path.join(BACKUP_DIR, "README.md"), readme, "utf8");

  // ── 6. CRIAR ZIP FINAL ──
  console.log("🗜️  Criando arquivo ZIP...");
  const zipPath = "C:/Users/Operador M.D/Downloads/rwinvestimentos_backup_completo.zip";
  await createZip(BACKUP_DIR, zipPath);
  console.log(`  ✅ ZIP criado: ${zipPath}\n`);

  const stats = fs.statSync(zipPath);
  const sizeMB = (stats.size / 1024 / 1024).toFixed(1);
  console.log(`✅ BACKUP CONCLUÍDO!`);
  console.log(`   Arquivo: ${zipPath}`);
  console.log(`   Tamanho: ${sizeMB} MB`);
  console.log(`   Usuários: ${users.length}`);
}

function copyDirSync(src, dest) {
  if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirSync(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function createZip(sourceDir, outputPath) {
  return new Promise((resolve, reject) => {
    const output = createWriteStream(outputPath);
    const archive = archiver("zip", { zlib: { level: 9 } });
    output.on("close", resolve);
    archive.on("error", reject);
    archive.pipe(output);
    archive.directory(sourceDir, false);
    archive.finalize();
  });
}

main().catch(console.error);
