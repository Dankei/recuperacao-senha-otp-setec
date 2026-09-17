"""
Ponto de entrada do servidor.

Ordem de inicialização (importante para a aula):
1. Carrega variáveis do .env
2. Testa a conexão com o MariaDB
3. Cria o app Flask
4. Liga sessão (cookie) e leitura de JSON
5. Protege a página /home.html
6. Serve os arquivos HTML/CSS/JS da pasta public/
7. Liga as rotas /api/...
8. Escuta a porta
"""

import os
import sys
from flask import Flask, send_from_directory, redirect, session
from dotenv import load_dotenv

# 1. Carrega variáveis do .env
load_dotenv()

from src.database import test_connection
from src.routes import api, require_auth

# 2. Testa a conexão com o MariaDB
try:
    test_connection()
except Exception as e:
    print("Não foi possível conectar no MariaDB.", file=sys.stderr)
    print("1) Suba o MariaDB", file=sys.stderr)
    print("2) Rode: mariadb -u root < sql/create-database.sql", file=sys.stderr)
    print("3) Confira DB_USER=root e DB_PASSWORD vazio no .env", file=sys.stderr)
    print(f"Erro detalhado: {e}", file=sys.stderr)
    sys.exit(1)

# 3. Cria o app Flask e serve os arquivos estáticos
app = Flask(__name__, static_folder='../public', static_url_path='')

# 4. Liga sessão (cookie)
# Sessão baseada em cookie. O navegador guarda um id criptografado.
app.secret_key = os.getenv('SESSION_SECRET', 'chave-apenas-para-aula')
app.config['SESSION_COOKIE_HTTPONLY'] = True
app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'
app.config['PERMANENT_SESSION_LIFETIME'] = 7200 # 2 horas

# 5. Protege a página /home.html
@app.route('/home.html')
def home_html():
    if 'user_id' not in session:
        return redirect('/login.html')
    return send_from_directory(app.static_folder, 'home.html')

# 6. A raiz do site manda para a home (se logado) ou para o login.
@app.route('/')
def index():
    if 'user_id' in session:
        return redirect('/home.html')
    return redirect('/login.html')

# 7. Liga as rotas /api/...
app.register_blueprint(api, url_prefix='/api')

# 8. Escuta a porta
if __name__ == '__main__':
    port = int(os.getenv('PORT', 3000))
    print(f"Servidor no ar: http://localhost:{port}")
    print("Abra o navegador nessa URL para começar a aula.")
    app.run(host='0.0.0.0', port=port, debug=True)
