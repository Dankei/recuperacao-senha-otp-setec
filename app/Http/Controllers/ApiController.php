<?php

namespace App\Http\Controllers;

use App\Database;
use App\Email;
use App\Utils;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * Rotas da API.
 *
 * Cada método abaixo é um endpoint. A ideia da aula é ler
 * o fluxo de cima para baixo, sem camadas extras (service, repository...).
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
class ApiController extends Controller
{
    /**
     * Mensagem única para "esqueci minha senha".
     * Usamos a mesma frase quando o e-mail existe e quando não existe.
     * Assim um atacante não descobre quais contas estão cadastradas.
     */
    private const FORGOT_PASSWORD_MESSAGE = 'Se existir uma conta para este e-mail, enviamos um código de verificação.';

    // ---------------------------------------------------------------------------
    // Cadastro
    // ---------------------------------------------------------------------------

    public function register(Request $request): JsonResponse
    {
        $name = $request->input('name');
        $email = $request->input('email');
        $password = $request->input('password');
        $confirmPassword = $request->input('confirmPassword');

        // 1) Valida os campos antes de tocar no banco.
        $validationError = Utils::validateRegisterInput([
            'name' => $name,
            'email' => $email,
            'password' => $password,
            'confirmPassword' => $confirmPassword,
        ]);

        if ($validationError) {
            return response()->json(['error' => $validationError], 400);
        }

        $normalizedEmail = Utils::normalizeEmail($email);

        // 2) Impede dois cadastros com o mesmo e-mail.
        $existing = Database::findUserByEmail($normalizedEmail);
        if ($existing) {
            return response()->json(['error' => 'Já existe uma conta com este e-mail.'], 400);
        }

        // 3) Grava somente o hash. A senha original não entra no banco.
        $passwordHash = Utils::hashPassword($password);

        Database::createUser(trim((string) $name), $normalizedEmail, $passwordHash);

        return response()->json([
            'message' => 'Conta criada com sucesso. Faça login para continuar.',
        ], 201);
    }

    // ---------------------------------------------------------------------------
    // Login / logout / usuário logado
    // ---------------------------------------------------------------------------

    public function login(Request $request): JsonResponse
    {
        $email = $request->input('email');
        $password = $request->input('password');

        if (! Utils::isValidEmail($email) || ! is_string($password) || $password === '') {
            return response()->json(['error' => 'Informe e-mail e senha.'], 400);
        }

        $user = Database::findUserByEmail(Utils::normalizeEmail($email));

        // Mesma mensagem para "e-mail não existe" e "senha errada".
        // Isso também evita vazar se uma conta está cadastrada.
        if ($user === null || ! Utils::comparePassword($password, $user->password_hash)) {
            return response()->json(['error' => 'E-mail ou senha inválidos.'], 401);
        }

        // Guarda só o id na sessão. O cookie é enviado automaticamente pelo navegador.
        $request->session()->regenerate();
        $request->session()->put('userId', (int) $user->id);

        return response()->json([
            'message' => 'Login realizado com sucesso.',
            'user' => [
                'id' => (int) $user->id,
                'name' => $user->name,
                'email' => $user->email,
            ],
        ]);
    }

    public function logout(Request $request): JsonResponse
    {
        try {
            $request->session()->invalidate();
            $request->session()->regenerateToken();
        } catch (Throwable) {
            return response()->json(['error' => 'Não foi possível sair da conta.'], 500);
        }

        return response()->json(['message' => 'Você saiu da conta.']);
    }

    public function me(Request $request): JsonResponse
    {
        $user = Database::findUserById($request->session()->get('userId'));

        if ($user === null) {
            return response()->json(['error' => 'Sessão inválida.'], 401);
        }

        return response()->json([
            'user' => [
                'id' => (int) $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'created_at' => $user->created_at,
            ],
        ]);
    }

    // ---------------------------------------------------------------------------
    // Recuperação de senha
    // ---------------------------------------------------------------------------

