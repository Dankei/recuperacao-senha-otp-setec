-- =============================================================================
-- Script de criação do banco no MariaDB
-- =============================================================================
--
-- Como executar (usuário root SEM senha, como no .env da aula):
--
--   mysql -u root < sql/create-database.sql
--
-- Se o cliente do seu computador se chama mariadb:
--
--   mariadb -u root < sql/create-database.sql
--
-- Também dá para colar este arquivo no HeidiSQL, DBeaver, phpMyAdmin, etc.
-- =============================================================================

-- Cria o banco se ele ainda não existir.
-- utf8mb4 aceita acentos e emojis; utf8mb4_unicode_ci compara texto sem se importar com maiúsculas.
CREATE DATABASE IF NOT EXISTS cruso_setec
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

-- A partir daqui, os CREATE TABLE valem para este banco.
USE cruso_setec;

-- ---------------------------------------------------------------------------
-- Tabela de usuários
-- ---------------------------------------------------------------------------
-- password_hash guarda a senha já transformada pelo bcrypt.
-- Nunca gravamos a senha original.
CREATE TABLE IF NOT EXISTS users (
  id INT NOT NULL AUTO_INCREMENT,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(180) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_email (email)
);

-- ---------------------------------------------------------------------------
-- Tabela dos códigos OTP (esqueci minha senha)
-- ---------------------------------------------------------------------------
-- used_at nulo  = código ainda pode ser usado
-- used_at preenchido = código queimado (já usado ou invalidado)
-- attempts      = quantas vezes o aluno errou o código
CREATE TABLE IF NOT EXISTS password_resets (
  id INT NOT NULL AUTO_INCREMENT,
  user_id INT NOT NULL,
  code VARCHAR(6) NOT NULL,
  expires_at DATETIME NOT NULL,
  used_at DATETIME NULL,
  attempts INT NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_password_resets_user_id (user_id),
  CONSTRAINT fk_password_resets_user
    FOREIGN KEY (user_id) REFERENCES users (id)
);
