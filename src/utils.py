"""
Utilitários do projeto.

Este arquivo concentra funções pequenas e reutilizáveis:
- gerar o código OTP
- validar dados que chegam do formulário
- transformar senha em hash (e comparar depois)

Separar isso das rotas deixa a aula mais fácil de acompanhar:
a rota decide o fluxo; os utilitários fazem o "como".
"""
import os
import re
import secrets
from datetime import datetime, timedelta
import bcrypt

# Quantas "rodadas" o bcrypt usa para gerar o hash.
# Quanto maior, mais lento (e mais seguro contra força bruta).
# 10 é um valor didático e aceitável para um projeto de aula.
SALT_ROUNDS = 10

# Tamanho mínimo da senha. Em sistemas reais costuma ser maior
# e incluir regras extras (letra, número, símbolo).
MIN_PASSWORD_LENGTH = 6

# OTP vale por 10 minutos a partir do momento em que foi gerado.
OTP_VALIDITY_MINUTES = 10

# Depois de 5 tentativas erradas, o código deixa de ser aceito.
OTP_MAX_ATTEMPTS = 5

EMAIL_REGEX = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")


def generate_otp():
    """
    Gera um código numérico de 6 dígitos.

    Usamos o módulo secrets porque o OTP
    é um segredo temporário: precisa ser imprevisível.
    """
    # randint(100000, 999999) gera números de 6 dígitos
    return str(secrets.randbelow(900000) + 100000)

def get_otp_expiration_date():
    """
    Calcula a data/hora em que o OTP expira.
    Guardamos no formato DATETIME do MariaDB para gravar em expires_at.
    """
    expires = datetime.now() + timedelta(minutes=OTP_VALIDITY_MINUTES)
    return expires.strftime('%Y-%m-%d %H:%M:%S')

def hash_password(password):
    """
    Transforma a senha original em um hash.

    Nunca gravamos a senha em texto puro no banco.
    O bcrypt já inclui um "sal" aleatório dentro do hash,
    então duas pessoas com a mesma senha terão hashes diferentes.
    """
    salt = bcrypt.gensalt(rounds=SALT_ROUNDS)
    return bcrypt.hashpw(password.encode('utf-8'), salt).decode('utf-8')

def compare_password(password, password_hash):
    """
    Compara a senha digitada no login com o hash salvo no banco.
    Retorna True somente se for a mesma senha.
    """
    if not password_hash:
        return False
    return bcrypt.checkpw(password.encode('utf-8'), password_hash.encode('utf-8'))

def is_valid_email(email):
    """
    Validação simples de e-mail.
    Não precisa ser perfeita: o objetivo é barrar textos claramente inválidos.
    """
    if not isinstance(email, str):
        return False
    return bool(EMAIL_REGEX.match(email.strip()))

def validate_register_input(name, email, password, confirm_password):
    """
    Valida o cadastro (ou a troca de senha) antes de falar com o banco.
    Devolve uma string de erro para mostrar ao aluno, ou None se estiver ok.
    """
    if not name or not str(name).strip():
        return "Informe o nome."

    if not is_valid_email(email):
        return "Informe um e-mail válido."

    if not password or len(str(password)) < MIN_PASSWORD_LENGTH:
        return f"A senha deve ter pelo menos {MIN_PASSWORD_LENGTH} caracteres."

    if password != confirm_password:
        return "A senha e a confirmação não coincidem."

    return None

def validate_new_password(password, confirm_password):
    """
    Valida só a nova senha (usado em "Redefinir senha").
    """
    if not password or len(str(password)) < MIN_PASSWORD_LENGTH:
        return f"A senha deve ter pelo menos {MIN_PASSWORD_LENGTH} caracteres."

    if password != confirm_password:
        return "A senha e a confirmação não coincidem."

    return None

def normalize_email(email):
    """
    Normaliza o e-mail: tira espaços e deixa em minúsculas.
    Assim "Daniel@Email.com" e "daniel@email.com" viram a mesma conta.
    """
    if not email:
        return ""
    return str(email).strip().lower()

def get_otp_error(reset):
    """
    Confere se o código OTP ainda pode ser usado.
    Cobre os três casos mais importantes da aula:
    - já foi usado
    - passou do prazo
    - estourou o limite de tentativas
    """
    if not reset:
        return "Código inválido ou expirado."

    # used_at preenchido = código já foi consumido na troca de senha
    if reset.get('used_at'):
        return "Este código já foi utilizado. Solicite um novo."

    # Verifica expiração
    expires_at = reset.get('expires_at')
    # Pode ser uma string ou datetime dependendo do driver, pymysql retorna datetime
    if isinstance(expires_at, str):
        expires_at = datetime.strptime(expires_at, '%Y-%m-%d %H:%M:%S')
    
    if expires_at < datetime.now():
        return "Este código expirou. Solicite um novo."

    if reset.get('attempts', 0) >= OTP_MAX_ATTEMPTS:
        return "Número de tentativas excedido. Solicite um novo código."

    return None
