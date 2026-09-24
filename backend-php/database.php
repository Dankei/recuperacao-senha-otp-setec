<?php

declare(strict_types=1);

function db(): PDO
{
    static $connection = null;

    if ($connection instanceof PDO) {
        return $connection;
    }

    $envPath = dirname(__DIR__) . '/.env';

    if (!is_file($envPath)) {
        throw new RuntimeException('Arquivo .env não encontrado.');
    }

    $env = parse_ini_file($envPath, false, INI_SCANNER_RAW);

    $host = $env['DB_HOST'] ?? "localhost";
    $port = $env['DB_PORT'] ?? "3306";
    $database = $env['DB_NAME'] ?? "cruso_setec";
    $user = $env['DB_USER'] ?? "";
    $password = $env['DB_PASSWORD'] ?? "";

    $dsn = "mysql:host={$host};port={$port};dbname={$database};charset=utf8mb4";

    $connection = new PDO($dsn, $user, $password, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]);

    return $connection;
}