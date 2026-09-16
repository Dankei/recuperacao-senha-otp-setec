/*
Rotas da API.

Cada função abaixo é um endpoint. A ideia da aula é ler
o fluxo de cima para baixo, sem camadas extras (service, controller...).

Endpoints:
POST /api/register
POST /api/login
POST /api/logout
GET  /api/me
POST /api/forgot-password
POST /api/verify-code
POST /api/reset-password
*/

package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
)

/*
Mensagem única para "esqueci minha senha".
Usamos a mesma frase quando o e-mail existe e quando não existe.
Assim um atacante não descobre quais contas estão cadastradas.
*/
const forgotPasswordMessage = "Se existir uma conta para este e-mail, enviamos um código de verificação."

/*
Struct da request de registro
*/
type registerRequest struct {
	Name            string `json:"name"`
	Email           string `json:"email"`
	Password        string `json:"password"`
	ConfirmPassword string `json:"confirmPassword"`
}

/*
Struct da request de login
*/
type loginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

/*
Golang não escreve JSON nativamente,
esta função nos ajuda a fazer isso através dos pacotes de encoding
*/
func writeJSON(w http.ResponseWriter, status int, payload any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(payload)
}

/*
E essa função traduz o JSON para o golang novamente e transforma numa struct
*/
func decodeJSON(r *http.Request, dest any) error {
	defer r.Body.Close()
	return json.NewDecoder(r.Body).Decode(dest)
}

/*
O MariaDB devolve Promise. Este helper pega erros de await
e responde 500, em vez de derrubar o servidor.
*/
func handle(fn func(http.ResponseWriter, *http.Request) error) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if err := fn(w, r); err != nil {
			fmt.Println("Erro na rota.")
			writeJSON(w, http.StatusInternalServerError, map[string]string{
				"error": "Erro interno. Tente novamente.",
			})
		}
	}
}

/*
Registra as rotas da API em cima do mux
*/
func registerAPIRoutes(mux *http.ServeMux) {
	mux.HandleFunc("POST /api/register", handle(handleRegister))
	mux.HandleFunc("POST /api/login", handle(handleLogin))
	mux.HandleFunc("POST /api/logout", handle(handleLogout))
	mux.HandleFunc("GET /api/me", requireAuth(handle(handleMe)))
	mux.HandleFunc("POST /api/forgot-password", handle(handleForgotPassword))
	mux.HandleFunc("POST /api/verify-code", handle(handleVerifyCode))
	mux.HandleFunc("POST /api/reset-password", handle(handleResetPassword))
}

// ---------------------------------------------------------------------------
// Cadastro
// ---------------------------------------------------------------------------

func handleRegister(w http.ResponseWriter, r *http.Request) error {
	var body registerRequest
	if err := decodeJSON(r, &body); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "JSON inválido."})
		return nil
	}

	// 1) Valida os campos antes de tocar no banco.
	if msg := validateRegisterInput(body.Name, body.Email, body.Password,
		body.ConfirmPassword); msg != "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": msg})
		return nil
	}
	normalizedEmail := normalizeEmail(body.Email)

	// 2) Impede dois cadastros com o mesmo e-mail.
	existing, err := findUserByEmail(normalizedEmail)
	if err != nil {
		return err
	}
	if existing != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{
			"error": "Já existe uma conta com este e-mail.",
		})
		return nil
	}

	// 3) Grava somente o hash. A senha original não entra no banco.
	passwordHash, err := hashPassword(body.Password)
	if err != nil {
		return err
	}
	if _, err := createUser(strings.TrimSpace(body.Name), normalizedEmail,
		passwordHash); err != nil {
		return err
	}
	writeJSON(w, http.StatusCreated, map[string]string{
		"message": "Conta criada com sucesso. Faça login para continuar.",
	})
	return nil
}

// ---------------------------------------------------------------------------
// Login / logout / usuário logado
// ---------------------------------------------------------------------------

func handleLogin(w http.ResponseWriter, r *http.Request) error {
	var body loginRequest
	if err := decodeJSON(r, &body); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "JSON inválido."})
		return nil
	}
	if !isValidEmail(body.Email) || body.Password == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Informe e-mail e senha."})
		return nil
	}
	u, err := findUserByEmail(normalizeEmail(body.Email))
	if err != nil {
		return err
	}

	// Mesma mensagem para "e-mail não existe" e "senha errada".
	// Isso também evita vazar se uma conta está cadastrada.
	if u == nil || !comparePassword(body.Password, u.PasswordHash) {
		writeJSON(w, http.StatusUnauthorized, map[string]string{
			"error": "E-mail ou senha inválidos.",
		})
		return nil
	}

	// Guarda só o id na sessão. O cookie é enviado automaticamente pelo navegador.
	if err := setSessionUserID(w, r, u.ID); err != nil {
		return err
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"message": "Login realizado com sucesso.",
		"user": map[string]any{
			"id":    u.ID,
			"name":  u.Name,
			"email": u.Email,
		},
	})
	return nil
}
func handleLogout(w http.ResponseWriter, r *http.Request) error {
	if err := clearSession(w, r); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{
			"error": "Não foi possível sair da conta.",
		})
		return nil
	}

	// Apaga o cookie no navegador para a sessão não "voltar".
	writeJSON(w, http.StatusOK, map[string]string{"message": "Você saiu da conta."})
	return nil
}
func handleMe(w http.ResponseWriter, r *http.Request) error {
	userID, ok := getSessionUserID(r)
	if !ok {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "Sessão inválida."})
		return nil
	}
	u, err := findUserByID(userID)
	if err != nil {
		return err
	}
	if u == nil {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "Sessão inválida."})
		return nil
	}
	writeJSON(w, http.StatusOK, map[string]any{"user": u})
	return nil
}

