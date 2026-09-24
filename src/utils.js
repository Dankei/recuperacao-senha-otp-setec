/**
 * Utilitários do projeto.
 *
 * Este arquivo concentra funções pequenas e reutilizáveis:
 * - gerar o código OTP
 * - validar dados que chegam do formulário
 * - transformar senha em hash (e comparar depois)
 *
 * Separar isso das rotas deixa a aula mais fácil de acompanhar:
 * a rota decide o fluxo; os utilitários fazem o "como".
 */

const crypto = require('crypto');
// bcryptjs é o mesmo algoritmo do bcrypt, mas em JavaScript puro.
// Assim o aluno não precisa compilar um módulo nativo na hora da aula.
const bcrypt = require('bcryptjs');

// Quantas "rodadas" o bcrypt usa para gerar o hash.
// Quanto maior, mais lento (e mais seguro contra força bruta).
// 10 é um valor didático e aceitável para um projeto de aula.
const SALT_ROUNDS = 10;

// Tamanho mínimo da senha. Em sistemas reais costuma ser maior
// e incluir regras extras (letra, número, símbolo).
const MIN_PASSWORD_LENGTH = 6;

// OTP vale por 10 minutos a partir do momento em que foi gerado.
const OTP_VALIDITY_MINUTES = 10;

// Depois de 5 tentativas erradas, o código deixa de ser aceito.
const OTP_MAX_ATTEMPTS = 5;

/**
 * Gera um código numérico de 6 dígitos.
 *
 * Usamos crypto.randomInt (e não Math.random) porque o OTP
 * é um segredo temporário: precisa ser imprevisível.
 *
 * randomInt(min, max) inclui o min e exclui o max.
 * Então 100000 até 1000000 gera números de 100000 a 999999.
 */
function generateOtp() {
  // AULA: retornar um código numérico de 6 dígitos, como string.
  // Usar crypto.randomInt, não Math.random: o OTP é um segredo temporário.
}

/**
 * Formata uma data no padrão DATETIME do MariaDB: YYYY-MM-DD HH:MM:SS
 */
function toMysqlDateTime(date) {
  const pad = (value) => String(value).padStart(2, '0');

  return [
    date.getFullYear(),
    '-',
    pad(date.getMonth() + 1),
    '-',
    pad(date.getDate()),
    ' ',
    pad(date.getHours()),
    ':',
    pad(date.getMinutes()),
    ':',
    pad(date.getSeconds()),
  ].join('');
}

/**
 * Calcula a data/hora em que o OTP expira.
 * Guardamos no formato DATETIME do MariaDB para gravar em expires_at.
 */
function getOtpExpirationDate() {
  // AULA: somar OTP_VALIDITY_MINUTES à data atual
  // e devolver no formato DATETIME do MariaDB (toMysqlDateTime).
}

/**
 * Transforma a senha original em um hash.
 *
 * Nunca gravamos a senha em texto puro no banco.
 * O bcrypt já inclui um "sal" aleatório dentro do hash,
 * então duas pessoas com a mesma senha terão hashes diferentes.
 */
function hashPassword(password) {
  return bcrypt.hashSync(password, SALT_ROUNDS);
}

/**
 * Compara a senha digitada no login com o hash salvo no banco.
 * Retorna true somente se for a mesma senha.
 */
function comparePassword(password, passwordHash) {
  return bcrypt.compareSync(password, passwordHash);
}

/**
 * Validação simples de e-mail.
 * Não precisa ser perfeita: o objetivo é barrar textos claramente inválidos.
 */
function isValidEmail(email) {
  if (typeof email !== 'string') {
    return false;
  }

  const trimmed = email.trim();
  // Exemplo aceito: nome@dominio.com
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
}

/**
 * Valida o cadastro (ou a troca de senha) antes de falar com o banco.
 * Devolve uma string de erro para mostrar ao aluno, ou null se estiver ok.
 */
function validateRegisterInput({ name, email, password, confirmPassword }) {
  if (!name || !String(name).trim()) {
    return 'Informe o nome.';
  }

  if (!isValidEmail(email)) {
    return 'Informe um e-mail válido.';
  }

  if (!password || String(password).length < MIN_PASSWORD_LENGTH) {
    return `A senha deve ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`;
  }

  if (password !== confirmPassword) {
    return 'A senha e a confirmação não coincidem.';
  }

  return null;
}

/**
 * Valida só a nova senha (usado em "Redefinir senha").
 */
function validateNewPassword({ password, confirmPassword }) {
  if (!password || String(password).length < MIN_PASSWORD_LENGTH) {
    return `A senha deve ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`;
  }

  if (password !== confirmPassword) {
    return 'A senha e a confirmação não coincidem.';
  }

  return null;
}

/**
 * Normaliza o e-mail: tira espaços e deixa em minúsculas.
 * Assim "Daniel@Email.com" e "daniel@email.com" viram a mesma conta.
 */
function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

/**
 * Confere se o código OTP ainda pode ser usado.
 * Cobre os três casos mais importantes da aula:
 * - já foi usado
 * - passou do prazo
 * - estourou o limite de tentativas
 */
function getOtpError(reset) {
  // AULA: devolver uma mensagem de erro, ou null se o código ainda vale.
  // Recusar quando não há reset, used_at está preenchido,
  // expires_at já passou, ou attempts >= OTP_MAX_ATTEMPTS.
}

module.exports = {
  generateOtp,
  getOtpExpirationDate,
  hashPassword,
  comparePassword,
  isValidEmail,
  validateRegisterInput,
  validateNewPassword,
  normalizeEmail,
  getOtpError,
  OTP_VALIDITY_MINUTES,
  OTP_MAX_ATTEMPTS,
  MIN_PASSWORD_LENGTH,
};
