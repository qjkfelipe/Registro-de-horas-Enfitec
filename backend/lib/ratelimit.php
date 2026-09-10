<?php
// Limitador de tentativas de login (anti força-bruta / password-spraying).
// Conta falhas por IP+e-mail e bloqueia temporariamente após o limite.
// Portável: usa apenas SQL básico (SQLite em dev, MySQL/MariaDB em produção)
// e timestamps em epoch (inteiros), sem depender de sintaxe de upsert específica.

declare(strict_types=1);

// Parâmetros do limitador.
function rl_config(): array
{
    return [
        'max'      => 5,   // tentativas falhas permitidas dentro da janela
        'janela'   => 900, // 15 min: janela de contagem
        'bloqueio' => 900, // 15 min: duração do bloqueio após estourar o limite
    ];
}

// Cria a tabela sob demanda (idempotente) — evita quebrar o login se a migração
// não tiver sido reaplicada na hospedagem compartilhada.
function rl_garantir(PDO $pdo): void
{
    $pdo->exec(
        'CREATE TABLE IF NOT EXISTS login_tentativas (
            chave         VARCHAR(190) NOT NULL PRIMARY KEY,
            tentativas    INTEGER NOT NULL DEFAULT 0,
            bloqueado_ate INTEGER NOT NULL DEFAULT 0,
            atualizado_em INTEGER NOT NULL DEFAULT 0
        )'
    );
}

// Chave do limitador: IP + e-mail (não spoofável por header; usa REMOTE_ADDR).
function rl_chave(string $email): string
{
    $ip = $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';
    return substr($ip . '|' . strtolower(trim($email)), 0, 190);
}

// Barra a requisição (429) se a chave estiver bloqueada. Chamar ANTES de conferir a senha.
function rl_verificar(PDO $pdo, string $chave): void
{
    rl_garantir($pdo);
    $st = $pdo->prepare('SELECT bloqueado_ate FROM login_tentativas WHERE chave = ?');
    $st->execute([$chave]);
    $row = $st->fetch();
    $agora = time();
    if ($row && (int) $row['bloqueado_ate'] > $agora) {
        $faltam = (int) ceil(((int) $row['bloqueado_ate'] - $agora) / 60);
        erro("Muitas tentativas de login. Tente novamente em {$faltam} min.", 429);
    }
}

// Registra uma tentativa falha; ao atingir o limite, aplica o bloqueio.
function rl_falha(PDO $pdo, string $chave): void
{
    $cfg = rl_config();
    $agora = time();
    $st = $pdo->prepare('SELECT tentativas, atualizado_em FROM login_tentativas WHERE chave = ?');
    $st->execute([$chave]);
    $row = $st->fetch();

    if (!$row) {
        $pdo->prepare('INSERT INTO login_tentativas (chave, tentativas, bloqueado_ate, atualizado_em) VALUES (?, 1, 0, ?)')
            ->execute([$chave, $agora]);
        return;
    }

    // Reinicia a contagem se a janela expirou desde a última tentativa.
    $janelaExpirou = (int) $row['atualizado_em'] + $cfg['janela'] < $agora;
    $tent = $janelaExpirou ? 1 : (int) $row['tentativas'] + 1;

    $bloq = 0;
    if ($tent >= $cfg['max']) {
        $bloq = $agora + $cfg['bloqueio'];
        $tent = 0; // zera o contador ao bloquear; recomeça após o desbloqueio
    }
    $pdo->prepare('UPDATE login_tentativas SET tentativas = ?, bloqueado_ate = ?, atualizado_em = ? WHERE chave = ?')
        ->execute([$tent, $bloq, $agora, $chave]);
}

// Limpa o registro após um login bem-sucedido.
function rl_sucesso(PDO $pdo, string $chave): void
{
    $pdo->prepare('DELETE FROM login_tentativas WHERE chave = ?')->execute([$chave]);
}
