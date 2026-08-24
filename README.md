# Registrador de Horas — ENFITEC Júnior

Sistema web para os membros da **ENFITEC Júnior** (empresa júnior de Engenharia
Física da UFRGS) registrarem as horas trabalhadas, e para a gestão acompanhar a
dedicação da equipe com relatórios e análises.

---

## Visão geral

- **Membros** entram com e-mail e senha e registram suas horas (data, setor,
  atividade, tempo e descrição). Veem o histórico da semana e o total do mês.
- **Gestão** (conta administradora) acompanha as horas de toda a equipe, com
  filtro por setor, gráficos de análise e relatório em PDF; também cadastra e
  controla os acessos dos membros.

## Funcionalidades

### Para o membro
- Login por **e-mail + senha** (sem burocracia).
- **Troca de senha obrigatória no primeiro acesso** (a gestão define uma senha inicial).
- Registro de horas com **horas e minutos** separados (ex.: 2h 30min).
- Seleção de **Setor** (diretoria) e **Atividade**.
- **Histórico semanal** (últimos 7 dias) agrupado por dia, com subtotais.
- **Resumo mensal** navegável (setas para meses anteriores).

### Para a gestão (papel "gestor")
- Visão das **horas de toda a equipe** por mês.
- **Filtro por setor** (Todos / Presidência / Projetos / …) que afeta tabela,
  gráficos e relatório.
- **Análise em gráficos**: horas por setor, por atividade e por membro, com
  destaques (setor com mais horas, atividade mais trabalhada).
- **Relatório em PDF** do que está sendo visualizado, incluindo a análise.
- **Cadastro de membros** e **ativar/desativar acessos** (sem depender do TI).

### Setores e atividades
- **Setores** (6 diretorias): Presidência, Administrativo-Financeiro, Comercial,
  Projetos, Gestão de Pessoas, Marketing.
- **Atividades**: Visita técnica, Pesquisa, Desenvolvimento de projeto,
  Reunião de alinhamento, Reunião com cliente, Criando conteúdo.

---

## Tecnologias

| Camada | Tecnologia |
|---|---|
| Front-end | React 18 + Vite, CSS próprio (identidade ENFITEC) |
| Gráficos/PDF | SVG/CSS na tela · jsPDF + jspdf-autotable no relatório |
| Back-end | PHP puro com PDO (**sem framework nem Composer**) |
| Banco | SQLite (desenvolvimento) · MySQL/MariaDB (produção) |
| Autenticação | E-mail + senha, sessão via JWT (HS256) |

> A escolha de PHP puro + MySQL é intencional: roda em **hospedagem compartilhada**,
> como a do servidor da UFRGS.

---

## Estrutura do projeto

```
registrador-horas/
├── index.html
├── package.json
├── vite.config.js
├── .env.example            # VITE_API_URL (endereço do backend)
├── public/                 # logo/favicon
├── src/
│   ├── App.jsx             # rotas e proteção de acesso
│   ├── main.jsx
│   ├── styles.css
│   ├── lib/
│   │   └── api.js          # cliente da API (fetch + token)
│   └── pages/
│       ├── Login.jsx       # login por e-mail + senha
│       ├── TrocarSenha.jsx # troca no primeiro acesso
│       ├── Registro.jsx    # registro de horas (membro)
│       └── Gestao.jsx      # painel da gestão
├── backend/                # API PHP (ver backend/README.md)
│   ├── index.php           # rotas
│   ├── router.php          # servidor de desenvolvimento
│   ├── config.example.php
│   ├── schema.sql          # estrutura MySQL
│   ├── migrar.php / seed.php
│   └── lib/                # bootstrap, jwt, auth
└── docs/                   # documentos de apoio (deploy, apresentação, etc.)
```

---

## Como rodar localmente

Pré-requisitos: **Node.js** e **PHP** (ex.: via XAMPP — o PHP fica em
`C:\xampp\php\php.exe`).

