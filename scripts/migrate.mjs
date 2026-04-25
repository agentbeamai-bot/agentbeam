#!/usr/bin/env node

/**
 * AgentBeam database migration runner.
 *
 * Reads .sql files from supabase/migrations/ in sorted order and executes
 * each one against the Supabase Postgres database via `supabase db execute`.
 *
 * Prerequisites:
 *   - Supabase CLI installed and logged in (`supabase login`)
 *   - The project ref is extracted from NEXT_PUBLIC_SUPABASE_URL in .env
 *
 * Usage:
 *   node scripts/migrate.mjs
 */

import { readFileSync, readdirSync } from "fs";
import { execSync } from "child_process";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const migrationsDir = join(root, "supabase", "migrations");
const envPath = join(root, ".env");

// ---------------------------------------------------------------------------
// Parse .env (zero deps)
// ---------------------------------------------------------------------------
function loadEnv(filePath) {
  const vars = {};
  let content;
  try {
    content = readFileSync(filePath, "utf-8");
  } catch {
    console.error(`Could not read ${filePath}`);
    process.exit(1);
  }
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let value = trimmed.slice(eqIdx + 1).trim();
    // Strip surrounding quotes
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    vars[key] = value;
  }
  return vars;
}

// ---------------------------------------------------------------------------
// Extract Supabase project ref from URL
// ---------------------------------------------------------------------------
function extractProjectRef(url) {
  // URL looks like https://<ref>.supabase.co
  try {
    const hostname = new URL(url).hostname; // e.g. sctjpfsgjqjlxsubetef.supabase.co
    return hostname.split(".")[0];
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
const env = loadEnv(envPath);
const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;

if (!supabaseUrl) {
  console.error("NEXT_PUBLIC_SUPABASE_URL not found in .env");
  process.exit(1);
}

const projectRef = extractProjectRef(supabaseUrl);
if (!projectRef) {
  console.error(`Could not extract project ref from ${supabaseUrl}`);
  process.exit(1);
}

console.log(`Project ref: ${projectRef}\n`);

// Collect migration files
let files;
try {
  files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();
} catch {
  console.error(`Could not read migrations directory: ${migrationsDir}`);
  process.exit(1);
}

if (files.length === 0) {
  console.log("No migration files found.");
  process.exit(0);
}

let applied = 0;
let failed = 0;

for (const file of files) {
  const filePath = join(migrationsDir, file);
  const sql = readFileSync(filePath, "utf-8");

  console.log(`--- Applying: ${file} ---`);

  try {
    execSync(`supabase db query --linked -f "${filePath}"`, {
      stdio: "inherit",
      cwd: root,
    });
    applied++;
    console.log(`Applied: ${file}\n`);
  } catch {
    failed++;
    console.error(`FAILED: ${file}\n`);
    console.error("Stopping migration. Fix the issue and re-run.");
    process.exit(1);
  }
}

console.log(
  `\nDone. ${applied} migration(s) applied, ${failed} failed.`
);
