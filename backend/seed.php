<?php
// Cadastra/atualiza membros na lista de autorizados. Roda a migração antes.
//
// Uso:
//   php seed.php felipe.baseggio@enfitecjunior.com "Felipe Baseggio" membro
//   php seed.php ana.souza@enfitecjunior.com "Ana Souza" gestor
// Sem argumentos, cria um conjunto de exemplo.
declare(strict_types=1);

// Segurança: script administrativo só roda via linha de comando, nunca pela web.
if (PHP_SAPI !== 'cli') {
    http_response_code(403);
    exit('Acesso negado: execute este script pela linha de comando.');
}

require_once __DIR__ . '/lib/bootstrap.php'; // $CONFIG, $PDO, helpers
require __DIR__ . '/migrar.php';             // garante que as tabelas existem

function upsert(PDO $pdo, string $email, string $nome, string $role, ?string $senha = null, bool $provisoria = false): void
{
    $email = strtolower(trim($email));
    $role = $role === 'gestor' ? 'gestor' : 'membro';
    $hash = $senha ? password_hash($senha, PASSWORD_DEFAULT) : null;
    $prov = $provisoria ? 1 : 0;
    $st = $pdo->prepare('SELECT id FROM membros WHERE email = ?');
    $st->execute([$email]);
    if ($st->fetch()) {
        if ($hash) {
            $pdo->prepare('UPDATE membros SET nome = ?, role = ?, ativo = 1, senha_hash = ?, senha_provisoria = ? WHERE email = ?')
                ->execute([$nome, $role, $hash, $prov, $email]);
        } else {
            $pdo->prepare('UPDATE membros SET nome = ?, role = ?, ativo = 1 WHERE email = ?')
                ->execute([$nome, $role, $email]);
        }
        echo "  atualizado: $email ($role)" . ($hash ? ($prov ? " [senha provisória]" : " [com senha]") : "") . "\n";
    } else {
        $pdo->prepare('INSERT INTO membros (email, nome, role, ativo, senha_hash, senha_provisoria) VALUES (?, ?, ?, 1, ?, ?)')
            ->execute([$email, $nome, $role, $hash, $prov]);
        echo "  criado: $email ($role)" . ($hash ? ($prov ? " [senha provisória]" : " [com senha]") : "") . "\n";
    }
}

// Uso: php seed.php email "Nome" [membro|gestor] [senha]
// Sem senha, gera uma provisória aleatória e a exibe UMA vez. Sem credenciais no código.
$args = $argv ?? [];
if (count($args) >= 3) {
    $senha = $args[4] ?? bin2hex(random_bytes(9)); // 18 caracteres aleatórios
    upsert($PDO, $args[1], $args[2], $args[3] ?? 'membro', $senha, true); // sempre provisória
    echo "Senha provisória de {$args[1]}: $senha\n";
    echo "Anote agora — ela não será exibida de novo. O membro troca no 1º acesso.\n";
} else {
    fwrite(STDERR, "Uso: php seed.php <email> \"<Nome>\" [membro|gestor] [senha]\n");
    fwrite(STDERR, "Sem a senha, uma provisória aleatória é gerada e exibida uma única vez.\n");
    exit(1);
}
