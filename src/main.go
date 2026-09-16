package main
  import (
      "fmt"
      "net/http"
      "os"
      "github.com/joho/godotenv"
  )
/**
 * Ponto de entrada do servidor.
 *
 * Ordem de inicialização (importante para a aula):
 * 1. Carrega variáveis do .env
 * 2. Inicia sessão (cookie)
 * 3. Testa a conexão com o MariaDB
 * 4. Cria o mux
 * 5. Protege a página /home.html e redireciona a raiz
 * 6. Liga as rotas /api/...
 * 7. Serve os arquivos HTML/CSS/JS da pasta public/
 * 8. Escuta a porta
 */
func main() {
	// Precisa ser a primeira coisa: assim os.Getenv já está preenchido
	// quando os outros serviços (e-mail, sessão, MariaDB) forem usados.
	_ = godotenv.Load()
	port := envOr("PORT", "3000")
	secret := envOr("SESSION_SECRET", "chave-apenas-para-aula")

	// Sessão baseada em cookie. O navegador guarda um id; o servidor
	// associa esse id ao userId depois do login.
	initSessionStore(secret)

	// Confere o MariaDB antes de aceitar requisições.
	if err := openDatabase(); err != nil {
		failDatabase(err)
	}
	defer db.Close()
	if err := testConnection(); err != nil {
		failDatabase(err)
	}

	mux := http.NewServeMux()

	// A home só faz sentido com alguém logado.
	// Esta rota vem ANTES do fileServer para interceptar /home.html.
	mux.HandleFunc("GET /home.html", requirePageAuth(func(w http.ResponseWriter, r *http.Request) {
		http.ServeFile(w, r, "public/home.html")
	}))

	// A raiz do site manda para a home (se logado) ou para o login.
	mux.HandleFunc("GET /{$}", func(w http.ResponseWriter, r *http.Request) {
		if _, ok := getSessionUserID(r); ok {
			http.Redirect(w, r, "/home.html", http.StatusFound)
			return
		}
		http.Redirect(w, r, "/login.html", http.StatusFound)
	})

	// Todas as rotas da API começam com /api
	registerAPIRoutes(mux)

	// Arquivos estáticos: HTML, CSS e JS do frontend.
	fileServer := http.FileServer(http.Dir("public"))
	mux.Handle("GET /", fileServer)

	fmt.Printf("Servidor no ar: http://localhost:%s\n", port)
	fmt.Println("Abra o navegador nessa URL para começar a aula.")
	if err := http.ListenAndServe(":"+port, mux); err != nil {
		fmt.Println("Erro ao iniciar o servidor:", err)
		os.Exit(1)
	}
}
  func failDatabase(err error) {
      fmt.Println("Não foi possível conectar no MariaDB.")
      fmt.Println("1) Suba o MariaDB")
      fmt.Println("2) Rode: mysql -u root < sql/create-database.sql")
      fmt.Println("3) Confira DB_USER=root e DB_PASSWORD vazio no .env")
      fmt.Println("Detalhe:", err)
      os.Exit(1)
  }