/**
 * Rotas da API.
 *
 * Cada função abaixo é um endpoint. A ideia da aula é ler
 * o fluxo de cima para baixo, sem camadas extras (service, controller...).
 *
 * Endpoints:
 *   POST /api/register
 *   POST /api/login
 *   POST /api/logout
 *   GET  /api/me
 *   POST /api/forgot-password
 *   POST /api/verify-code
 *   POST /api/reset-password
 */

import express, { Request, Response, NextFunction } from 'express';
import * as db from './database';
import { sendOtpEmail } from './email';
import { requireAuth } from './auth';
import {
  generateOtp,
  getOtpExpirationDate,
  hashPassword,
  comparePassword,
  isValidEmail,
  validateRegisterInput,
  validateNewPassword,
  normalizeEmail,
  getOtpError,
} from './utils';

const router = express.Router();

/**
 * Mensagem única para "esqueci minha senha".
 * Usamos a mesma frase quando o e-mail existe e quando não existe.
 * Assim um atacante não descobre quais contas estão cadastradas.
 */
const FORGOT_PASSWORD_MESSAGE =
  'Se existir uma conta para este e-mail, enviamos um código de verificação.';

/**
 * O MariaDB devolve Promise. Este helper pega erros de await
 * e responde 500, em vez de derrubar o servidor.
 */
function handle(fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      await fn(req, res, next);
    } catch (error) {
      console.error('Erro na rota.', error);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Erro interno. Tente novamente.' });
      }
    }
  };
}

// ---------------------------------------------------------------------------
// Cadastro
// ---------------------------------------------------------------------------

router.post('/register', handle(async (req, res) => {
  const { name, email, password, confirmPassword } = req.body;

  // 1) Valida os campos antes de tocar no banco.
  const validationError = validateRegisterInput({
    name,
    email,
    password,
    confirmPassword,
  });

  if (validationError) {
    return res.status(400).json({ error: validationError });
  }

  const normalizedEmail = normalizeEmail(email);

  // 2) Impede dois cadastros com o mesmo e-mail.
  const existing = await db.findUserByEmail(normalizedEmail);
  if (existing) {
    return res.status(400).json({ error: 'Já existe uma conta com este e-mail.' });
  }

  // 3) Grava somente o hash. A senha original não entra no banco.
  const passwordHash = hashPassword(password);

  await db.createUser({
    name: String(name).trim(),
    email: normalizedEmail,
    passwordHash,
  });

  return res.status(201).json({
    message: 'Conta criada com sucesso. Faça login para continuar.',
  });
}));

// ---------------------------------------------------------------------------
// Login / logout / usuário logado
// ---------------------------------------------------------------------------

router.post('/login', handle(async (req, res) => {
  const { email, password } = req.body;

  if (!isValidEmail(email) || !password) {
    return res.status(400).json({ error: 'Informe e-mail e senha.' });
  }

  const user: any = await db.findUserByEmail(normalizeEmail(email));

  // Mesma mensagem para "e-mail não existe" e "senha errada".
  // Isso também evita vazar se uma conta está cadastrada.
  if (!user || !comparePassword(password, user.password_hash)) {
    return res.status(401).json({ error: 'E-mail ou senha inválidos.' });
  }

  // Guarda só o id na sessão. O cookie é enviado automaticamente pelo navegador.
  (req.session as any).userId = user.id;

  return res.json({
    message: 'Login realizado com sucesso.',
    user: { id: user.id, name: user.name, email: user.email },
  });
}));

router.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: 'Não foi possível sair da conta.' });
    }

    // Apaga o cookie no navegador para a sessão não "voltar".
    res.clearCookie('connect.sid');
    return res.json({ message: 'Você saiu da conta.' });
  });
});

router.get('/me', requireAuth, handle(async (req, res) => {
  const user = await db.findUserById((req.session as any).userId);

  if (!user) {
    return res.status(401).json({ error: 'Sessão inválida.' });
  }

  return res.json({ user });
}));

// ---------------------------------------------------------------------------
// Recuperação de senha
// ---------------------------------------------------------------------------

