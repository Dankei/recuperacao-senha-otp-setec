<?php

namespace App;

use Illuminate\Support\Facades\Mail;
use Illuminate\Support\HtmlString;

/**
 * Envio de e-mail com o código OTP.
 *
 * Usamos o mailer do Laravel (SMTP do Gmail por baixo).
 * As credenciais vêm do arquivo .env (nunca ficam hardcoded aqui).
 *
 * Dois modos de funcionamento, para a aula não travar:
 *
 * 1. E-mail configurado (EMAIL_USER + EMAIL_PASSWORD):
 *    o código é enviado de verdade para a caixa de entrada.
 *
 * 2. E-mail NÃO configurado:
 *    o código é impresso no terminal. Assim o aluno consegue
 *    testar o fluxo mesmo sem App Password do Google.
 */
class Email
{
    public static function isConfigured(): bool
    {
        return filled(env('EMAIL_USER')) && filled(env('EMAIL_PASSWORD'));
    }

    /**
     * Aponta o mailer SMTP para o Gmail usando as variáveis da aula.
     * A senha precisa ser uma App Password, não a senha normal da conta.
     */
    private static function configureGmail(): void
    {
        config([
            'mail.default' => 'smtp',
            'mail.mailers.smtp.scheme' => 'smtp',
            'mail.mailers.smtp.host' => 'smtp.gmail.com',
            'mail.mailers.smtp.port' => 587,
            'mail.mailers.smtp.username' => env('EMAIL_USER'),
            'mail.mailers.smtp.password' => env('EMAIL_PASSWORD'),
            'mail.from.address' => env('EMAIL_USER'),
            'mail.from.name' => 'Recuperação de senha',
        ]);

        // O mailer guarda a configuração antiga. Limpamos para usar a de cima.
        Mail::purge('smtp');
    }

    /**
     * Envia o OTP para o e-mail informado.
     * Se SMTP não estiver configurado, só registra no terminal (modo aula).
     *
     * Importante: em um sistema real NÃO devemos logar o OTP.
     * Fazemos isso aqui apenas quando o e-mail não está configurado,
     * para a turma conseguir seguir o fluxo.
     */
    public static function sendOtpEmail(string $to, string $code): void
    {
        if (! self::isConfigured()) {
            $minutes = Utils::OTP_VALIDITY_MINUTES;

            fwrite(STDERR, "----------------------------------------\n");
            fwrite(STDERR, "E-mail não configurado no .env.\n");
            fwrite(STDERR, "Modo aula: o código OTP aparece abaixo.\n");
            fwrite(STDERR, "Destinatário: {$to}\n");
            fwrite(STDERR, "Código OTP:   {$code}\n");
            fwrite(STDERR, "Validade:     {$minutes} minutos\n");
            fwrite(STDERR, "----------------------------------------\n");

            return;
        }

        self::configureGmail();

        $minutes = Utils::OTP_VALIDITY_MINUTES;
        $text = implode("\n", [
            'Você pediu para redefinir a senha.',
            '',
            "Código de verificação: {$code}",
            "Este código vale por {$minutes} minutos.",
            '',
            'Se você não pediu isso, ignore este e-mail.',
        ]);
        $html = '<p>Você pediu para redefinir a senha.</p>'
            ."<p>Código de verificação: <strong>{$code}</strong></p>"
            ."<p>Este código vale por {$minutes} minutos.</p>"
            .'<p>Se você não pediu isso, ignore este e-mail.</p>';

        Mail::send([
            'html' => new HtmlString($html),
            'raw' => $text,
        ], [], function ($message) use ($to) {
            $message->to($to)
                ->from(env('EMAIL_USER'), 'Recuperação de senha')
                ->subject('Seu código para redefinir a senha');
        });
    }
}
