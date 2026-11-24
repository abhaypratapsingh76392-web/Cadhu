import { drizzle as drizzlePg, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import fs from "fs";
import os from "os";
import path from "path";
import * as schema from "./schema";

// Lazy DB client — NEVER throws at import/build time.
// 1) DATABASE_URL set (Render Blueprint / Neon / etc.) -> real Postgres (SSL auto)
// 2) DATABASE_URL missing -> embedded Postgres (PGlite) -> ZERO config, app turant chale
type DB = NodePgDatabase<typeof schema>;

const globalForDb = globalThis as typeof globalThis & {
  __cashpeDb?: DB;
  __cashpeDriver?: "postgres" | "pglite";
};

function createPg(): DB {
  const connectionString = process.env.DATABASE_URL as string;
  const isLocal = /localhost|127\.0\.0\.1/.test(connectionString);
  const sslDisabled = /sslmode=disable/.test(connectionString);
  const pool = new Pool({
    connectionString,
    max: 5,
    connectionTimeoutMillis: 15000,
    idleTimeoutMillis: 30000,
    ssl: !isLocal && !sslDisabled ? { rejectUnauthorized: false } : undefined,
  });
  pool.on("error", (err) => console.error("Postgres pool error:", err.message));
  return drizzlePg(pool, { schema });
}

function pgliteAssetsDir(): string {
  const candidates = [
    process.env.PGLITE_ASSETS_DIR || "",
    path.join(process.cwd(), "node_modules", "@electric-sql", "pglite", "dist"),
    path.join(process.cwd(), ".next", "standalone", "node_modules", "@electric-sql", "pglite", "dist"),
  ].filter(Boolean);
  for (const dir of candidates) {
    try {
      if (
        fs.existsSync(path.join(dir, "pglite.data")) &&
        fs.existsSync(path.join(dir, "pglite.wasm")) &&
        fs.existsSync(path.join(dir, "initdb.wasm"))
      )
        return dir;
    } catch {
      // try next
    }
  }
  throw new Error("PGlite assets (pglite.data / pglite.wasm / initdb.wasm) not found");
}

// Writable data dir choose karta hai — Docker/Render me /app non-root user
// ke liye writable nahi hota, isliye automatically /tmp par fallback karta hai.
function pickDataDir(): string {
  const prefs = [process.env.PGLITE_DATA_DIR, "./.cashpe-data", path.join(os.tmpdir(), "cashpe-pgdata")].filter(
    Boolean
  ) as string[];
  for (const dir of prefs) {
    try {
      fs.mkdirSync(dir, { recursive: true });
      const probe = path.join(dir, ".write-test");
      fs.writeFileSync(probe, "1");
      fs.unlinkSync(probe);
      return dir;
    } catch {
      // next candidate
    }
  }
  return path.join(os.tmpdir(), "cashpe-pgdata");
}

function createPglite(): DB {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { PGlite } = require("@electric-sql/pglite") as typeof import("@electric-sql/pglite");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { drizzle } = require("drizzle-orm/pglite") as typeof import("drizzle-orm/pglite");
  const dataDir = pickDataDir();
  // Bundled/standalone environments me PGlite apni files khud nahi dhoondh pata,
  // isliye fsBundle + WASM modules manually load karke dete hain.
  const assets = pgliteAssetsDir();
  const fsBundle = new Blob([fs.readFileSync(path.join(assets, "pglite.data"))]);
  const pgliteWasmModule = new WebAssembly.Module(fs.readFileSync(path.join(assets, "pglite.wasm")));
  const initdbWasmModule = new WebAssembly.Module(fs.readFileSync(path.join(assets, "initdb.wasm")));
  const client = new PGlite(dataDir, { fsBundle, pgliteWasmModule, initdbWasmModule });
  console.log("[CashPe] DATABASE_URL nahi mila — embedded database (PGlite) use ho raha hai:", dataDir);
  return drizzle(client, { schema }) as unknown as DB;
}

function getDb(): DB {
  if (!globalForDb.__cashpeDb) {
    if (process.env.DATABASE_URL) {
      globalForDb.__cashpeDriver = "postgres";
      globalForDb.__cashpeDb = createPg();
    } else {
      globalForDb.__cashpeDriver = "pglite";
      globalForDb.__cashpeDb = createPglite();
    }
  }
  return globalForDb.__cashpeDb;
}

// Proxy forwards every Drizzle call to the lazily-created instance.
export const db: DB = new Proxy({} as DB, {
  get(_target, prop) {
    const instance = getDb() as unknown as Record<string | symbol, unknown>;
    const value = instance[prop as string];
    return typeof value === "function"
      ? (value as (...args: unknown[]) => unknown).bind(instance)
      : value;
  },
});

export function databaseUrlSet(): boolean {
  return !!process.env.DATABASE_URL;
}

export function dbDriver(): string {
  getDb();
  return globalForDb.__cashpeDriver || "postgres";
}
