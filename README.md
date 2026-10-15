# Esqueci minha senha com OTP

Projeto didático em PHP para um mini curso. Ele mostra, passo a passo, um fluxo real de **cadastro**, **login** e **recuperação de senha** usando um código OTP enviado por e-mail.

O código é propositalmente simples: Laravel, MariaDB, HTML, CSS e JavaScript puro. Sem React ou Next.js. O frontend é o mesmo da versão Node: páginas estáticas que chamam a API.

---

## 1. O que é o projeto

Uma aplicação web pequena com:

- cadastro de usuário (nome, e-mail e senha)
- login e logout com sessão em cookie
- página inicial autenticada (`Olá, [nome]!`)
- “Esqueci minha senha” com OTP de 6 dígitos
- validação do código (expiração e tentativas)
- definição de uma nova senha
- login de novo com a senha atualizada

O OTP é enviado pelo Gmail via mailer do Laravel. Se o e-mail não estiver configurado, o código aparece no terminal para a aula continuar.

---

## 2. Como instalar

Requisitos:

- PHP 8.3 ou superior (com `pdo_mysql` e `mbstring`)
- Composer
- MariaDB (ou MySQL compatível) rodando na máquina

No terminal, dentro da pasta do projeto:

```bash
composer install
```

Isso instala o Laravel. O hash da senha usa `password_hash` do PHP (bcrypt), sem biblioteca extra.

Depois, crie o banco (usuário `root` sem senha):

```bash
mysql -u root < sql/create-database.sql
```

Se o cliente do seu computador se chama `mariadb`:

```bash
mariadb -u root < sql/create-database.sql
```

O Laravel desta aula **não** cria as tabelas por migration. O script SQL é a fonte do banco, igual na versão em JavaScript.

---

## 3. Como configurar o `.env`

Copie o arquivo de exemplo:

```bash
cp .env.example .env
php artisan key:generate
```

`php artisan key:generate` preenche `APP_KEY`. Essa chave assina o cookie de sessão.

Variáveis da aula:

| Variável | Para que serve |
|---|---|
| `APP_URL` | URL do site (`http://localhost:3000`) |
| `APP_KEY` | Chave que assina o cookie de sessão |
| `DB_HOST` | Endereço do MariaDB (`localhost`) |
| `DB_PORT` | Porta do MariaDB (`3306`) |
| `DB_DATABASE` | Nome do banco (`cruso_setec`) |
| `DB_USERNAME` | Usuário do banco (`root` na aula) |
| `DB_PASSWORD` | Senha do banco (vazia na aula) |
| `EMAIL_USER` | Conta Gmail que envia o OTP |
| `EMAIL_PASSWORD` | App Password do Google (16 caracteres) |

A sessão fica em arquivo (`SESSION_DRIVER=file`) por 2 horas (`SESSION_LIFETIME=120`). O cookie é `httpOnly` e `sameSite=lax`.

Nunca cole senhas no código-fonte. O arquivo `.env` fica de fora do Git.

Se `EMAIL_USER` e `EMAIL_PASSWORD` ficarem vazios, o projeto ainda funciona: o OTP é impresso no terminal.

---

## 4. Como criar a App Password do Google

O Gmail **não aceita a senha normal da conta** no SMTP. Use uma senha de aplicativo.

