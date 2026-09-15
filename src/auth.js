/**
 * Autenticação por sessão.
 *
 * Depois do login, o Express grava o id do usuário em req.session.userId.
 * Esse valor viaja em um cookie HttpOnly (o JavaScript da página não lê o cookie).
 *
 * Os middlewares abaixo só checam se essa sessão existe.
 * Eles não conhecem senha, OTP nem banco — só a sessão.
 */

/**
 * Usado nas rotas da API que exigem usuário logado (ex.: GET /api/me).
 * Se não houver sessão, devolve 401 para o frontend redirecionar ao login.
 */
function requireAuth(req, res, next) {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Você precisa estar logado.' });
  }

  next();
}

/**
 * Usado na página HTML da área logada.
 * Se o aluno abrir /home.html sem sessão, mandamos de volta ao login.
 */
function requirePageAuth(req, res, next) {
  if (!req.session.userId) {
    return res.redirect('/login.html');
  }

  next();
}

module.exports = {
  requireAuth,
  requirePageAuth,
};
