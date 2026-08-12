import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import pg from 'pg';

const { Pool } = pg;
const databaseUrl = process.env.DATABASE_URL ?? 'postgresql://sescinc:sescinc_password@localhost:5432/sescinc';
const migrationsDir = path.resolve(process.cwd(), 'database', 'migrations');
const benignErrorCodes = new Set([
  '42710', // duplicate_object
  '42P07', // duplicate_table
  '42701', // duplicate_column
  '42703', // undefined_column in legacy rename migrations
]);

function splitStatements(sql) {
  const statements = [];
  let current = '';
  let singleQuote = false;
  let doubleQuote = false;
  let dollarTag = null;

  for (let i = 0; i < sql.length; i += 1) {
    const char = sql[i];
    const rest = sql.slice(i);

    if (!singleQuote && !doubleQuote) {
      const dollarMatch = rest.match(/^\$[a-zA-Z0-9_]*\$/);
      if (dollarMatch) {
        const tag = dollarMatch[0];
        current += tag;
        i += tag.length - 1;
        if (dollarTag === tag) {
          dollarTag = null;
        } else if (!dollarTag) {
          dollarTag = tag;
        }
        continue;
      }
    }

    if (!dollarTag && char === "'" && !doubleQuote) {
      singleQuote = !singleQuote;
    } else if (!dollarTag && char === '"' && !singleQuote) {
      doubleQuote = !doubleQuote;
    }

    if (char === ';' && !singleQuote && !doubleQuote && !dollarTag) {
      const trimmed = current.trim();
      if (trimmed) statements.push(trimmed);
      current = '';
      continue;
    }

    current += char;
  }

  const trimmed = current.trim();
  if (trimmed) statements.push(trimmed);
  return statements;
}

async function main() {
  const pool = new Pool({ connectionString: databaseUrl });
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  const applied = await pool.query('SELECT filename FROM schema_migrations');
  const appliedSet = new Set(applied.rows.map((row) => row.filename));
  const files = (await readdir(migrationsDir)).filter((file) => file.endsWith('.sql')).sort();

  for (const file of files) {
    if (appliedSet.has(file)) {
      console.log(`skip ${file}`);
      continue;
    }

    console.log(`apply ${file}`);
    const sql = await readFile(path.join(migrationsDir, file), 'utf8');
    const statements = splitStatements(sql);

    for (const statement of statements) {
      try {
        await pool.query(statement);
      } catch (error) {
        if (benignErrorCodes.has(error.code)) {
          console.warn(`  tolerated ${error.code}: ${error.message.split('\n')[0]}`);
          continue;
        }
        console.error(`Migration failed in ${file}`);
        console.error(statement.slice(0, 500));
        throw error;
      }
    }

    await pool.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [file]);
  }

  await pool.end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
