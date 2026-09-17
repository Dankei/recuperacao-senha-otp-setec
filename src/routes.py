"""
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
"""
from flask import Blueprint, request, jsonify, session
import src.database as db
from src.mailer import send_otp_email
from src.utils import (
    generate_otp,
    get_otp_expiration_date,
    hash_password,
    compare_password,
    is_valid_email,
    validate_register_input,
    validate_new_password,
    normalize_email,
    get_otp_error,
)

api = Blueprint('api', __name__)

FORGOT_PASSWORD_MESSAGE = "Se existir uma conta para este e-mail, enviamos um código de verificação."

def require_auth(func):
    """
    Usado nas rotas da API que exigem usuário logado (ex.: GET /api/me).
    Se não houver sessão, devolve 401 para o frontend redirecionar ao login.
    """
    def wrapper(*args, **kwargs):
        if 'user_id' not in session:
            return jsonify({"error": "Você precisa estar logado."}), 401
        return func(*args, **kwargs)
    wrapper.__name__ = func.__name__
    return wrapper

# ---------------------------------------------------------------------------
# Cadastro
# ---------------------------------------------------------------------------

@api.route('/register', methods=['POST'])
def register():
    data = request.json or {}
    name = data.get('name')
    email = data.get('email')
    password = data.get('password')
    confirm_password = data.get('confirmPassword')

    # 1) Valida os campos antes de tocar no banco.
    validation_error = validate_register_input(name, email, password, confirm_password)
    if validation_error:
        return jsonify({"error": validation_error}), 400

    normalized_email = normalize_email(email)

    # 2) Impede dois cadastros com o mesmo e-mail.
    existing = db.find_user_by_email(normalized_email)
    if existing:
        return jsonify({"error": "Já existe uma conta com este e-mail."}), 400

    # 3) Grava somente o hash. A senha original não entra no banco.
    password_hash = hash_password(password)

    db.create_user(name.strip(), normalized_email, password_hash)

    return jsonify({
        "message": "Conta criada com sucesso. Faça login para continuar."
    }), 201

# ---------------------------------------------------------------------------
# Login / logout / usuário logado
# ---------------------------------------------------------------------------

@api.route('/login', methods=['POST'])
def login():
    data = request.json or {}
    email = data.get('email')
    password = data.get('password')

    if not is_valid_email(email) or not password:
        return jsonify({"error": "Informe e-mail e senha."}), 400

    user = db.find_user_by_email(normalize_email(email))

    # Mesma mensagem para "e-mail não existe" e "senha errada".
    # Isso também evita vazar se uma conta está cadastrada.
    if not user or not compare_password(password, user['password_hash']):
        return jsonify({"error": "E-mail ou senha inválidos."}), 401

    # Guarda só o id na sessão. O cookie é enviado automaticamente pelo navegador.
    session['user_id'] = user['id']

    return jsonify({
        "message": "Login realizado com sucesso.",
        "user": {"id": user['id'], "name": user['name'], "email": user['email']}
    })

@api.route('/logout', methods=['POST'])
def logout():
    session.pop('user_id', None)
    return jsonify({"message": "Você saiu da conta."})

@api.route('/me', methods=['GET'])
@require_auth
def me():
    user = db.find_user_by_id(session['user_id'])
    if not user:
        session.pop('user_id', None)
        return jsonify({"error": "Sessão inválida."}), 401

    # Remover o hash e datas se quiser
    return jsonify({
        "user": {"id": user['id'], "name": user['name'], "email": user['email']}
    })

# ---------------------------------------------------------------------------
# Recuperação de senha
# ---------------------------------------------------------------------------

@api.route('/forgot-password', methods=['POST'])
def forgot_password():
    data = request.json or {}
    email = normalize_email(data.get('email'))

    if not is_valid_email(email):
        return jsonify({"error": "Informe um e-mail válido."}), 400

    user = db.find_user_by_email(email)

    # Se não existir conta, respondemos OK do mesmo jeito.
    # Não geramos código e não enviamos e-mail.
    if not user:
        return jsonify({"message": FORGOT_PASSWORD_MESSAGE})

    # 1) Queima códigos antigos daquele usuário.
    db.invalidate_previous_codes(user['id'])

    # 2) Gera um OTP de 6 dígitos e define a validade.
    code = generate_otp()
    expires_at = get_otp_expiration_date()

    # 3) Salva o código no banco para validar depois.
    db.create_password_reset(user['id'], code, expires_at)

    # 4) Envia o e-mail (ou imprime no terminal, se SMTP não estiver no .env).
    try:
        send_otp_email(user['email'], code)
    except Exception as e:
        # Não devolvemos detalhes internos (senha, host, stack) para o navegador.
        print(f"Falha ao enviar e-mail de recuperação: {e}")
        return jsonify({
            "error": "Não foi possível enviar o e-mail. Tente novamente em instantes."
        }), 500

    return jsonify({"message": FORGOT_PASSWORD_MESSAGE})

@api.route('/verify-code', methods=['POST'])
def verify_code():
    data = request.json or {}
    email = normalize_email(data.get('email'))
    code = str(data.get('code') or '').strip()

    if not is_valid_email(email) or not code:
        return jsonify({"error": "Informe o e-mail e o código."}), 400

    user = db.find_user_by_email(email)
    reset = db.find_active_reset_by_user_id(user['id']) if user else None

    # Se o e-mail não existe, tratamos como código inválido.
    # De novo: não revelamos se a conta existe.
    otp_error = get_otp_error(reset)
    if otp_error:
        return jsonify({"error": otp_error}), 400

    # Código errado: incrementa tentativas e avisa.
    if str(reset['code']) != code:
        db.increment_reset_attempts(reset['id'])

        next_attempts = reset.get('attempts', 0) + 1
        if next_attempts >= 5:
            return jsonify({
                "error": "Número de tentativas excedido. Solicite um novo código."
            }), 400

        return jsonify({"error": "Código incorreto."}), 400

    # Código certo, ainda válido e não usado.
    # Ainda NÃO marcamos como usado: isso acontece só ao gravar a nova senha.
    return jsonify({
        "message": "Código validado. Defina uma nova senha."
    })

@api.route('/reset-password', methods=['POST'])
def reset_password():
    data = request.json or {}
    email = normalize_email(data.get('email'))
    code = str(data.get('code') or '').strip()
    password = data.get('password')
    confirm_password = data.get('confirmPassword')

    password_error = validate_new_password(password, confirm_password)
    if password_error:
        return jsonify({"error": password_error}), 400

    if not is_valid_email(email) or not code:
        return jsonify({"error": "Informe o e-mail e o código."}), 400

    user = db.find_user_by_email(email)
    reset = db.find_active_reset_by_user_id(user['id']) if user else None
    otp_error = get_otp_error(reset)

    if otp_error:
        return jsonify({"error": otp_error}), 400

    # Revalidamos o código aqui. Assim ninguém pula a tela de verificação
    # e tenta trocar a senha direto com um código aleatório.
    if str(reset['code']) != code:
        db.increment_reset_attempts(reset['id'])
        return jsonify({"error": "Código incorreto ou expirado."}), 400

    # 1) Nova senha vira hash.
    password_hash = hash_password(password)

    # 2) Atualiza a senha do usuário.
    db.update_user_password(user['id'], password_hash)

    # 3) Queima o código: ele é de uso único.
    db.mark_reset_as_used(reset['id'])

    return jsonify({
        "message": "Senha redefinida com sucesso. Faça login com a nova senha."
    })