    public function forgotPassword(Request $request): JsonResponse
    {
        $email = Utils::normalizeEmail($request->input('email'));

        if (! Utils::isValidEmail($email)) {
            return response()->json(['error' => 'Informe um e-mail válido.'], 400);
        }

        $user = Database::findUserByEmail($email);

        // Se não existir conta, respondemos OK do mesmo jeito.
        // Não geramos código e não enviamos e-mail.
        if ($user === null) {
            return response()->json(['message' => self::FORGOT_PASSWORD_MESSAGE]);
        }

        // 1) Queima códigos antigos daquele usuário.
        Database::invalidatePreviousCodes($user->id);

        // 2) Gera um OTP de 6 dígitos e define a validade.
        $code = Utils::generateOtp();
        $expiresAt = Utils::getOtpExpirationDate();

        // 3) Salva o código no banco para validar depois.
        Database::createPasswordReset($user->id, $code, $expiresAt);

        // 4) Envia o e-mail (ou imprime no terminal, se SMTP não estiver no .env).
        try {
            Email::sendOtpEmail($user->email, $code);
        } catch (Throwable) {
            // Não devolvemos detalhes internos (senha, host, stack) para o navegador
            // nem gravamos a exceção: a mensagem do SMTP pode citar a senha.
            Log::error('Falha ao enviar e-mail de recuperação.');

            return response()->json([
                'error' => 'Não foi possível enviar o e-mail. Tente novamente em instantes.',
            ], 500);
        }

        return response()->json(['message' => self::FORGOT_PASSWORD_MESSAGE]);
    }

    public function verifyCode(Request $request): JsonResponse
    {
        $email = Utils::normalizeEmail($request->input('email'));
        $code = trim((string) ($request->input('code') ?? ''));

        if (! Utils::isValidEmail($email) || $code === '') {
            return response()->json(['error' => 'Informe o e-mail e o código.'], 400);
        }

        $user = Database::findUserByEmail($email);
        $reset = $user ? Database::findActiveResetByUserId($user->id) : null;

        // Se o e-mail não existe, tratamos como código inválido.
        // De novo: não revelamos se a conta existe.
        $otpError = Utils::getOtpError($reset);
        if ($otpError) {
            return response()->json(['error' => $otpError], 400);
        }

        // Código errado: incrementa tentativas e avisa.
        if ($reset->code !== $code) {
            Database::incrementResetAttempts($reset->id);

            $nextAttempts = (int) $reset->attempts + 1;
            if ($nextAttempts >= Utils::OTP_MAX_ATTEMPTS) {
                return response()->json([
                    'error' => 'Número de tentativas excedido. Solicite um novo código.',
                ], 400);
            }

            return response()->json(['error' => 'Código incorreto.'], 400);
        }

        // Código certo, ainda válido e não usado.
        // Ainda NÃO marcamos como usado: isso acontece só ao gravar a nova senha.
        return response()->json([
            'message' => 'Código validado. Defina uma nova senha.',
        ]);
    }

    public function resetPassword(Request $request): JsonResponse
    {
        $email = Utils::normalizeEmail($request->input('email'));
        $code = trim((string) ($request->input('code') ?? ''));
        $password = $request->input('password');
        $confirmPassword = $request->input('confirmPassword');

        $passwordError = Utils::validateNewPassword([
            'password' => $password,
            'confirmPassword' => $confirmPassword,
        ]);

        if ($passwordError) {
            return response()->json(['error' => $passwordError], 400);
        }

        if (! Utils::isValidEmail($email) || $code === '') {
            return response()->json(['error' => 'Informe o e-mail e o código.'], 400);
        }

        $user = Database::findUserByEmail($email);
        $reset = $user ? Database::findActiveResetByUserId($user->id) : null;
        $otpError = Utils::getOtpError($reset);

        if ($otpError) {
            return response()->json(['error' => $otpError], 400);
        }

        // Revalidamos o código aqui. Assim ninguém pula a tela de verificação
        // e tenta trocar a senha direto com um código aleatório.
        if ($reset->code !== $code) {
            Database::incrementResetAttempts($reset->id);

            return response()->json(['error' => 'Código incorreto ou expirado.'], 400);
        }

        // 1) Nova senha vira hash.
        $passwordHash = Utils::hashPassword($password);

        // 2) Atualiza a senha do usuário.
        Database::updateUserPassword($user->id, $passwordHash);

        // 3) Queima o código: ele é de uso único.
        Database::markResetAsUsed($reset->id);

        return response()->json([
            'message' => 'Senha redefinida com sucesso. Faça login com a nova senha.',
        ]);
    }
}
