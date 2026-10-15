<?php

use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        // O frontend (public/js/app.js) envia JSON sem token CSRF.
        // A sessão continua ativa porque as rotas estão no grupo web.
        // Só tiramos a checagem de CSRF das rotas /api.
        $middleware->validateCsrfTokens(except: [
            'api/*',
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->shouldRenderJsonWhen(
            fn (Request $request) => $request->is('api/*') || $request->expectsJson(),
        );

        // Erro inesperado na API vira uma frase genérica.
        // Não devolvemos stack trace nem detalhes do banco para o navegador.
        $exceptions->render(function (\Throwable $e, Request $request) {
            if ($request->is('api/*') && ! $e instanceof HttpExceptionInterface) {
                Log::error('Erro na rota.');

                return response()->json([
                    'error' => 'Erro interno. Tente novamente.',
                ], 500);
            }

            return null;
        });
    })->create();
