Crie um projeto completo em **PHP com Laravel** para ser utilizado em um mini curso onde ensinarei, passo a passo, como implementar o fluxo de **“Esqueci minha senha” utilizando OTP enviado por e-mail**.

O projeto deve ser simples, didático e fácil de entender para alunos iniciantes/intermediários. Evite abstrações e arquiteturas desnecessariamente complexas.

Esta branch é a versão Laravel do mesmo fluxo. O frontend (HTML, CSS e JavaScript puro) permanece.

## Objetivo do projeto

O sistema deve simular uma aplicação real simples contendo:

* Cadastro de usuário com nome, e-mail e senha.
* Login utilizando e-mail e senha.
* Página inicial após o login.
* Logout.
* Funcionalidade “Esqueci minha senha”.
* Recuperação de senha através de código OTP enviado por e-mail.
* Validação do OTP.
* Definição de uma nova senha.
* Possibilidade de realizar login novamente com a nova senha.

## Stack

Utilize:

* PHP 8.3 ou superior.
* Laravel.
* Banco de dados MariaDB, criado pelo script `sql/create-database.sql` (sem migrations da aula).
* HTML, CSS e JavaScript simples no frontend.
* Mailer do Laravel (SMTP do Gmail) para envio de e-mails.
* `password_hash` / `password_verify` (bcrypt, custo 10) para as senhas.
* `.env` do Laravel para variáveis de ambiente.

Não utilize React, Next.js ou outros frameworks frontend. O objetivo é deixar o código o mais simples e didático possível.

## Páginas

Crie as seguintes páginas:

### Login

* Campo de e-mail.
* Campo de senha.
* Botão “Entrar”.
* Link “Esqueci minha senha”.
* Link “Criar conta”.

### Cadastro

* Nome.
* E-mail.
* Senha.
* Confirmação de senha.
* Botão para cadastrar.
* Link para voltar ao login.

### Área autenticada

Após o login, mostrar uma página simples informando:

“Olá, [nome]!”

Adicionar um botão para sair da conta.

Não é necessário criar funcionalidades complexas nessa área. Ela existe apenas para demonstrar que o login funcionou.

### Esqueci minha senha

* Campo para informar o e-mail.
* Botão “Enviar código”.
* Mensagem informando que, caso exista uma conta para aquele e-mail, um código será enviado.

### Validar código

* Campo para informar o OTP recebido por e-mail.
* Botão “Validar código”.
* Informar claramente quando o código estiver incorreto ou expirado.

### Nova senha

* Nova senha.
* Confirmação da nova senha.
* Botão “Redefinir senha”.
* Após sucesso, direcionar o usuário para o login.

## Banco de dados

As tabelas são criadas pelo script SQL, não automaticamente pelo Laravel.

Tabela `users`:

* id
* name
* email
* password_hash
* created_at

Tabela `password_resets`:

* id
* user_id
* code
* expires_at
* used_at
* attempts
* created_at

Utilize `password_hash` em vez de armazenar a senha original.

## Fluxo de recuperação

Implemente exatamente este fluxo:

Usuário clica em “Esqueci minha senha”
→ informa o e-mail
→ servidor procura a conta
→ gera um código OTP de 6 dígitos
→ salva o código no banco
→ define uma validade para o código
→ envia o código por e-mail
→ usuário informa o código
→ servidor valida o código
→ verifica expiração e tentativas
→ permite cadastrar uma nova senha
→ senha é transformada em hash
→ senha é atualizada
→ código é marcado como utilizado
→ usuário volta para o login.

## E-mail

Utilize o mailer do Laravel com SMTP do Google.

As credenciais devem ficar no `.env`:

EMAIL_USER=
EMAIL_PASSWORD=

Crie também um `.env.example`.

Nunca coloque credenciais diretamente no código.

No README, explique que o aluno deve utilizar uma **App Password do Google**, e não a senha normal da conta.

Se essas variáveis estiverem vazias, imprima o OTP no terminal para a aula continuar.

## Segurança

Implemente boas práticas básicas:

* Senhas utilizando bcrypt.
* OTP aleatório de 6 dígitos.
* OTP com prazo de validade.
* OTP de uso único.
* Limite de tentativas.
* Invalidação de códigos utilizados.
* Invalidar códigos anteriores quando um novo código for solicitado.
* Não revelar se um e-mail está ou não cadastrado.
* Não expor senhas ou credenciais nos logs.
* Utilizar `.env`.
* Validar os dados recebidos pelo servidor.
* Impedir que um OTP expirado seja utilizado.

## API

Crie endpoints simples e fáceis de explicar durante a aula:

POST /api/register
POST /api/login
POST /api/logout
GET /api/me
POST /api/forgot-password
POST /api/verify-code
POST /api/reset-password

Organize o código de forma simples, deixando claro onde estão:

* Rotas: `routes/web.php` e `app/Http/Controllers/ApiController.php`.
* Regras de negócio: `ApiController.php`.
* Banco de dados: `app/Database.php`.
* Envio de e-mail: `app/Email.php`.
* Autenticação: `app/Http/Middleware/RequireAuth.php`.
* Utilitários: `app/Utils.php`.

Não crie uma arquitetura exageradamente sofisticada.

A sessão usa cookie `httpOnly`. As rotas `/api` ficam fora da verificação CSRF para o `fetch` atual do frontend continuar funcionando.

## Interface

Crie uma interface limpa e agradável, mas simples.

O foco do projeto é o funcionamento do backend e do processo de recuperação de senha, não o design.

Utilize CSS próprio, sem necessidade de frameworks.

As páginas devem ser responsivas e apresentar mensagens claras de sucesso e erro.

Sirva os HTML por rota (`resources/pages`), para que `/home.html` passe pelo middleware de sessão. CSS e JS ficam em `public/`.

## Material didático

Além do código, crie um `README.md` explicando:

1. O que é o projeto.
2. Como instalar.
3. Como configurar o `.env`.
4. Como criar/configurar a App Password do Google.
5. Como iniciar o projeto.
6. Estrutura das pastas.
7. Estrutura do banco.
8. Fluxo de cadastro.
9. Fluxo de login.
10. Fluxo de recuperação de senha.
11. Explicação de cada endpoint.
12. Principais cuidados de segurança.

O código deve possuir comentários pontuais apenas onde eles realmente ajudam a explicar conceitos importantes.

Priorize **clareza, simplicidade e valor didático**. O projeto será utilizado como base para uma aula em que o instrutor irá construir e explicar cada etapa do processo de recuperação de senha.
