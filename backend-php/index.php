<?php

declare(strict_types=1);

require_once __DIR__ . '/database.php';

session_name('connect.sid');
session_start();

header('Content-Type: application/json; charset=utf-8');

function response(array $data, int $status = 200): never
{
    http_response_code($status);
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

function body(): array
{
    $content = file_get_contents('php://input');

    if (!$content) {
        return [];
    }

    return json_decode($content, true) ?? [];
}

function requestPath(): string
{
    return parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH) ?? '/';
}

$method = $_SERVER['REQUEST_METHOD'];
$path = requestPath();

if ($method === 'GET' && $path === '/api/me') {
    if (!isset($_SESSION['userId'])) {
        response(['error' => 'Você precisa estar logado.'], 401);
    }

    $statement = db()->prepare(
        'SELECT id, name, email, created_at FROM users WHERE id = ?'
    );

    $statement->execute([$_SESSION['userId']]);
    $user = $statement->fetch();

    if (!$user) {
        response(['error' => 'Sessão inválida.'], 401);
    }

    response(['user' => $user]);
}

if ($method === 'POST' && $path === '/api/logout') {
    session_destroy();

    response([
        'message' => 'Você saiu da conta.'
    ]);
}

response([
    'error' => 'Rota não encontrada.'
], 404);