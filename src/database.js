/**
 * Camada de banco de dados (MariaDB).
 *
 * As tabelas NÃO são criadas automaticamente aqui.
 * O aluno (ou o instrutor) roda o script:
 *
 *   mysql -u root < sql/create-database.sql
 *
 * As credenciais vêm do .env:
 *   DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME
 *
 * Na aula, o usuário é root e a senha fica vazia.
 */

const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  // Senha vazia é válida: no .env da aula, root não tem senha.
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'cruso_setec',
  waitForConnections: true,
  connectionLimit: 10,
});

/**
 * Testa a conexão na subida do servidor.
 * Se o MariaDB estiver desligado ou o banco ainda não existir,
 * o erro aparece logo, e não só na primeira tela.
 */
async function testConnection() {
  const connection = await pool.getConnection();
  connection.release();
}

// ---------------------------------------------------------------------------
// Usuários
// ---------------------------------------------------------------------------

async function createUser({ name, email, passwordHash }) {
  const [result] = await pool.execute(
    `
      INSERT INTO users (name, email, password_hash)
      VALUES (?, ?, ?)
    `,
    [name, email, passwordHash]
  );

  return result.insertId;
}

async function findUserByEmail(email) {
  const [rows] = await pool.execute(
    `
      SELECT id, name, email, password_hash, created_at
      FROM users
      WHERE email = ?
    `,
    [email]
  );

  return rows[0] || null;
}

async function findUserById(id) {
  const [rows] = await pool.execute(
    `
      SELECT id, name, email, created_at
      FROM users
      WHERE id = ?
    `,
    [id]
  );

  return rows[0] || null;
}

async function updateUserPassword(userId, passwordHash) {
  await pool.execute(
    `
      UPDATE users
      SET password_hash = ?
      WHERE id = ?
    `,
    [passwordHash, userId]
  );
}

// ---------------------------------------------------------------------------
// Recuperação de senha (OTP)
// ---------------------------------------------------------------------------

/**
 * Quando o usuário pede um código novo, os códigos antigos
 * deixam de valer. Marcamos used_at para "queimar" os anteriores.
 */
async function invalidatePreviousCodes(userId) {
  await pool.execute(
    `
      UPDATE password_resets
      SET used_at = NOW()
      WHERE user_id = ?
        AND used_at IS NULL
    `,
    [userId]
  );
}

async function createPasswordReset({ userId, code, expiresAt }) {
  const [result] = await pool.execute(
    `
      INSERT INTO password_resets (user_id, code, expires_at)
      VALUES (?, ?, ?)
    `,
    [userId, code, expiresAt]
  );

  return result.insertId;
}

/**
 * Busca o código mais recente daquele usuário que ainda não foi marcado como usado.
 * Na prática, depois de invalidar os anteriores, só deve existir um ativo.
 */
async function findActiveResetByUserId(userId) {
  const [rows] = await pool.execute(
    `
      SELECT id, user_id, code, expires_at, used_at, attempts, created_at
      FROM password_resets
      WHERE user_id = ?
        AND used_at IS NULL
      ORDER BY created_at DESC
      LIMIT 1
    `,
    [userId]
  );

  return rows[0] || null;
}

async function incrementResetAttempts(resetId) {
  await pool.execute(
    `
      UPDATE password_resets
      SET attempts = attempts + 1
      WHERE id = ?
    `,
    [resetId]
  );
}

/**
 * Marca o código como utilizado.
 * A partir daqui ele não pode mais redefinir a senha.
 */
async function markResetAsUsed(resetId) {
  await pool.execute(
    `
      UPDATE password_resets
      SET used_at = NOW()
      WHERE id = ?
    `,
    [resetId]
  );
}

module.exports = {
  pool,
  testConnection,
  createUser,
  findUserByEmail,
  findUserById,
  updateUserPassword,
  invalidatePreviousCodes,
  createPasswordReset,
  findActiveResetByUserId,
  incrementResetAttempts,
  markResetAsUsed,
};
