/**
 * Autenticação por sessão.
 *
 * Depois do login, o Express grava o id do usuário em req.session.userId.
 * Esse valor viaja em um cookie HttpOnly (o JavaScript da página não lê o cookie).
 *
 * Os middlewares abaixo só checam se essa sessão existe.
 * Eles não conhecem senha, OTP nem banco — só a sessão.
 */

import { Request, Response, NextFunction } from 'express';

/**
 * Usado nas rotas da API que exigem usuário logado (ex.: GET /api/me).
 * Se não houver sessão, devolve 401 para o frontend redirecionar ao login.
 */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!(req.session as any).userId) {
    return res.status(401).json({ error: 'Você precisa estar logado.' });
  }

  next();
}

/**
 * Usado na página HTML da área logada.
 * Se o aluno abrir /home.html sem sessão, mandamos de volta ao login.
 */
export function requirePageAuth(req: Request, res: Response, next: NextFunction) {
  if (!(req.session as any).userId) {
    return res.redirect('/login.html');
  }

  next();
}
