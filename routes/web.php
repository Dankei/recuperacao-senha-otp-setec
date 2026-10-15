<?php

use App\Http\Controllers\ApiController;
use App\Http\Middleware\RequireAuth;
use Illuminate\Support\Facades\Route;

/**
 * Ponto de entrada HTTP.
 *
 * Ordem que importa para a aula:
 * 1. A raiz manda para a home (se logado) ou para o login
 * 2. /home.html exige sessão — por isso a página NÃO fica solta em public/
 * 3. As outras páginas HTML são servidas por rota, com a mesma URL de antes
 * 4. CSS e JS continuam em public/ e o servidor entrega direto, sem passar aqui
 * 5. Todas as rotas da API começam com /api
 *
 * O cookie de sessão, o JSON e a exceção de CSRF do /api ficam em bootstrap/app.php.
 */

Route::get('/', function () {
    if (session()->has('userId')) {
        return redirect('/home.html');
    }

    return redirect('/login.html');
});

// A home só faz sentido com alguém logado.
Route::get('/home.html', function () {
    return response()->file(resource_path('pages/home.html'));
})->middleware(RequireAuth::class);

Route::get('/login.html', function () {
    return response()->file(resource_path('pages/login.html'));
});

Route::get('/register.html', function () {
    return response()->file(resource_path('pages/register.html'));
});

Route::get('/forgot-password.html', function () {
    return response()->file(resource_path('pages/forgot-password.html'));
});

Route::get('/verify-code.html', function () {
    return response()->file(resource_path('pages/verify-code.html'));
});

Route::get('/reset-password.html', function () {
    return response()->file(resource_path('pages/reset-password.html'));
});

Route::post('/api/register', [ApiController::class, 'register']);
Route::post('/api/login', [ApiController::class, 'login']);
Route::post('/api/logout', [ApiController::class, 'logout']);
Route::get('/api/me', [ApiController::class, 'me'])->middleware(RequireAuth::class);
Route::post('/api/forgot-password', [ApiController::class, 'forgotPassword']);
Route::post('/api/verify-code', [ApiController::class, 'verifyCode']);
Route::post('/api/reset-password', [ApiController::class, 'resetPassword']);
