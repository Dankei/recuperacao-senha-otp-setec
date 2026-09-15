/**
 * Ponto de entrada do servidor.
 *
 * Ordem de inicialização (importante para a aula):
 * 1. Carrega variáveis do .env
 * 2. Testa a conexão com o MariaDB
 * 3. Cria o app Express
 * 4. Liga sessão (cookie) e leitura de JSON
 * 5. Protege a página /home.html
 * 6. Serve os arquivos HTML/CSS/JS da pasta public/
 * 7. Liga as rotas /api/...
 * 8. Escuta a porta
 */

const path = require('path');
const express = require('express');
const session = require('express-session');

// Precisa ser a primeira coisa: assim process.env já está preenchido
// quando os outros arquivos (e-mail, sessão, MariaDB) forem usados.
require('dotenv').config();

const { testConnection } = require('./database');
const routes = require('./routes');
const { requirePageAuth } = require('./auth');

const app = express();
const PORT = process.env.PORT || 3000;

// Permite receber JSON no corpo das requisições (fetch do frontend).
app.use(express.json());

// Sessão baseada em cookie. O navegador guarda um id; o servidor
// associa esse id ao userId depois do login.
app.use(
  session({
    name: 'connect.sid',
    secret: process.env.SESSION_SECRET || 'chave-apenas-para-aula',
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true, // o JavaScript da página não consegue ler o cookie
      sameSite: 'lax',
      maxAge: 1000 * 60 * 60 * 2, // 2 horas
    },
  })
);

// A home só faz sentido com alguém logado.
// Esta rota vem ANTES do express.static para interceptar /home.html.
app.get('/home.html', requirePageAuth, (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'home.html'));
});

// Arquivos estáticos: HTML, CSS e JS do frontend.
app.use(express.static(path.join(__dirname, '..', 'public')));

// A raiz do site manda para a home (se logado) ou para o login.
app.get('/', (req, res) => {
  if (req.session.userId) {
    return res.redirect('/home.html');
  }

  return res.redirect('/login.html');
});

// Todas as rotas da API começam com /api
app.use('/api', routes);

async function start() {
  // Confere o MariaDB antes de aceitar requisições.
  await testConnection();

  app.listen(PORT, () => {
    console.log(`Servidor no ar: http://localhost:${PORT}`);
    console.log('Abra o navegador nessa URL para começar a aula.');
  });
}

start().catch(() => {
  console.error('Não foi possível conectar no MariaDB.');
  console.error('1) Suba o MariaDB');
  console.error('2) Rode: mysql -u root < sql/create-database.sql');
  console.error('3) Confira DB_USER=root e DB_PASSWORD vazio no .env');
  process.exit(1);
});
