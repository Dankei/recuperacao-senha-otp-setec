<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Autenticação por sessão.
 *
 * Depois do login, gravamos o id do usuário em session('userId').
 * Esse valor viaja em um cookie HttpOnly (o JavaScript da página não lê o cookie).
 *
 * Este middleware só checa se essa sessão existe.
 * Ele não conhece senha, OTP nem banco — só a sessão.
 */
class RequireAuth
{
    public function handle(Request $request, Closure $next): Response
    {
        if (! $request->session()->has('userId')) {
            // Rotas da API (ex.: GET /api/me) devolvem 401 para o frontend ir ao login.
            if ($request->is('api/*')) {
                return response()->json([
                    'error' => 'Você precisa estar logado.',
                ], 401);
            }

            // A página da área logada, sem sessão, volta para o login.
            return redirect('/login.html');
        }

        return $next($request);
    }
}