router.post('/forgot-password', handle(async (req, res) => {
  const email = normalizeEmail(req.body.email);

  if (!isValidEmail(email)) {
    return res.status(400).json({ error: 'Informe um e-mail válido.' });
  }

  const user: any = await db.findUserByEmail(email);

  // Se não existir conta, respondemos OK do mesmo jeito.
  // Não geramos código e não enviamos e-mail.
  if (!user) {
    return res.json({ message: FORGOT_PASSWORD_MESSAGE });
  }

  // 1) Queima códigos antigos daquele usuário.
  await db.invalidatePreviousCodes(user.id);

  // 2) Gera um OTP de 6 dígitos e define a validade.
  const code = generateOtp();
  const expiresAt = getOtpExpirationDate();

  // 3) Salva o código no banco para validar depois.
  await db.createPasswordReset({
    userId: user.id,
    code,
    expiresAt,
  });

  // 4) Envia o e-mail (ou imprime no terminal, se SMTP não estiver no .env).
  try {
    await sendOtpEmail(user.email, code);
  } catch (error) {
    // Não devolvemos detalhes internos (senha, host, stack) para o navegador.
    console.error('Falha ao enviar e-mail de recuperação.');
    return res.status(500).json({
      error: 'Não foi possível enviar o e-mail. Tente novamente em instantes.',
    });
  }

  return res.json({ message: FORGOT_PASSWORD_MESSAGE });
}));

router.post('/verify-code', handle(async (req, res) => {
  const email = normalizeEmail(req.body.email);
  const code = String(req.body.code || '').trim();

  if (!isValidEmail(email) || !code) {
    return res.status(400).json({ error: 'Informe o e-mail e o código.' });
  }

  const user: any = await db.findUserByEmail(email);
  const reset: any = user ? await db.findActiveResetByUserId(user.id) : null;

  // Se o e-mail não existe, tratamos como código inválido.
  // De novo: não revelamos se a conta existe.
  const otpError = getOtpError(reset);
  if (otpError) {
    return res.status(400).json({ error: otpError });
  }

  // Código errado: incrementa tentativas e avisa.
  if (reset.code !== code) {
    await db.incrementResetAttempts(reset.id);

    const nextAttempts = reset.attempts + 1;
    if (nextAttempts >= 5) {
      return res.status(400).json({
        error: 'Número de tentativas excedido. Solicite um novo código.',
      });
    }

    return res.status(400).json({ error: 'Código incorreto.' });
  }

  // Código certo, ainda válido e não usado.
  // Ainda NÃO marcamos como usado: isso acontece só ao gravar a nova senha.
  return res.json({
    message: 'Código validado. Defina uma nova senha.',
  });
}));

router.post('/reset-password', handle(async (req, res) => {
  const email = normalizeEmail(req.body.email);
  const code = String(req.body.code || '').trim();
  const { password, confirmPassword } = req.body;

  const passwordError = validateNewPassword({ password, confirmPassword });
  if (passwordError) {
    return res.status(400).json({ error: passwordError });
  }

  if (!isValidEmail(email) || !code) {
    return res.status(400).json({ error: 'Informe o e-mail e o código.' });
  }

  const user: any = await db.findUserByEmail(email);
  const reset: any = user ? await db.findActiveResetByUserId(user.id) : null;
  const otpError = getOtpError(reset);

  if (otpError) {
    return res.status(400).json({ error: otpError });
  }

  // Revalidamos o código aqui. Assim ninguém pula a tela de verificação
  // e tenta trocar a senha direto com um código aleatório.
  if (reset.code !== code) {
    await db.incrementResetAttempts(reset.id);
    return res.status(400).json({ error: 'Código incorreto ou expirado.' });
  }

  // 1) Nova senha vira hash.
  const passwordHash = hashPassword(password);

  // 2) Atualiza a senha do usuário.
  await db.updateUserPassword(user.id, passwordHash);

  // 3) Queima o código: ele é de uso único.
  await db.markResetAsUsed(reset.id);

  return res.json({
    message: 'Senha redefinida com sucesso. Faça login com a nova senha.',
  });
}));

export default router;