1. Acesse a conta Google que vai enviar os e-mails.
2. Ative a **verificação em duas etapas**.
3. Abra [Senhas de app](https://myaccount.google.com/apppasswords).
4. Crie uma senha para “E-mail” / “Outro dispositivo”.
5. Copie os 16 caracteres gerados.
6. Cole esse valor em `EMAIL_PASSWORD` no `.env`.
7. Coloque o e-mail da conta em `EMAIL_USER`.

Se a tela de senhas de app não aparecer, a verificação em duas etapas ainda não está ativa.

---

## 5. Como iniciar o projeto

```bash
php artisan serve --port=3000
```

O mesmo comando está em `composer start` e `composer run dev`.

Abra no navegador:

```
http://localhost:3000
```

Antes de iniciar, o banco precisa existir. Rode `mysql -u root < sql/create-database.sql` uma vez.

---

## 6. Estrutura das pastas

```
cruso-setec/
├── .env.example
├── artisan
├── composer.json
├── README.md
├── sql/
│   └── create-database.sql
├── app/
│   ├── Database.php          # conexão MariaDB e consultas
│   ├── Email.php             # envio do OTP
│   ├── Utils.php             # OTP, validações e hash da senha
│   └── Http/
│       ├── Controllers/
│       │   └── ApiController.php   # endpoints da API
│       └── Middleware/
│           └── RequireAuth.php     # checagem da sessão
├── bootstrap/
│   └── app.php               # sessão web e exceção de CSRF em /api
├── routes/
│   └── web.php               # páginas HTML e rotas /api
├── resources/
│   └── pages/                # HTML servido pelas rotas
└── public/
    ├── css/style.css
    ├── js/app.js
    └── index.php             # porta de entrada do Laravel
```

O Laravel também traz `config/`, `storage/` e `vendor/`. A aula mora nos arquivos acima.

Onde cada coisa mora:

- **Rotas:** `routes/web.php` e `app/Http/Controllers/ApiController.php`
- **Regras de negócio:** `ApiController.php` (de propósito, para a aula)
- **Banco de dados:** `app/Database.php` e `sql/create-database.sql`
- **Envio de e-mail:** `app/Email.php`
- **Autenticação:** `app/Http/Middleware/RequireAuth.php` e a sessão do grupo `web`
- **Utilitários:** `app/Utils.php`

Os HTML ficam em `resources/pages/` e não na raiz de `public/`. O `php artisan serve` entrega qualquer arquivo que já exista em `public/` sem passar pelo Laravel. Se `home.html` estivesse lá, a checagem de sessão não rodaria.

---

## 7. Estrutura do banco

MariaDB no banco `cruso_setec`, criado pelo script [sql/create-database.sql](sql/create-database.sql).

### `users`

| Coluna | Significado |
|---|---|
| `id` | Identificador automático |
| `name` | Nome do usuário |
| `email` | E-mail único |
| `password_hash` | Senha transformada com bcrypt |
| `created_at` | Data de criação |

### `password_resets`

| Coluna | Significado |
|---|---|
| `id` | Identificador automático |
| `user_id` | Dono do código (liga com `users.id`) |
| `code` | OTP de 6 dígitos |
| `expires_at` | Até quando o código vale |
| `used_at` | Preenchido quando o código é queimado |
| `attempts` | Quantas vezes o aluno errou o código |
| `created_at` | Quando o código foi gerado |

---

## 8. Fluxo de cadastro

1. O aluno abre `register.html`.
2. Preenche nome, e-mail, senha e confirmação.
3. O navegador chama `POST /api/register`.
4. O servidor valida os campos.
5. Se o e-mail já existir, devolve erro.
6. A senha vira hash com bcrypt e só o hash entra no banco.
7. A conta é criada e a tela volta para o login.

---

## 9. Fluxo de login

1. O aluno informa e-mail e senha em `login.html`.
2. O navegador chama `POST /api/login`.
3. O servidor busca o usuário e compara a senha com o hash.
4. Se estiver correto, grava `userId` na sessão (cookie do Laravel).
5. A home chama `GET /api/me` e mostra `Olá, [nome]!`.
6. “Sair da conta” chama `POST /api/logout` e apaga a sessão.

---

## 10. Fluxo de recuperação de senha

1. Em `forgot-password.html`, o aluno informa o e-mail.
2. `POST /api/forgot-password` procura a conta.
3. A resposta é **sempre a mesma**, exista conta ou não.
4. Se a conta existir:
   - códigos anteriores são invalidados
   - um OTP de 6 dígitos é gerado
   - o código é salvo com validade de 10 minutos
   - o e-mail é enviado (ou o código aparece no terminal)
5. Em `verify-code.html`, o aluno digita o OTP.
6. `POST /api/verify-code` confere código, prazo e tentativas (máximo 5).
7. Em `reset-password.html`, o aluno define a nova senha.
8. `POST /api/reset-password` valida o código de novo, grava o hash, marca o código como usado e manda de volta ao login.
9. O aluno entra com a senha nova.

---

## 11. Explicação de cada endpoint

| Método | Rota | O que faz |
|---|---|---|
| `POST` | `/api/register` | Cria o usuário. Corpo: `name`, `email`, `password`, `confirmPassword`. |
| `POST` | `/api/login` | Autentica e abre a sessão. Corpo: `email`, `password`. |
| `POST` | `/api/logout` | Destroi a sessão e limpa o cookie. |
| `GET` | `/api/me` | Devolve o usuário logado. Exige cookie de sessão. |
| `POST` | `/api/forgot-password` | Gera e envia o OTP. Corpo: `email`. |
| `POST` | `/api/verify-code` | Valida o OTP. Corpo: `email`, `code`. |
| `POST` | `/api/reset-password` | Troca a senha. Corpo: `email`, `code`, `password`, `confirmPassword`. |

Exemplos com `curl`:

```bash
# Cadastro
curl -X POST http://localhost:3000/api/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Ana","email":"ana@email.com","password":"123456","confirmPassword":"123456"}'

# Login (guarde o cookie)
curl -c cookies.txt -X POST http://localhost:3000/api/login \
  -H "Content-Type: application/json" \
  -d '{"email":"ana@email.com","password":"123456"}'

# Quem está logado
curl -b cookies.txt http://localhost:3000/api/me
```

---

## 12. Principais cuidados de segurança

- A senha original **nunca** é gravada. Só o hash do bcrypt.
- O OTP é aleatório (`random_int`), tem 6 dígitos e vale 10 minutos.
- Cada código é de **uso único** (`used_at`).
- Depois de 5 tentativas erradas, o código deixa de ser aceito.
- Pedir um código novo invalida os anteriores daquele usuário.
- Um OTP expirado não redefine a senha.
- “Esqueci minha senha” **não revela** se o e-mail está cadastrado.
- Login também usa mensagem genérica: “E-mail ou senha inválidos.”
- Credenciais ficam no `.env`.
- O servidor valida os dados recebidos (e-mail, tamanho da senha, confirmação).
- O cookie de sessão é `httpOnly` (o JavaScript da página não lê o cookie).
- As rotas `/api` não exigem token CSRF porque o frontend já envia o cookie com `credentials: 'same-origin'`.
- Senhas e códigos não são impressos nos logs quando o SMTP está configurado.

Este projeto é material de aula. Em produção, ainda faltariam itens como HTTPS obrigatório, limite de pedidos por IP, hash do próprio OTP no banco e proteção CSRF no frontend.
