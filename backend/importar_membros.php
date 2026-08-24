<?php
// Importa em massa os membros (nome + e-mail institucional) com senha provisória.
// Cada membro troca a senha no primeiro acesso.
//
// Uso:
//   php importar_membros.php               -> gera uma senha provisória aleatória por membro
//   php importar_membros.php "SenhaUnica"  -> usa a MESMA senha provisória para todos
//
// Rode UMA vez (idealmente no servidor, com o config.php apontando para o MySQL).
// Membros que já existem são MANTIDOS (não reseta a senha de quem já entrou).
//
// Observação de privacidade: o sistema só armazena nome, e-mail e papel.
// CPF, RG, endereço e demais dados pessoais NÃO são usados nem guardados.
declare(strict_types=1);

require_once __DIR__ . '/lib/bootstrap.php'; // $PDO
require __DIR__ . '/migrar.php';             // garante as tabelas

// nome => e-mail institucional
$MEMBROS = [
    'Alberto Anflor de Santana' => 'alberto.santana@enfitecjunior.com',
    'Arthur de Souza Castro' => 'arthur.castro@enfitecjunior.com',
    'Artur Rohenkohl de Paiva' => 'artur.paiva@enfitecjunior.com',
    'Bernardo Strieder Lopes' => 'bernardo.lopes@enfitecjunior.com',
    'Davi Carvalho da Silva Barboza' => 'davi.barboza@enfitecjunior.com',
    'Felipe Baseggio' => 'felipe.baseggio@enfitecjunior.com',
    'Felipe Eduardo Torres Savois' => 'felipe.savois@enfitecjunior.com',
    'Gabriel de Souza Amarilho' => 'gabriel.amarilho@enfitecjunior.com',
    'Guilherme Prados Ferreira' => 'guilherme.ferreira@enfitecjunior.com',
    'Guilherme Schling Moura' => 'guilherme.moura@enfitecjunior.com',
    'Gustavo Alves Moretto' => 'gustavo.moretto@enfitecjunior.com',
    'Gustavo França da Silva' => 'gustavo.silva@enfitecjunior.com',
    'Harry Widholzer Plentz' => 'harry.plentz@enfitecjunior.com',
    'Icaro Argonauta Razera de Azevedo Filho' => 'icaro.argonauta@enfitecjunior.com',
    'João Pedro Neves Camisasca' => 'loft.camisasca@enfitecjunior.com',
    'Lucas Da Cunha Pasquetti' => 'lucas.pasquetti@enfitecjunior.com',
    'Luiz Felipe Carvalho Dania' => 'luiz.dania@enfitecjunior.com',
    'Marcelle Cardoso Santos' => 'marcelle.santos@enfitecjunior.com',
    'Maria Luísa da Silva Furtat' => 'maria.furtat@enfitecjunior.com',
    'Mariana Basso' => 'mariana.basso@enfitecjunior.com',
    'Nicolas Otero Gomes' => 'nicolas.gomes@enfitecjunior.com',
    'Pedro André Bosa' => 'pedro.bosa@enfitecjunior.com',
    'Theo Stuker Spitzmacher' => 'theo.spitzmacher@enfitecjunior.com',
    'Thiago da Silva de Borba' => 'thiago.borba@enfitecjunior.com',
    'Thiago Menezes da Silva' => 'thiago.menezes@enfitecjunior.com',
    'Vitor Guedes Antonacci' => 'vitor.antonacci@enfitecjunior.com',
];

$senhaFixa = $argv[1] ?? null; // se informada, todos usam a mesma senha provisória

$verificaExiste = $PDO->prepare('SELECT id FROM membros WHERE email = ?');
$inserir = $PDO->prepare(
    'INSERT INTO membros (email, nome, role, ativo, senha_hash, senha_provisoria) VALUES (?, ?, ?, 1, ?, 1)'
);

echo str_repeat('-', 72) . "\n";
printf("%-40s %-22s %s\n", 'E-MAIL', 'SENHA PROVISÓRIA', 'STATUS');
echo str_repeat('-', 72) . "\n";

foreach ($MEMBROS as $nome => $email) {
    $nome = trim($nome);
    $email = strtolower(trim($email));

    $verificaExiste->execute([$email]);
    if ($verificaExiste->fetch()) {
        printf("%-40s %-22s %s\n", $email, '(mantida)', 'já existe — não alterado');
        continue;
    }

    $senha = $senhaFixa ?: bin2hex(random_bytes(4)); // 8 caracteres aleatórios
    $inserir->execute([$email, $nome, 'membro', password_hash($senha, PASSWORD_DEFAULT)]);
    printf("%-40s %-22s %s\n", $email, $senha, 'CRIADO');
}

echo str_repeat('-', 72) . "\n";
echo "Concluído. Anote/entregue as senhas provisórias acima — cada membro troca no 1º acesso.\n";
