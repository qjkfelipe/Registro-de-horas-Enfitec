<?php
// Carrega config, abre o banco e expõe helpers. Incluído por todos os endpoints.

declare(strict_types=1);

// ---- Compatibilidade com PHP 7.4 (funções que só existem no PHP 8) ----
if (!function_exists('str_starts_with')) {
    function str_starts_with(string $h, string $n): bool
    {
        return $n === '' || strncmp($h, $n, strlen($n)) === 0;
    }
}
if (!function_exists('str_contains')) {
    function str_contains(string $h, string $n): bool
    {
        return $n === '' || strpos($h, $n) !== false;
    }
}

// ---- Erros (M-01): na web, nunca exibir detalhes internos ao cliente ----
// Captura qualquer exceção/Error não tratado (falha de banco, tipo inesperado no JSON,
// etc.), registra no log do servidor e responde 500 genérico — corrigindo também o
// HTTP 200 indevido de fatais que ocorrem antes de http_response_code().
if (PHP_SAPI !== 'cli') {
    ini_set('display_errors', '0');
    ini_set('log_errors', '1');
    error_reporting(E_ALL);
    set_exception_handler(function (Throwable $e): void {
        error_log('[registrador-horas] ' . $e->getMessage() . ' @ ' . $e->getFile() . ':' . $e->getLine());
        if (!headers_sent()) {
            http_response_code(500);
            header('Content-Type: application/json; charset=utf-8');
        }
        echo json_encode(['erro' => 'Erro interno. Tente novamente mais tarde.']);
        exit;
    });
}

// ---- Fuso horário da aplicação (o servidor pode estar em UTC) ----
date_default_timezone_set('America/Sao_Paulo');

// ---- Config ----
$config_path = __DIR__ . '/../config.php';
if (!file_exists($config_path)) {
    http_response_code(500);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['erro' => 'Backend não configurado: crie config.php a partir de config.example.php.']);
    exit;
}
$CONFIG = require $config_path;

// Segurança: se o segredo JWT ainda for o placeholder, gera um aleatório forte
// e persiste num arquivo protegido — evita tokens forjáveis por esquecimento.
if (($CONFIG['jwt_secret'] ?? '') === 'troque-por-um-segredo-bem-aleatorio') {
    $arqSegredo = __DIR__ . '/.jwt_secret';
    // Criação ATÔMICA (M-08): 'x' falha se o arquivo já existir — evita a corrida em
    // que duas requisições simultâneas geram segredos diferentes (agravada no NFS).
    // Ainda assim, o ideal é definir jwt_secret no config.php (aí este bloco nem roda).
    $fp = @fopen($arqSegredo, 'x');
    if ($fp !== false) {
        fwrite($fp, bin2hex(random_bytes(32)));
        fclose($fp);
    }
    $CONFIG['jwt_secret'] = trim((string) file_get_contents($arqSegredo));
}

// ---- CORS ----
function aplicar_cors(array $config): void
{
    header('Access-Control-Allow-Origin: ' . $config['frontend_url']);
    header('Access-Control-Allow-Methods: GET, POST, DELETE, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type, Authorization');
    header('Vary: Origin'); // B-06

    // ---- Cabeçalhos de segurança (M-06). A API só devolve JSON, então CSP é restritiva. ----
    header('X-Content-Type-Options: nosniff');
    header('X-Frame-Options: DENY');
    header('Referrer-Policy: no-referrer');
    header('Cache-Control: no-store');
    header("Content-Security-Policy: default-src 'none'; frame-ancestors 'none'");

    if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
        http_response_code(204);
        exit;
    }

    // ---- Exigir HTTPS (M-06), exceto em localhost. ----
    // X-Forwarded-Proto só é confiável se houver mesmo um proxy reverso na frente
    // (config 'atras_de_proxy'); sem isso, qualquer cliente forjaria o cabeçalho.
    $atrasDeProxy = ($config['atras_de_proxy'] ?? false) === true;
    $https = ($_SERVER['HTTPS'] ?? '') === 'on'
          || ($atrasDeProxy && ($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https');
    $host = $_SERVER['SERVER_NAME'] ?? '';
    if ($https) {
        // Sem includeSubDomains: em subdiretório de site institucional, isso afetaria
        // todo o if.ufrgs.br — não cabe a esta aplicação decidir.
        header('Strict-Transport-Security: max-age=31536000');
    } elseif (($config['exigir_https'] ?? true) && $host !== 'localhost' && $host !== '127.0.0.1') {
        erro('Esta API exige HTTPS.', 403);
    }
}

// ---- Respostas JSON ----
function responder($dados, int $status = 200): void
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($dados, JSON_UNESCAPED_UNICODE);
    exit;
}

function erro(string $mensagem, int $status = 400): void
{
    responder(['erro' => $mensagem], $status);
}

// Lê o corpo JSON da requisição.
function corpo_json(): array
{
    $bruto = file_get_contents('php://input');
    $dados = json_decode($bruto ?: '[]', true);
    return is_array($dados) ? $dados : [];
}

// ---- Banco (PDO) ----
function conectar_db(array $config): PDO
{
    $pdo = new PDO($config['db_dsn'], $config['db_user'], $config['db_pass'], [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]);
    if (str_starts_with($config['db_dsn'], 'sqlite:')) {
        $pdo->exec('PRAGMA foreign_keys = ON');
    }
    return $pdo;
}

$PDO = conectar_db($CONFIG);
