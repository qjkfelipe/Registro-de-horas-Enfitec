<?php
// Identificação e autorização do usuário logado (via token de sessão).

declare(strict_types=1);

require_once __DIR__ . '/jwt.php';

function membro_por_email(PDO $pdo, string $email): ?array
{
    $st = $pdo->prepare('SELECT * FROM membros WHERE email = ?');
    $st->execute([strtolower(trim($email))]);
    return $st->fetch() ?: null;
}

function membro_por_id(PDO $pdo, int $id): ?array
{
    $st = $pdo->prepare('SELECT * FROM membros WHERE id = ?');
    $st->execute([$id]);
    return $st->fetch() ?: null;
}

// Lê o "Authorization: Bearer ..." e devolve o membro logado (ou null).
function membro_logado(PDO $pdo, array $config): ?array
{
    $headers = function_exists('getallheaders') ? getallheaders() : [];
    $auth = $headers['Authorization'] ?? $headers['authorization']
        ?? ($_SERVER['HTTP_AUTHORIZATION'] ?? '');

    if (!preg_match('/Bearer\s+(.+)/i', $auth, $m)) {
        return null;
    }
    $payload = jwt_verificar(trim($m[1]), $config['jwt_secret']);
    if (!$payload || ($payload['tipo'] ?? '') !== 'sessao') {
        return null;
    }
    $membro = membro_por_id($pdo, (int) $payload['sub']);
    if (!$membro || !(int) $membro['ativo']) {
        return null;
    }
    // Revogação: o token carrega a versão vigente na emissão. Trocar/resetar a
    // senha incrementa token_version, invalidando todos os tokens anteriores.
    if ((int) ($payload['ver'] ?? 0) !== (int) ($membro['token_version'] ?? 0)) {
        return null;
    }
    return $membro;
}

function exigir_login(PDO $pdo, array $config): array
{
    $membro = membro_logado($pdo, $config);
    if (!$membro) {
        erro('Não autenticado', 401);
    }
    return $membro;
}

function exigir_gestor(PDO $pdo, array $config): array
{
    $membro = exigir_login($pdo, $config);
    if (($membro['role'] ?? '') !== 'gestor') {
        erro('Apenas gestores', 403);
    }
    return $membro;
}