type emailRequest struct {
	Email string `json:"email"`
}
type verifyCodeRequest struct {
	Email string `json:"email"`
	Code  string `json:"code"`
}
type resetPasswordRequest struct {
	Email           string `json:"email"`
	Code            string `json:"code"`
	Password        string `json:"password"`
	ConfirmPassword string `json:"confirmPassword"`
}

// ---------------------------------------------------------------------------
// Recuperação de senha
// ---------------------------------------------------------------------------

func handleForgotPassword(w http.ResponseWriter, r *http.Request) error {
	var body emailRequest
	if err := decodeJSON(r, &body); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "JSON inválido."})
		return nil
	}
	email := normalizeEmail(body.Email)
	if !isValidEmail(email) {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Informe um e-mail válido."})
		return nil
	}
	u, err := findUserByEmail(email)
	if err != nil {
		return err
	}

	// Se não existir conta, respondemos OK do mesmo jeito.
	// Não geramos código e não enviamos e-mail.
	if u == nil {
		writeJSON(w, http.StatusOK, map[string]string{"message": forgotPasswordMessage})
		return nil
	}

	// 1) Queima códigos antigos daquele usuário.
	if err := invalidatePreviousCodes(u.ID); err != nil {
		return err
	}

	// 2) Gera um OTP de 6 dígitos e define a validade.
	code, err := generateOtp()
	if err != nil {
		return err
	}

	// 3) Salva o código no banco para validar depois.
	if _, err := createPasswordReset(u.ID, code, getOtpExpirationDate()); err != nil {
		return err
	}

	// 4) Envia o e-mail (ou imprime no terminal, se SMTP não estiver no .env).
	if err := sendOtpEmail(u.Email, code); err != nil {
		fmt.Println("Falha ao enviar e-mail de recuperação.")
		// Não devolvemos detalhes internos (senha, host, stack) para o navegador.
		writeJSON(w, http.StatusInternalServerError, map[string]string{
			"error": "Não foi possível enviar o e-mail. Tente novamente em instantes.",
		})
		return nil
	}
	writeJSON(w, http.StatusOK, map[string]string{"message": forgotPasswordMessage})
	return nil
}
func handleVerifyCode(w http.ResponseWriter, r *http.Request) error {
	var body verifyCodeRequest
	if err := decodeJSON(r, &body); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "JSON inválido."})
		return nil
	}
	email := normalizeEmail(body.Email)
	code := strings.TrimSpace(body.Code)
	if !isValidEmail(email) || code == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Informe o e-mail e o código."})
		return nil
	}
	u, err := findUserByEmail(email)
	if err != nil {
		return err
	}
	var reset *passwordReset
	if u != nil {
		reset, err = findActiveResetByUserID(u.ID)
		if err != nil {
			return err
		}
	}

	// Se o e-mail não existe, tratamos como código inválido.
	// De novo: não revelamos se a conta existe.
	if msg := getOtpError(reset); msg != "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": msg})
		return nil
	}

	// Código errado: incrementa tentativas e avisa.
	if reset.Code != code {
		if err := incrementResetAttempts(reset.ID); err != nil {
			return err
		}
		if reset.Attempts+1 >= otpMaxAttempts {
			writeJSON(w, http.StatusBadRequest, map[string]string{
				"error": "Número de tentativas excedido. Solicite um novo código.",
			})
			return nil
		}
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Código incorreto."})
		return nil
	}

	// Código certo, ainda válido e não usado.
	// Ainda NÃO marcamos como usado: isso acontece só ao gravar a nova senha.
	writeJSON(w, http.StatusOK, map[string]string{
		"message": "Código validado. Defina uma nova senha.",
	})
	return nil
}
func handleResetPassword(w http.ResponseWriter, r *http.Request) error {
	var body resetPasswordRequest
	if err := decodeJSON(r, &body); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "JSON inválido."})
		return nil
	}
	if msg := validateNewPassword(body.Password, body.ConfirmPassword); msg != "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": msg})
		return nil
	}
	email := normalizeEmail(body.Email)
	code := strings.TrimSpace(body.Code)
	if !isValidEmail(email) || code == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Informe o e-mail e o código."})
		return nil
	}
	u, err := findUserByEmail(email)
	if err != nil {
		return err
	}
	var reset *passwordReset
	if u != nil {
		reset, err = findActiveResetByUserID(u.ID)
		if err != nil {
			return err
		}
	}
	if msg := getOtpError(reset); msg != "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": msg})
		return nil
	}

	// Revalidamos o código aqui. Assim ninguém pula a tela de verificação
	// e tenta trocar a senha direto com um código aleatório.
	if reset.Code != code {
		if err := incrementResetAttempts(reset.ID); err != nil {
			return err
		}
		writeJSON(w, http.StatusBadRequest, map[string]string{
			"error": "Código incorreto ou expirado.",
		})
		return nil
	}

	// 1) Nova senha vira hash.
	passwordHash, err := hashPassword(body.Password)
	if err != nil {
		return err
	}

	// 2) Atualiza a senha do usuário.
	if err := updateUserPassword(u.ID, passwordHash); err != nil {
		return err
	}

	// 3) Queima o código: ele é de uso único.
	if err := markResetAsUsed(reset.ID); err != nil {
		return err
	}
	writeJSON(w, http.StatusOK, map[string]string{
		"message": "Senha redefinida com sucesso. Faça login com a nova senha.",
	})
	return nil
}
