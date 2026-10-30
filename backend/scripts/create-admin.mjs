// Cria (ou redefine a senha de) um usuario administrador/desenvolvedor.
// Uso: ADMIN_USERNAME=fulano ADMIN_PASSWORD='senha-forte' [ADMIN_ROLE=desenvolvedor] npm run create-admin --workspace=backend
import process from 'node:process';
import bcrypt from 'bcryptjs';
import pg from 'pg';

const username = (process.env.ADMIN_USERNAME ?? process.argv[2] ?? '').trim();
const password = process.env.ADMIN_PASSWORD ?? '';
const role = process.env.ADMIN_ROLE ?? 'desenvolvedor';
const name = process.env.ADMIN_NAME ?? username;

if (!username || password.length < 8) {
  console.error('Informe ADMIN_USERNAME e ADMIN_PASSWORD (minimo 8 caracteres).');
  process.exit(1);
}
if (!['desenvolvedor', 'admin'].includes(role)) {
  console.error('ADMIN_ROLE deve ser "desenvolvedor" ou "admin".');
  process.exit(1);
}

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL ?? 'postgresql://sescinc:sescinc_password@localhost:5432/sescinc',
});

try {
  const hash = await bcrypt.hash(password, 12);
  const result = await pool.query(
    `INSERT INTO usuarios (username, name, password, role, senha_hash, created_at, updated_at)
     VALUES ($1, $2, '', $3, $4, now(), now())
     ON CONFLICT (username) DO UPDATE SET senha_hash = EXCLUDED.senha_hash, password = '', role = EXCLUDED.role, updated_at = now()
     RETURNING username, role`,
    [username, name, role, hash],
  );
  console.log(`Usuario ${result.rows[0].username} pronto com funcao ${result.rows[0].role}.`);
} finally {
  await pool.end();
}
