"""
Camada de banco de dados (MariaDB).

As tabelas NÃO são criadas automaticamente aqui.
O aluno (ou o instrutor) roda o script:

  mysql -u root < sql/create-database.sql

As credenciais vêm do .env:
  DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME

Na aula, o usuário é root e a senha fica vazia.
"""
import os
import pymysql.cursors

def get_connection():
    return pymysql.connect(
        host=os.getenv('DB_HOST', 'localhost'),
        port=int(os.getenv('DB_PORT', 3306)),
        user=os.getenv('DB_USER', 'root'),
        password=os.getenv('DB_PASSWORD', ''),
        database=os.getenv('DB_NAME', 'cruso_setec'),
        cursorclass=pymysql.cursors.DictCursor,
        autocommit=True
    )

def test_connection():
    """
    Testa a conexão na subida do servidor.
    Se o MariaDB estiver desligado ou o banco ainda não existir,
    o erro aparece logo, e não só na primeira tela.
    """
    conn = get_connection()
    conn.close()

# ---------------------------------------------------------------------------
# Usuários
# ---------------------------------------------------------------------------

def create_user(name, email, password_hash):
    conn = get_connection()
    with conn.cursor() as cursor:
        cursor.execute(
            """
            INSERT INTO users (name, email, password_hash)
            VALUES (%s, %s, %s)
            """,
            (name, email, password_hash)
        )
        return cursor.lastrowid

def find_user_by_email(email):
    conn = get_connection()
    with conn.cursor() as cursor:
        cursor.execute(
            """
            SELECT id, name, email, password_hash, created_at
            FROM users
            WHERE email = %s
            """,
            (email,)
        )
        return cursor.fetchone()

def find_user_by_id(user_id):
    conn = get_connection()
    with conn.cursor() as cursor:
        cursor.execute(
            """
            SELECT id, name, email, created_at
            FROM users
            WHERE id = %s
            """,
            (user_id,)
        )
        return cursor.fetchone()

def update_user_password(user_id, password_hash):
    conn = get_connection()
    with conn.cursor() as cursor:
        cursor.execute(
            """
            UPDATE users
            SET password_hash = %s
            WHERE id = %s
            """,
            (password_hash, user_id)
        )

# ---------------------------------------------------------------------------
# Recuperação de senha (OTP)
# ---------------------------------------------------------------------------

def invalidate_previous_codes(user_id):
    """
    Quando o usuário pede um código novo, os códigos antigos
    deixam de valer. Marcamos used_at para "queimar" os anteriores.
    """
    conn = get_connection()
    with conn.cursor() as cursor:
        cursor.execute(
            """
            UPDATE password_resets
            SET used_at = NOW()
            WHERE user_id = %s
              AND used_at IS NULL
            """,
            (user_id,)
        )

def create_password_reset(user_id, code, expires_at):
    conn = get_connection()
    with conn.cursor() as cursor:
        cursor.execute(
            """
            INSERT INTO password_resets (user_id, code, expires_at)
            VALUES (%s, %s, %s)
            """,
            (user_id, code, expires_at)
        )
        return cursor.lastrowid

def find_active_reset_by_user_id(user_id):
    """
    Busca o código mais recente daquele usuário que ainda não foi marcado como usado.
    Na prática, depois de invalidar os anteriores, só deve existir um ativo.
    """
    conn = get_connection()
    with conn.cursor() as cursor:
        cursor.execute(
            """
            SELECT id, user_id, code, expires_at, used_at, attempts, created_at
            FROM password_resets
            WHERE user_id = %s
              AND used_at IS NULL
            ORDER BY created_at DESC
            LIMIT 1
            """,
            (user_id,)
        )
        return cursor.fetchone()

def increment_reset_attempts(reset_id):
    conn = get_connection()
    with conn.cursor() as cursor:
        cursor.execute(
            """
            UPDATE password_resets
            SET attempts = attempts + 1
            WHERE id = %s
            """,
            (reset_id,)
        )

def mark_reset_as_used(reset_id):
    """
    Marca o código como utilizado.
    A partir daqui ele não pode mais redefinir a senha.
    """
    conn = get_connection()
    with conn.cursor() as cursor:
        cursor.execute(
            """
            UPDATE password_resets
            SET used_at = NOW()
            WHERE id = %s
            """,
            (reset_id,)
        )
