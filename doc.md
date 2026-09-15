Crie um projeto completo em **JavaScript** para ser utilizado em um mini curso onde ensinarei, passo a passo, como implementar o fluxo de **“Esqueci minha senha” utilizando OTP enviado por e-mail**.

O projeto deve ser simples, didático e fácil de entender para alunos iniciantes/intermediários. Evite abstrações e arquiteturas desnecessariamente complexas.

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

* JavaScript puro no backend.
* Node.js.
* Express.
* Banco de dados SQLite para facilitar a execução pelos alunos.
* HTML, CSS e JavaScript simples no frontend.
* Nodemailer para envio de e-mails.
* bcrypt para armazenamento seguro das senhas.
* dotenv para variáveis de ambiente.

Não utilize TypeScript, React, Next.js ou outros frameworks frontend. O objetivo é deixar o código o mais simples e didático possível.

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

Crie automaticamente o banco SQLite e as tabelas necessárias.

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
→ envia o código por e-mail utilizando Nodemailer
→ usuário informa o código
→ servidor valida o código
→ verifica expiração e tentativas
→ permite cadastrar uma nova senha
→ senha é transformada em hash
→ senha é atualizada
→ código é marcado como utilizado
→ usuário volta para o login.

## E-mail

Utilize Nodemailer com SMTP do Google.

As credenciais devem ficar no `.env`, por exemplo:

EMAIL_USER=
EMAIL_PASSWORD=

Crie também um `.env.example`.

Nunca coloque credenciais diretamente no código.

No README, explique que o aluno deve utilizar uma **App Password do Google**, e não a senha normal da conta.

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

Crie endpoints simples e fáceis de explicar durante a aula, por exemplo:

POST /api/register
POST /api/login
POST /api/logout
POST /api/forgot-password
POST /api/verify-code
POST /api/reset-password

Organize o código de forma simples, deixando claro onde estão:

* Rotas.
* Regras de negócio.
* Banco de dados.
* Envio de e-mail.
* Autenticação.
* Utilitários.

Não crie uma arquitetura exageradamente sofisticada.

## Interface

Crie uma interface limpa e agradável, mas simples.

O foco do projeto é o funcionamento do backend e do processo de recuperação de senha, não o design.

Utilize CSS próprio, sem necessidade de frameworks.

As páginas devem ser responsivas e apresentar mensagens claras de sucesso e erro.

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
