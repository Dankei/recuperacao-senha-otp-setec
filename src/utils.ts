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

import crypto from 'crypto';
import bcrypt from 'bcryptjs';

// Quantas "rodadas" o bcrypt usa para gerar o hash.
// Quanto maior, mais lento (e mais seguro contra força bruta).
// 10 é um valor didático e aceitável para um projeto de aula.
export const SALT_ROUNDS = 10;

// Tamanho mínimo da senha. Em sistemas reais costuma ser maior
// e incluir regras extras (letra, número, símbolo).
export const MIN_PASSWORD_LENGTH = 6;

// OTP vale por 10 minutos a partir do momento em que foi gerado.
export const OTP_VALIDITY_MINUTES = 10;

// Depois de 5 tentativas erradas, o código deixa de ser aceito.
export const OTP_MAX_ATTEMPTS = 5;

/**
 * Gera um código numérico de 6 dígitos.
 *
 * Usamos crypto.randomInt (e não Math.random) porque o OTP
 * é um segredo temporário: precisa ser imprevisível.
 *
 * randomInt(min, max) inclui o min e exclui o max.
 * Então 100000 até 1000000 gera números de 100000 a 999999.
 */
export function generateOtp() {
  return String(crypto.randomInt(100000, 1000000));
}

/**
 * Formata uma data no padrão DATETIME do MariaDB: YYYY-MM-DD HH:MM:SS
 */
function toMysqlDateTime(date: Date) {
  const pad = (value: number) => String(value).padStart(2, '0');

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
export function getOtpExpirationDate() {
  const expires = new Date();
  expires.setMinutes(expires.getMinutes() + OTP_VALIDITY_MINUTES);
  return toMysqlDateTime(expires);
}

/**
 * Transforma a senha original em um hash.
 *
 * Nunca gravamos a senha em texto puro no banco.
 * O bcrypt já inclui um "sal" aleatório dentro do hash,
 * então duas pessoas com a mesma senha terão hashes diferentes.
 */
export function hashPassword(password: string) {
  return bcrypt.hashSync(password, SALT_ROUNDS);
}

/**
 * Compara a senha digitada no login com o hash salvo no banco.
 * Retorna true somente se for a mesma senha.
 */
export function comparePassword(password: string, passwordHash: string) {
  return bcrypt.compareSync(password, passwordHash);
}

/**
 * Validação simples de e-mail.
 * Não precisa ser perfeita: o objetivo é barrar textos claramente inválidos.
 */
export function isValidEmail(email: any) {
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
export function validateRegisterInput({ name, email, password, confirmPassword }: any) {
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
export function validateNewPassword({ password, confirmPassword }: any) {
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
export function normalizeEmail(email: any) {
  return String(email || '').trim().toLowerCase();
}

/**
 * Confere se o código OTP ainda pode ser usado.
 * Cobre os três casos mais importantes da aula:
 * - já foi usado
 * - passou do prazo
 * - estourou o limite de tentativas
 */
export function getOtpError(reset: any) {
  if (!reset) {
    return 'Código inválido ou expirado.';
  }

  // used_at preenchido = código já foi consumido na troca de senha
  if (reset.used_at) {
    return 'Este código já foi utilizado. Solicite um novo.';
  }

  if (new Date(reset.expires_at) < new Date()) {
    return 'Este código expirou. Solicite um novo.';
  }

  if (reset.attempts >= OTP_MAX_ATTEMPTS) {
    return 'Número de tentativas excedido. Solicite um novo código.';
  }

  return null;
}
