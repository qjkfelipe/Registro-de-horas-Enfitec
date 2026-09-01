# Backend — Registrador de Horas ENFITEC (PHP + MySQL)

API em **PHP puro (PDO)**, sem framework nem Composer — feita para rodar em
**hospedagem compartilhada PHP** (como a da UFRGS). Portável: usa **SQLite** em
desenvolvimento e **MySQL/MariaDB** em produção, só trocando o `config.php`.

## Estrutura

```
backend/
  index.php            # controlador: todas as rotas passam por aqui
  .htaccess            # redireciona as requisições para o index.php
  router.php           # roteador do servidor embutido (desenvolvimento)
  config.example.php   # modelo de configuração (copie para config.php)
  schema.sql           # estrutura do banco em MySQL (importar no phpMyAdmin)
  migrar.php           # cria/atualiza as tabelas (útil no dev com SQLite)
  seed.php             # cadastra a conta de gestão e membros de exemplo
  importar_membros.php # importa vários membros de uma vez
  lib/                 # código interno (protegido por .htaccess)
    bootstrap.php      # config + conexão + helpers (CORS, JSON, erros)
    jwt.php            # tokens JWT (HS256)
    auth.php           # identificação e autorização do usuário logado
```

## Rodar localmente (com PHP instalado)

```bash
cd backend
cp config.example.php config.php     # já vem configurado para SQLite (dev)
php seed.php                          # cria as tabelas + contas de exemplo
php -S localhost:8080 router.php      # servidor embutido do PHP (usa o router)
```

Testar: `http://localhost:8080/health` deve responder `{"status":"ok"}`.

> Sem PHP na máquina? Instale via XAMPP (o PHP fica em `C:\xampp\php\php.exe`).
> Usa-se a porta **8080** porque a 8000 costuma conflitar com o Docker Desktop.

## Autenticação (e-mail + senha)

- Todos entram por **e-mail + senha**. Não há login social nem link por e-mail.
- A gestão cadastra cada membro com uma **senha inicial provisória**; no **primeiro
  acesso** o sistema obriga o usuário a definir a própria senha.
- Fluxo: `POST /auth/login-senha` `{ email, senha }` → devolve `access_token` (JWT) e
  os dados do usuário (incluindo `senha_provisoria`). As demais rotas usam o cabeçalho
  `Authorization: Bearer <access_token>`. Para trocar a senha: `POST /auth/trocar-senha`.
- **Papéis:** `membro` (registra as próprias horas) e `gestor` (painel de gestão).

## Endpoints

| Método | Rota | Quem acessa | O quê |
|---|---|---|---|
| POST | `/auth/login-senha` | público | login (retorna token + dados) |
| POST | `/auth/trocar-senha` | logado | troca a própria senha |
| GET  | `/auth/me` | logado | dados do usuário |
| GET  | `/registros` | membro | lista os próprios registros |
| POST | `/registros` | membro | cria um registro |
| DELETE | `/registros/{id}` | membro | remove um registro seu |
| GET  | `/gestao/resumo?mes=&setor=` | gestor | horas por membro e setor (mês) |
| GET  | `/gestao/analise?mes=&setor=` | gestor | horas por setor e atividade |
| GET  | `/gestao/registros?mes=&setor=` | gestor | lançamentos detalhados |
| GET  | `/gestao/total-membros?setor=` | gestor | horas totais por membro |
| GET/POST | `/gestao/membros` | gestor | lista / cadastra membros |
| POST | `/gestao/membros/{id}/ativo` | gestor | ativa/desativa acesso |

## Segurança (resumo)

- Senhas com `password_hash`/`password_verify` (bcrypt); consultas SQL parametrizadas.
- Rotas de gestão exigem papel `gestor`; membro só acessa os próprios registros.
- Login com senha errada tem atraso proposital (freia força bruta).
- Se `jwt_secret` continuar o valor de exemplo, o backend gera um segredo aleatório
  forte em `lib/.jwt_secret` automaticamente.
- `config.php`, banco SQLite e `.jwt_secret` ficam fora do Git e protegidos por `.htaccess`.

## Publicar na UFRGS (produção)

Passo a passo completo em `../docs/GUIA-DEPLOY-UFRGS.md`. Resumo:

1. No phpMyAdmin, criar o banco e **importar `schema.sql`**.
2. Copiar `config.example.php` para `config.php` e preencher `db_dsn` (MySQL),
   `db_user`, `db_pass`, `jwt_secret` (aleatório longo) e `frontend_url` (produção).
3. Enviar a pasta `backend/` para o servidor (ex.: `public_html/api/`).
4. Cadastrar a conta de gestão e os membros
   (`php seed.php ...` ou `php importar_membros.php`, ou pelo painel).
5. Conferir que o `.htaccess`/`mod_rewrite` está ativo. Sem rewrite, as rotas ainda
   funcionam via `index.php/...`.

## Gestão de acesso (a cada semestre)

- **Novo membro:** cadastre pelo painel da gestão (ou `php seed.php email "Nome" membro senha`).
- **Tornar gestor:** papel `gestor` (Gestão de Pessoas).
- **Desligar alguém:** desative o acesso (`ativo = 0`) — bloqueia a entrada e
  **preserva o histórico** de horas.