### 1) Backend (API)
```bash
cd backend
cp config.example.php config.php      # já vem configurado para SQLite (dev)
php seed.php                          # cria as tabelas + contas de exemplo
php -S localhost:8080 router.php      # sobe a API em http://localhost:8080
```
> No Windows/PowerShell, se o PHP não estiver no PATH, use o caminho completo com o
> operador de chamada: `& "C:\xampp\php\php.exe" -S localhost:8080 router.php`.
>
> Usamos a porta **8080** porque a **8000** costuma conflitar com o Docker Desktop.

Teste: acesse `http://localhost:8080/health` → deve responder `{"status":"ok"}`.

### 2) Front-end
```bash
npm install
cp .env.example .env                 # VITE_API_URL=http://localhost:8080
npm run dev                          # abre em http://localhost:5173
```

### Contas de exemplo (seed)
| Papel | E-mail | Senha |
|---|---|---|
| Gestão | `enfitecjunior@gmail.com` | `enfitec123` |
| Membro | `felipe.baseggio@enfitecjunior.com` | `senha123` (provisória) |

> ⚠️ Troque essas senhas em produção. A senha do membro é provisória: no primeiro
> acesso o sistema pede para criar uma nova.

---

## Autenticação e papéis

- Todos entram por **e-mail + senha**. A conta de gestão é única e compartilhada
  pelos responsáveis (ex.: `enfitecjunior@gmail.com`).
- **Papéis:** `membro` (registra as próprias horas) e `gestor` (vê a equipe,
  relatórios e gerencia acessos). O gestor não registra horas.
- **Primeiro acesso:** a gestão cadastra o membro com uma senha inicial provisória;
  o membro é obrigado a definir a própria senha ao entrar.
- **Controle de acesso:** só quem está cadastrado e ativo consegue entrar. Ao
  desligar alguém, **desative o acesso** (preserva o histórico) em vez de apagar.

## Principais rotas da API

| Método | Rota | Acesso | Descrição |
|---|---|---|---|
| POST | `/auth/login-senha` | público | login (retorna token + dados) |
| POST | `/auth/trocar-senha` | logado | troca a senha (1º acesso) |
| GET  | `/registros` | membro | lista os próprios registros |
| POST | `/registros` | membro | cria um registro |
| DELETE | `/registros/{id}` | membro | remove um registro seu |
| GET  | `/gestao/resumo?mes=&setor=` | gestor | horas por membro/setor |
| GET  | `/gestao/analise?mes=&setor=` | gestor | horas por setor e atividade |
| GET/POST | `/gestao/membros` | gestor | lista / cadastra membros |
| POST | `/gestao/membros/{id}/ativo` | gestor | ativa/desativa acesso |

---

## Produção (servidor da UFRGS)

O servidor da UFRGS é **hospedagem PHP + MySQL**. Resumo do deploy (detalhes em
`backend/README.md` e `docs/CHECKLIST-SERVIDOR-UFRGS.md`):

1. Criar o banco e **importar `backend/schema.sql`** (phpMyAdmin).
2. Criar `backend/config.php` a partir do exemplo, apontando `db_dsn` para o MySQL,
   com um `jwt_secret` aleatório e `frontend_url` da produção.
3. Enviar a pasta `backend/` para o servidor (ex.: `public_html/api`).
4. Cadastrar a conta de gestão e os membros.
5. Publicar o front-end (`npm run build`) com `VITE_API_URL` apontando para a API.

---

## Documentos de apoio (`docs/`)

- `CHECKLIST-SERVIDOR-UFRGS.md` — o que confirmar/pedir ao TI.
- `ROTEIRO-APRESENTACAO.md` — roteiro de apresentação do projeto.
- `PLANO-SUPABASE.md` — referência histórica (alternativa de hospedagem gerenciada,
  não adotada; o projeto usa PHP + MySQL na UFRGS).

---

## Status atual

Sistema funcional: registro de horas, autenticação com troca no 1º acesso,
painel de gestão com filtro por setor, análise em gráficos e relatório PDF.
Próximo passo: **deploy no servidor da UFRGS**.

Projeto desenvolvido para a **ENFITEC Júnior** — *"Se não for impossível, a gente faz!"*
