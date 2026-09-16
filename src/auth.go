package main

import (
	"encoding/json"
	"net/http"

	"github.com/gorilla/sessions"
)

const sessionName = "connect.sid"

var store *sessions.CookieStore

func initSessionStore(secret string) {
	store = sessions.NewCookieStore([]byte(secret))
	store.Options = &sessions.Options{
		Path:     "/",
		MaxAge:   60 * 60 * 2,
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
	}
}
func getSession(r *http.Request) (*sessions.Session, error) {
	return store.Get(r, sessionName)
}
func getSessionUserID(r *http.Request) (int64, bool) {
	session, err := getSession(r)
	if err != nil {
		return 0, false
	}
	raw, ok := session.Values["userId"]
	if !ok {
		return 0, false
	}
	userID, ok := raw.(int64)
	return userID, ok
}
func setSessionUserID(w http.ResponseWriter, r *http.Request, userID int64) error {
	session, err := getSession(r)
	if err != nil {
		return err
	}
	session.Values["userId"] = userID
	return session.Save(r, w)
}
func clearSession(w http.ResponseWriter, r *http.Request) error {
	session, err := getSession(r)
	if err != nil {
		return err
	}
	session.Options.MaxAge = -1
	delete(session.Values, "userId")
	return session.Save(r, w)
}
/**
 * Autenticação por sessão.
 *
 * Depois do login, o servidor grava o id do usuário na sessão.
 * Esse valor viaja em um cookie HttpOnly (o JavaScript da página não lê o cookie).
 *
 * Os middlewares abaixo só checam se essa sessão existe.
 * Eles não conhecem senha, OTP nem banco — só a sessão.
 */

func requireAuth(next http.HandlerFunc) http.HandlerFunc {
	/**
	 * Usado nas rotas da API que exigem usuário logado (ex.: GET /api/me).
	 * Se não houver sessão, devolve 401 para o frontend redirecionar ao login.
	 */
	return func(w http.ResponseWriter, r *http.Request) {
		if _, ok := getSessionUserID(r); !ok {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusUnauthorized)
			_ = json.NewEncoder(w).Encode(map[string]string{
				"error": "Você precisa estar logado.",
			})
			return
		}
		next(w, r)
	}
}

func requirePageAuth(next http.HandlerFunc) http.HandlerFunc {
	/**
	 * Usado na página HTML da área logada.
	 * Se o aluno abrir /home.html sem sessão, mandamos de volta ao login.
	 */
	return func(w http.ResponseWriter, r *http.Request) {
		if _, ok := getSessionUserID(r); !ok {
			http.Redirect(w, r, "/login.html", http.StatusFound)
			return
		}
		next(w, r)
	}
}
