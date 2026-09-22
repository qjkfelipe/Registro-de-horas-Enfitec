<?php
// Copie este arquivo para "config.php" e ajuste os valores.
// O config.php NÃO deve ir para o Git (contém segredos).

return [
    // ---- Banco de dados (PDO) ----
    // Produção (MySQL/MariaDB da UFRGS):
    //   'db_dsn'  => 'mysql:host=localhost;dbname=enfitec_horas;charset=utf8mb4',
    //   'db_user' => 'usuario',
    //   'db_pass' => 'senha',
    // Desenvolvimento (SQLite, não precisa de servidor de banco):
    'db_dsn'  => 'sqlite:' . __DIR__ . '/registrador.db',
    'db_user' => null,
    'db_pass' => null,

    // ---- Segurança ----
    // OBRIGATÓRIO em produção: gere um valor próprio e cole aqui —
    //   php -r 'echo bin2hex(random_bytes(32)), "\n";'
    // Definir aqui evita a geração automática em disco (corrida no NFS — M-08).
    // Trocar este valor invalida TODAS as sessões ativas (botão de emergência).
    'jwt_secret'        => 'troque-por-um-segredo-bem-aleatorio',
    'sessao_expira_min' => 60 * 24 * 7, // 7 dias (considere 12–24 h em produção — M-02)

    // Exigir HTTPS (M-06). Deixe true em produção; localhost é sempre isento.
    'exigir_https'  => true,
    // Só marque true se houver DE FATO um proxy reverso na frente (senão o
    // cabeçalho X-Forwarded-Proto seria forjável e burlaria a exigência de HTTPS).
    'atras_de_proxy' => false,

    // ---- Front-end (CORS) ----
    'frontend_url' => 'http://localhost:5173',
];
