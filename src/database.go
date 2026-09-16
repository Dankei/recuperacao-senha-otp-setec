/**
 * Camada de banco de dados (MariaDB).
 *
 * As tabelas NÃO são criadas automaticamente aqui.
 * O aluno (ou o instrutor) roda o script:
 *
 *   mysql -u root < sql/create-database.sql
 *
 * As credenciais vêm do .env:
 *   DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME
 *
 * Na aula, o usuário é root e a senha fica vazia.
 */
package main

import (
	"database/sql"
	"fmt"
	"os"
	"time"

	_ "github.com/go-sql-driver/mysql"
)

var db *sql.DB

type user struct {
	ID           int64     `json:"id"`
	Name         string    `json:"name"`
	Email        string    `json:"email"`
	PasswordHash string    `json:"-"`
	CreatedAt    time.Time `json:"created_at"`
}

type passwordReset struct {
	ID        int64
	UserID    int64
	Code      string
	ExpiresAt time.Time
	UsedAt    *time.Time
	Attempts  int
	CreatedAt time.Time
}

func envOr(key, fallback string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return fallback
}

func openDatabase() error {
	dsn := fmt.Sprintf(
		"%s:%s@tcp(%s:%s)/%s?parseTime=true&charset=utf8mb4&loc=Local",
		envOr("DB_USER", "root"),
		os.Getenv("DB_PASSWORD"),
		envOr("DB_HOST", "localhost"),
		envOr("DB_PORT", "3306"),
		envOr("DB_NAME", "cruso_setec"),
	)

	conn, err := sql.Open("mysql", dsn)
	if err != nil {
		return err
	}
	conn.SetMaxOpenConns(10)
	conn.SetMaxIdleConns(5)
	conn.SetConnMaxLifetime(time.Hour)
	db = conn
	return nil
}

/**
 * Testa a conexão na subida do servidor.
 * Se o MariaDB estiver desligado ou o banco ainda não existir,
 * o erro aparece logo, e não só na primeira tela.
 */
func testConnection() error {
	return db.Ping()
}

// ---------------------------------------------------------------------------
// Usuários
// ---------------------------------------------------------------------------

func createUser(name, email, passwordHash string) (int64, error) {
	result, err := db.Exec(
		`INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)`,
		name, email, passwordHash,
	)
	if err != nil {
		return 0, err
	}
	return result.LastInsertId()
}

func findUserByEmail(email string) (*user, error) {
	row := db.QueryRow(
		`SELECT id, name, email, password_hash, created_at FROM users WHERE email = ?`,
		email,
	)
	var u user
	err := row.Scan(&u.ID, &u.Name, &u.Email, &u.PasswordHash, &u.CreatedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &u, nil
}

func findUserByID(id int64) (*user, error) {
	row := db.QueryRow(
		`SELECT id, name, email, created_at FROM users WHERE id = ?`,
		id,
	)
	var u user
	err := row.Scan(&u.ID, &u.Name, &u.Email, &u.CreatedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &u, nil
}

func updateUserPassword(userID int64, passwordHash string) error {
	_, err := db.Exec(
		`UPDATE users SET password_hash = ? WHERE id = ?`,
		passwordHash, userID,
	)
	return err
}

// ---------------------------------------------------------------------------
// Recuperação de senha (OTP)
// ---------------------------------------------------------------------------

/**
 * Quando o usuário pede um código novo, os códigos antigos
 * deixam de valer. Marcamos used_at para "queimar" os anteriores.
 */
func invalidatePreviousCodes(userID int64) error {
	_, err := db.Exec(
		`UPDATE password_resets SET used_at = NOW() WHERE user_id = ? AND used_at IS NULL`,
		userID,
	)
	return err
}

func createPasswordReset(userID int64, code string, expiresAt time.Time) (int64, error) {
	result, err := db.Exec(
		`INSERT INTO password_resets (user_id, code, expires_at) VALUES (?, ?, ?)`,
		userID, code, expiresAt,
	)
	if err != nil {
		return 0, err
	}
	return result.LastInsertId()
}

/**
 * Busca o código mais recente daquele usuário que ainda não foi marcado como usado.
 * Na prática, depois de invalidar os anteriores, só deve existir um ativo.
 */
func findActiveResetByUserID(userID int64) (*passwordReset, error) {
	row := db.QueryRow(
		`SELECT id, user_id, code, expires_at, used_at, attempts, created_at
		FROM password_resets
		WHERE user_id = ? AND used_at IS NULL
		ORDER BY created_at DESC
		LIMIT 1`,
		userID,
	)
	var reset passwordReset
	var usedAt sql.NullTime
	err := row.Scan(
		&reset.ID, &reset.UserID, &reset.Code, &reset.ExpiresAt, &usedAt, &reset.Attempts, &reset.CreatedAt,
	)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	if usedAt.Valid {
		reset.UsedAt = &usedAt.Time
	}
	return &reset, nil
}

func incrementResetAttempts(resetID int64) error {
	_, err := db.Exec(
		`UPDATE password_resets SET attempts = attempts + 1 WHERE id = ?`,
		resetID,
	)
	return err
}

/**
 * Marca o código como utilizado.
 * A partir daqui ele não pode mais redefinir a senha.
 */
func markResetAsUsed(resetID int64) error {
	_, err := db.Exec(
		`UPDATE password_resets SET used_at = NOW() WHERE id = ?`,
		resetID,
	)
	return err
}
