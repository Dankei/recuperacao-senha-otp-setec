package main

import (
	"fmt"
	"net/smtp"
	"os"
)

/**
 * Envio de e-mail com o código OTP.
 *
 * Usamos net/smtp + SMTP do Gmail.
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

func isEmailConfigured() bool {
	return os.Getenv("EMAIL_USER") != "" && os.Getenv("EMAIL_PASSWORD") != ""
}

/**
 * Envia o OTP para o e-mail informado.
 * Se SMTP não estiver configurado, só registra no terminal (modo aula).
 *
 * Importante: em um sistema real NÃO devemos logar o OTP.
 * Fazemos isso aqui apenas quando o e-mail não está configurado,
 * para a turma conseguir seguir o fluxo.
 */
func sendOtpEmail(to, code string) error {
	if !isEmailConfigured() {
		fmt.Println("----------------------------------------")
		fmt.Println("E-mail não configurado no .env.")
		fmt.Println("Modo aula: o código OTP aparece abaixo.")
		fmt.Printf("Destinatário: %s\n", to)
		fmt.Printf("Código OTP:   %s\n", code)
		fmt.Printf("Validade:     %d minutos\n", otpValidityMinutes)
		fmt.Println("----------------------------------------")
		return nil
	}
	from := os.Getenv("EMAIL_USER")
	password := os.Getenv("EMAIL_PASSWORD")
	host := "smtp.gmail.com"
	addr := host + ":587"
	body := fmt.Sprintf(
		"Você pediu para redefinir a senha. \r\n"+
			"\r\n"+
			"Código de verificação: %s\r\n"+
			"Este código vale por %d minutos.\r\n"+
			"\r\n"+
			"Se você não pediu isso, ignore este e-mail.\r\n",
		code,
		otpValidityMinutes,
	)
	message := []byte(
		"From: Recuperação de senha <" + from + ">\r\n" +
			"To: " + to + "\r\n" +
			"Subject: Seu código para redefinir a senha\r\n" +
			"MIME-Version: 1.0\r\n" +
			"Content-Type: text/plain; charset=\"UTF-8\"\r\n" +
			"\r\n" +
			body,
	)
	auth := smtp.PlainAuth("", from, password, host)
	return smtp.SendMail(addr, auth, from, []string{to}, message)
}
