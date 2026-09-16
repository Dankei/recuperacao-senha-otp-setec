package main

/**
 * Utilitários do projeto.
 *
 * Este arquivo concentra funções pequenas e reutilizáveis:
 * - gerar o código OTP
 * - validar dados que chegam do formulário
 * - transformar senha em hash (e comparar depois)
 *
 * Separar isso das rotas deixa a aula mais fácil de acompanhar:
 * a rota decide o fluxo; os utilitários fazem o "como".
 */

import (
	"crypto/rand"
	"fmt"
	"math/big"
	"regexp"
	"strings"
	"time"

	"golang.org/x/crypto/bcrypt"
)

const (
	// Quantas "rodadas" o bcrypt usa para gerar o hash.
	// Quanto maior, mais lento (e mais seguro contra força bruta).
	// 10 é um valor didático e aceitável para um projeto de aula.
	saltRounds = 10

	// Tamanho mínimo da senha. Em sistemas reais costuma ser maior
	// e incluir regras extras (letra, número, símbolo).
	minPasswordLength = 6

	// OTP vale por 10 minutos a partir do momento em que foi gerado.
	otpValidityMinutes = 10

	// Depois de 5 tentativas erradas, o código deixa de ser aceito.
	otpMaxAttempts = 5
)

var emailRegex = regexp.MustCompile(`^[^\s@]+@[^\s@]+\.[^\s@]+$`)

/**
 * Gera um código numérico de 6 dígitos.
 *
 * Usamos crypto/rand porque o OTP
 * é um segredo temporário: precisa ser imprevisível.
 */
func generateOtp() (string, error) {
	n, err := rand.Int(rand.Reader, big.NewInt(900000))
	if err != nil {
		return "", err
	}
	return fmt.Sprintf("%06d", n.Int64()+100000), nil
}

/**
 * Calcula a data/hora em que o OTP expira.
 */
func getOtpExpirationDate() time.Time {
	return time.Now().Add(otpValidityMinutes * time.Minute)
}
/**
 * Transforma a senha original em um hash.
 *
 * Nunca gravamos a senha em texto puro no banco.
 * O bcrypt já inclui um "sal" aleatório dentro do hash,
 * então duas pessoas com a mesma senha terão hashes diferentes.
 */
func hashPassword(password string) (string, error) {
	hash, err := bcrypt.GenerateFromPassword([]byte(password), saltRounds)
	if err != nil {
		return "", err
	}
	return string(hash), nil
}

/**
 * Compara a senha digitada no login com o hash salvo no banco.
 * Retorna true somente se for a mesma senha.
 */
func comparePassword(password, passwordHash string) bool {
	return bcrypt.CompareHashAndPassword([]byte(passwordHash), []byte(password)) == nil
}

/**
 * Validação simples de e-mail.
 * Não precisa ser perfeita: o objetivo é barrar textos claramente inválidos.
 */
func isValidEmail(email string) bool {
	return emailRegex.MatchString(strings.TrimSpace(email))
}

/**
 * Valida o cadastro (ou a troca de senha) antes de falar com o banco.
 * Devolve uma string de erro para mostrar ao aluno, ou vazia se estiver ok.
 */
func validateRegisterInput(name, email, password, confirmPassword string) string {
	if strings.TrimSpace(name) == "" {
		return "Informe o nome."
	}
	if !isValidEmail(email) {
		return "Informe um e-mail válido."
	}
	if len(password) < minPasswordLength {
		return fmt.Sprintf("A senha deve ter pelo menos %d caracteres.", minPasswordLength)
	}
	if password != confirmPassword {
		return "A senha e a confirmação não coincidem."
	}
	return ""
}

/**
 * Valida só a nova senha (usado em "Redefinir senha").
 */
func validateNewPassword(password, confirmPassword string) string {
	if len(password) < minPasswordLength {
		return fmt.Sprintf("A senha deve ter pelo menos %d caracteres.", minPasswordLength)
	}
	if password != confirmPassword {
		return "A senha e a confirmação não coincidem."
	}
	return ""
}

/**
 * Normaliza o e-mail: tira espaços e deixa em minúsculas.
 * Assim "Daniel@Email.com" e "daniel@email.com" viram a mesma conta.
 */
func normalizeEmail(email string) string {
	return strings.ToLower(strings.TrimSpace(email))
}

/**
 * Confere se o código OTP ainda pode ser usado.
 * Cobre os três casos mais importantes da aula:
 * - já foi usado
 * - passou do prazo
 * - estourou o limite de tentativas
 */
func getOtpError(reset *passwordReset) string {
	if reset == nil {
		return "Código inválido ou expirado."
	}
	if reset.UsedAt != nil {
		return "Este código já foi utilizado. Solicite um novo."
	}
	if reset.ExpiresAt.Before(time.Now()) {
		return "Este código expirou. Solicite um novo."
	}
	if reset.Attempts >= otpMaxAttempts {
		return "Número de tentativas excedido. Solicite um novo código."
	}
	return ""
}
