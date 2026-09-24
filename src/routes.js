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

const express = require('express');
const db = require('./database');
const { requireAuth } = require('./auth');
const {
  hashPassword,
  comparePassword,
  isValidEmail,
  validateRegisterInput,
  validateNewPassword,
  normalizeEmail,
} = require('./utils');

// AULA: quando o OTP estiver escrito, importe também:
// const { sendOtpEmail } = require('./email');
// generateOtp, getOtpExpirationDate e getOtpError, de ./utils

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
function handle(fn) {
  return async (req, res, next) => {
    try {
      await fn(req, res, next);
    } catch (error) {
      console.error('Erro na rota.');
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

  const user = await db.findUserByEmail(normalizeEmail(email));

  // Mesma mensagem para "e-mail não existe" e "senha errada".
  // Isso também evita vazar se uma conta está cadastrada.
  if (!user || !comparePassword(password, user.password_hash)) {
    return res.status(401).json({ error: 'E-mail ou senha inválidos.' });
  }

  // Guarda só o id na sessão. O cookie é enviado automaticamente pelo navegador.
  req.session.userId = user.id;

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
  const user = await db.findUserById(req.session.userId);

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

  const user = await db.findUserByEmail(email);

  // Se não existir conta, respondemos OK do mesmo jeito.
  // Não geramos código e não enviamos e-mail.
  if (!user) {
    return res.json({ message: FORGOT_PASSWORD_MESSAGE });
  }

  // AULA: o OTP entra aqui, só quando a conta existe.
  // 1. Invalidar códigos anteriores: db.invalidatePreviousCodes(user.id)
  // 2. Gerar o código e a validade: generateOtp() e getOtpExpirationDate()
  // 3. Salvar em password_resets: db.createPasswordReset({ userId, code, expiresAt })
  // 4. Enviar com sendOtpEmail(user.email, code)
  //    Se o envio falhar, responda 500 sem mostrar senha, host ou stack.
  // A resposta de sucesso é a mesma de quando o e-mail não existe.

  return res.json({ message: FORGOT_PASSWORD_MESSAGE });
}));

router.post('/verify-code', handle(async (req, res) => {
  const email = normalizeEmail(req.body.email);
  const code = String(req.body.code || '').trim();

  if (!isValidEmail(email) || !code) {
    return res.status(400).json({ error: 'Informe o e-mail e o código.' });
  }

  // AULA: validar o OTP aqui. Não diga se o e-mail existe.
  // 1. Buscar o usuário e o reset ativo (used_at nulo)
  // 2. getOtpError(reset): usado, expirado ou tentativas estouradas
  // 3. Se o código não bater, db.incrementResetAttempts e responder erro
  // 4. Se bater, responder sucesso. Ainda não marque como usado.
  // Sucesso: { message: 'Código validado. Defina uma nova senha.' }

  return res.status(400).json({ error: 'Código inválido ou expirado.' });
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

  // AULA: trocar a senha só depois de revalidar o OTP.
  // Quem pular a tela de verificação não pode acertar um código aleatório.
  // 1. Buscar usuário e reset ativo, e rodar getOtpError de novo
  // 2. Se o código não bater, incrementar tentativas e recusar
  // 3. hashPassword(password) e db.updateUserPassword
  // 4. db.markResetAsUsed: o código é de uso único
  // Sucesso: { message: 'Senha redefinida com sucesso. Faça login com a nova senha.' }

  return res.status(400).json({ error: 'Código inválido ou expirado.' });
}));

module.exports = router;
