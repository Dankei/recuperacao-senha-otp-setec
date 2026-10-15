<?php

namespace App\Providers;

use App\Database;
use Illuminate\Support\ServiceProvider;
use Throwable;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Confere o MariaDB antes de atender a página.
     * Comandos do Artisan (key:generate, etc.) não passam por aqui.
     */
    public function boot(): void
    {
        if ($this->app->runningInConsole()) {
            return;
        }

        try {
            Database::testConnection();
        } catch (Throwable $e) {
            fwrite(STDERR, "Não foi possível conectar no MariaDB.\n");
            fwrite(STDERR, "1) Suba o MariaDB\n");
            fwrite(STDERR, "2) Rode: mysql -u root < sql/create-database.sql\n");
            fwrite(STDERR, "3) Confira DB_USERNAME=root e DB_PASSWORD vazio no .env\n");

            abort(500, 'Não foi possível conectar no MariaDB.');
        }
    }
}
