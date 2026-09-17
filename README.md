# Esqueci minha senha com OTP (Versão Golang)

Projeto didático em Go (Golang) para um mini curso. Ele mostra, passo a passo, um fluxo real de **cadastro**, **login** e **recuperação de senha** usando um código OTP enviado por e-mail.

O código é propositalmente simples e utiliza a biblioteca padrão do Go sempre que possível (especialmente as novidades de roteamento do Go 1.22). Sem frameworks como Gin ou Echo, apenas `net/http` e pacotes leves.

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

O OTP é enviado pelo Gmail usando o pacote `net/smtp`. Se o e-mail não estiver configurado, o código aparece no terminal para a aula continuar.

---

## 2. Como instalar

Requisitos:

- Go 1.22 ou superior
- MariaDB (ou MySQL compatível) rodando na máquina

No terminal, dentro da pasta do projeto, baixe as dependências:

```bash
go mod tidy
```

Isso baixa os pacotes `mysql`, `bcrypt`, `gorilla/sessions` e `godotenv`.

Depois, crie o banco (usuário `root` sem senha):

Se o cliente do seu computador se chama `mariadb`:

```bash
mariadb -u root < sql/create-database.sql
```

---

## 3. Como configurar o `.env`

Copie o arquivo de exemplo:

```bash
cp .env.example .env
```

Variáveis:

| Variável | Para que serve |
|---|---|
| `PORT` | Porta do servidor (padrão `3000`) |
| `DB_HOST` | Endereço do MariaDB (`localhost`) |
| `DB_PORT` | Porta do MariaDB (`3306`) |
| `DB_USER` | Usuário do banco (`root` na aula) |
| `DB_PASSWORD` | Senha do banco (vazia na aula) |
| `DB_NAME` | Nome do banco (`cruso_setec`) |
| `SESSION_SECRET` | Frase secreta que assina o cookie de sessão |
| `EMAIL_USER` | Conta Gmail que envia o OTP |
| `EMAIL_PASSWORD` | App Password do Google (16 caracteres) |

Nunca cole senhas no código-fonte. O arquivo `.env` fica de fora do Git.

Se `EMAIL_USER` e `EMAIL_PASSWORD` ficarem vazios, o projeto ainda funciona: o OTP é impresso no terminal.

---

## 4. Como criar a App Password do Google

O Gmail **não aceita a senha normal da conta** no Nodemailer. Use uma senha de aplicativo.

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

No terminal, na pasta do projeto:

```bash
go run ./src/*.go
```

Abra no navegador:

```
http://localhost:3000
```

Antes de iniciar, o banco precisa existir. Rode o script de banco pelo menos uma vez.

---

## 6. Estrutura das pastas

```
cruso-setec/
├── .env.example          # modelo das variáveis de ambiente
├── go.mod / go.sum       # dependências do Go
├── README.md
├── sql/
│   └── create-database.sql  # cria o banco e as tabelas no MariaDB
├── src/
│   ├── main.go           # ponto de entrada, sobe o servidor e variáveis
│   ├── routes.go         # endpoints da API (regras de negócio)
│   ├── database.go       # conexão MariaDB e consultas
│   ├── email.go          # envio do OTP via net/smtp
│   ├── auth.go           # middleware de sessão usando gorilla/sessions
│   └── utils.go          # OTP, validações e hash da senha
└── public/
    ├── css/style.css
    ├── js/app.js         # fetch compartilhado e mensagens
    ├── login.html
    ├── register.html
    ├── home.html
    ├── forgot-password.html
    ├── verify-code.html
    └── reset-password.html
```

Onde cada coisa mora:

- **Rotas:** `src/routes.go`
- **Regras de negócio:** também em `src/routes.go` (de propósito, para a aula)
- **Banco de dados:** `src/database.go`
- **Envio de e-mail:** `src/email.go`
- **Autenticação:** `src/auth.go` + sessão no `src/main.go`
- **Utilitários:** `src/utils.go`

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
4. Se estiver correto, grava `userId` na sessão (cookie `connect.sid`).
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
- O OTP é aleatório (`crypto.randomInt`), tem 6 dígitos e vale 10 minutos.
- Cada código é de **uso único** (`used_at`).
- Depois de 5 tentativas erradas, o código deixa de ser aceito.
- Pedir um código novo invalida os anteriores daquele usuário.
- Um OTP expirado não redefine a senha.
- “Esqueci minha senha” **não revela** se o e-mail está cadastrado.
- Login também usa mensagem genérica: “E-mail ou senha inválidos.”
- Credenciais ficam no `.env`.
- O servidor valida os dados recebidos (e-mail, tamanho da senha, confirmação).
- O cookie de sessão é `httpOnly` (o JavaScript da página não lê o cookie).
- Senhas e códigos não são impressos nos logs quando o SMTP está configurado.

Este projeto é material de aula. Em produção, ainda faltariam itens como HTTPS obrigatório, limite de pedidos por IP, hash do próprio OTP no banco e um gerenciador de sessão persistente.
