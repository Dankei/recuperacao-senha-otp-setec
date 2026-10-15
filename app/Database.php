<?php

namespace App;

use Illuminate\Support\Facades\DB;

/**
 * Camada de banco de dados (MariaDB).
 *
 * As tabelas NÃO são criadas automaticamente aqui.
 * O aluno (ou o instrutor) roda o script:
 *
 *   mysql -u root < sql/create-database.sql
 *
 * As credenciais vêm do .env:
 *   DB_HOST, DB_PORT, DB_DATABASE, DB_USERNAME, DB_PASSWORD
 *
 * Na aula, o usuário é root e a senha fica vazia.
 */
class Database
{
    /**
     * Testa a conexão na primeira requisição.
     * Se o MariaDB estiver desligado ou o banco ainda não existir,
     * o erro aparece logo, e não só no meio de um formulário.
     */
    public static function testConnection(): void
    {
        DB::select('select 1');
    }

    // ---------------------------------------------------------------------------
    // Usuários
    // ---------------------------------------------------------------------------

    public static function createUser(string $name, string $email, string $passwordHash): int
    {
        return DB::table('users')->insertGetId([
            'name' => $name,
            'email' => $email,
            'password_hash' => $passwordHash,
        ]);
    }

    public static function findUserByEmail(string $email): ?object
    {
        return DB::table('users')
            ->select('id', 'name', 'email', 'password_hash', 'created_at')
            ->where('email', $email)
            ->first();
    }

    public static function findUserById(int|string $id): ?object
    {
        return DB::table('users')
            ->select('id', 'name', 'email', 'created_at')
            ->where('id', $id)
            ->first();
    }

    public static function updateUserPassword(int|string $userId, string $passwordHash): void
    {
        DB::table('users')
            ->where('id', $userId)
            ->update(['password_hash' => $passwordHash]);
    }

    // ---------------------------------------------------------------------------
    // Recuperação de senha (OTP)
    // ---------------------------------------------------------------------------

    /**
     * Quando o usuário pede um código novo, os códigos antigos
     * deixam de valer. Marcamos used_at para "queimar" os anteriores.
     */
    public static function invalidatePreviousCodes(int|string $userId): void
    {
        DB::table('password_resets')
            ->where('user_id', $userId)
            ->whereNull('used_at')
            ->update(['used_at' => now()]);
    }

    public static function createPasswordReset(int|string $userId, string $code, string $expiresAt): int
    {
        return DB::table('password_resets')->insertGetId([
            'user_id' => $userId,
            'code' => $code,
            'expires_at' => $expiresAt,
        ]);
    }

    /**
     * Busca o código mais recente daquele usuário que ainda não foi marcado como usado.
     * Na prática, depois de invalidar os anteriores, só deve existir um ativo.
     */
    public static function findActiveResetByUserId(int|string $userId): ?object
    {
        return DB::table('password_resets')
            ->select('id', 'user_id', 'code', 'expires_at', 'used_at', 'attempts', 'created_at')
            ->where('user_id', $userId)
            ->whereNull('used_at')
            ->orderByDesc('created_at')
            ->first();
    }

    public static function incrementResetAttempts(int|string $resetId): void
    {
        DB::table('password_resets')
            ->where('id', $resetId)
            ->increment('attempts');
    }

    /**
     * Marca o código como utilizado.
     * A partir daqui ele não pode mais redefinir a senha.
     */
    public static function markResetAsUsed(int|string $resetId): void
    {
        DB::table('password_resets')
            ->where('id', $resetId)
            ->update(['used_at' => now()]);
    }
}
