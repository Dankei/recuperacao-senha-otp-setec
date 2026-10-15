<?php

namespace App;

/**
 * Utilitários do projeto.
 *
 * Este arquivo concentra funções pequenas e reutilizáveis:
 * - gerar o código OTP
 * - validar dados que chegam do formulário
 * - transformar senha em hash (e comparar depois)
 *
 * A rota decide o fluxo; os utilitários fazem o "como".
 */
class Utils
{
    // Quantas "rodadas" o bcrypt usa para gerar o hash.
    // Quanto maior, mais lento (e mais seguro contra força bruta).
    // 10 é um valor didático e aceitável para um projeto de aula.
    public const SALT_ROUNDS = 10;

    // Tamanho mínimo da senha. Em sistemas reais costuma ser maior
    // e incluir regras extras (letra, número, símbolo).
    public const MIN_PASSWORD_LENGTH = 6;

    // OTP vale por 10 minutos a partir do momento em que foi gerado.
    public const OTP_VALIDITY_MINUTES = 10;

    // Depois de 5 tentativas erradas, o código deixa de ser aceito.
    public const OTP_MAX_ATTEMPTS = 5;

    /**
     * Gera um código numérico de 6 dígitos.
     *
     * Usamos random_int (e não rand) porque o OTP é um segredo
     * temporário: precisa ser imprevisível.
     *
     * random_int inclui os dois extremos. 100000 até 999999
     * gera sempre 6 dígitos, sem zero à esquerda.
     */
    public static function generateOtp(): string
    {
        return (string) random_int(100000, 999999);
    }

    /**
     * Calcula a data/hora em que o OTP expira.
     * Guardamos no formato DATETIME do MariaDB para gravar em expires_at.
     */
    public static function getOtpExpirationDate(): string
    {
        return now()->addMinutes(self::OTP_VALIDITY_MINUTES)->format('Y-m-d H:i:s');
    }

    /**
     * Transforma a senha original em um hash.
     *
     * Nunca gravamos a senha em texto puro no banco.
     * O bcrypt já inclui um "sal" aleatório dentro do hash,
     * então duas pessoas com a mesma senha terão hashes diferentes.
     */
    public static function hashPassword(string $password): string
    {
        return password_hash($password, PASSWORD_BCRYPT, [
            'cost' => self::SALT_ROUNDS,
        ]);
    }

    /**
     * Compara a senha digitada no login com o hash salvo no banco.
     * Retorna true somente se for a mesma senha.
     */
    public static function comparePassword(string $password, string $passwordHash): bool
    {
        return password_verify($password, $passwordHash);
    }

    /**
     * Validação simples de e-mail.
     * Não precisa ser perfeita: o objetivo é barrar textos claramente inválidos.
     */
    public static function isValidEmail(mixed $email): bool
    {
        if (! is_string($email)) {
            return false;
        }

        $trimmed = trim($email);

        // Exemplo aceito: nome@dominio.com
        return preg_match('/^[^\s@]+@[^\s@]+\.[^\s@]+$/', $trimmed) === 1;
    }

    /**
     * Valida o cadastro antes de falar com o banco.
     * Devolve uma string de erro para mostrar ao aluno, ou null se estiver ok.
     */
    public static function validateRegisterInput(array $input): ?string
    {
        $name = $input['name'] ?? null;
        $email = $input['email'] ?? null;
        $password = $input['password'] ?? null;
        $confirmPassword = $input['confirmPassword'] ?? null;

        if ($name === null || trim((string) $name) === '') {
            return 'Informe o nome.';
        }

        if (! self::isValidEmail($email)) {
            return 'Informe um e-mail válido.';
        }

        if (! is_string($password) || strlen($password) < self::MIN_PASSWORD_LENGTH) {
            return 'A senha deve ter pelo menos '.self::MIN_PASSWORD_LENGTH.' caracteres.';
        }

        if ($password !== $confirmPassword) {
            return 'A senha e a confirmação não coincidem.';
        }

        return null;
    }

    /**
     * Valida só a nova senha (usado em "Redefinir senha").
     */
    public static function validateNewPassword(array $input): ?string
    {
        $password = $input['password'] ?? null;
        $confirmPassword = $input['confirmPassword'] ?? null;

        if (! is_string($password) || strlen($password) < self::MIN_PASSWORD_LENGTH) {
            return 'A senha deve ter pelo menos '.self::MIN_PASSWORD_LENGTH.' caracteres.';
        }

        if ($password !== $confirmPassword) {
            return 'A senha e a confirmação não coincidem.';
        }

        return null;
    }

    /**
     * Normaliza o e-mail: tira espaços e deixa em minúsculas.
     * Assim "Daniel@Email.com" e "daniel@email.com" viram a mesma conta.
     */
    public static function normalizeEmail(mixed $email): string
    {
        return strtolower(trim((string) ($email ?? '')));
    }

    /**
     * Confere se o código OTP ainda pode ser usado.
     * Cobre os três casos mais importantes da aula:
     * - já foi usado
     * - passou do prazo
     * - estourou o limite de tentativas
     */
    public static function getOtpError(?object $reset): ?string
    {
        if ($reset === null) {
            return 'Código inválido ou expirado.';
        }

        // used_at preenchido = código já foi consumido na troca de senha
        if ($reset->used_at) {
            return 'Este código já foi utilizado. Solicite um novo.';
        }

        if (new \DateTimeImmutable($reset->expires_at) < new \DateTimeImmutable()) {
            return 'Este código expirou. Solicite um novo.';
        }

        if ((int) $reset->attempts >= self::OTP_MAX_ATTEMPTS) {
            return 'Número de tentativas excedido. Solicite um novo código.';
        }

        return null;
    }
}
