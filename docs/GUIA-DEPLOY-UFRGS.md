# Guia de Deploy — Registrador de Horas (servidor da UFRGS)

Passo a passo para publicar em produção no **Instituto de Física (if.ufrgs.br)**, como
**subdiretório** de um site já existente (ex.: `https://if.ufrgs.br/enfitecjr/registro-horas`).
Faça na ordem. Ao final há a **verificação** e o **checklist de segurança**.

> **Premissas do ambiente (confirmadas com o TI):** PHP 8.4 via mod_php, **MariaDB**,
> acesso **SSH**, publicação em **subdiretório** (não subdomínio), raiz web em **NFS**.
> Se algo mudar, ajuste os pontos marcados com **⚠️**.

Neste guia, o caminho de exemplo é `/enfitecjr/registro-horas/`. **Se o caminho final
for outro, troque nos 3 lugares marcados** (`VITE_BASE`, `RewriteBase` do front e `VITE_API_URL`).

---

## 1. Banco de dados (MariaDB / phpMyAdmin)

1. Crie um banco, ex.: `enfitec_horas` (charset `utf8mb4`).
2. Aba **Importar** → selecione `backend/schema.sql` → **Executar**.
3. Anote **host, nome do banco, usuário e senha** (a conta deve ter acesso só a esse banco).

> Em produção **não** se usa SQLite. Nunca publique um `registrador.db` junto com a API.

---

## 2. Backend (API PHP)

### 2.1. Crie o `config.php`

Copie `backend/config.example.php` para **`backend/config.php`** e preencha:

```php
'db_dsn'  => 'mysql:host=SEU_HOST;dbname=enfitec_horas;charset=utf8mb4',
'db_user' => 'USUARIO_DO_BANCO',
'db_pass' => 'SENHA_DO_BANCO',

// OBRIGATÓRIO: gere um valor próprio (elimina a geração automática em disco NFS).
//   php -r 'echo bin2hex(random_bytes(32)), "\n";'
'jwt_secret'    => 'COLE_AQUI_OS_64_CARACTERES_GERADOS',
'sessao_expira_min' => 60 * 12,   // 12 h (origem compartilhada — sessão curta)

'exigir_https'   => true,   // mantenha true em produção
'atras_de_proxy' => false,  // só true se houver mesmo um proxy reverso na frente

'frontend_url' => 'https://if.ufrgs.br',  // origem exata (sem barra no fim)
```

### 2.2. Publique **apenas** os arquivos necessários

Envie para `.../enfitecjr/registro-horas/api/` **somente**:

```
index.php   .htaccess   config.php   lib/
```

> **NÃO publique** `seed.php`, `migrar.php`, `importar_membros.php`, `router.php`,
> `schema.sql` nem `*.db`. Os scripts de manutenção rodam por **SSH** (passo 3) e não
> devem ficar na web. O `.htaccess` já bloqueia esses arquivos como segunda camada, mas
> a regra de ouro é **não enviá-los**.

### 2.3. Confirme

- `https://if.ufrgs.br/enfitecjr/registro-horas/api/health` → `{"status":"ok"}`.
  - Se as rotas derem 404, falta `mod_rewrite`/`AllowOverride`: peça ao TI para ativar,
    ou use as rotas no formato `.../api/index.php/health`.

---

## 3. Contas (via SSH, fora da web)

Na pasta do backend, pelo terminal do servidor:

- **Conta de gestão** (senha escolhida por você, provisória):
  ```bash
  php seed.php enfitecjunior@gmail.com "Gestão ENFITEC" gestor "UMA_SENHA_FORTE"
  ```
  Sem informar a senha, o script **gera uma provisória aleatória e a exibe uma vez**.
- **Importar os membros de uma vez:**
  ```bash
  php importar_membros.php
  ```
  (gera uma senha provisória por membro e imprime a lista para você distribuir com segurança)

> Sem SSH? Gere o hash em outra máquina
> (`php -r 'echo password_hash("SENHA", PASSWORD_DEFAULT);'`) e insira a primeira conta
> de gestão pelo phpMyAdmin; daí em diante, cadastre pelo **painel**.

Todas as senhas iniciais são **provisórias**: cada pessoa cria a sua no 1º acesso — e a
API agora **impõe** isso (o token provisório só serve para trocar a senha).

---

## 4. Front-end (React)

1. Crie **`.env.production`** com a API na **mesma origem** (caminho relativo) e a base:
   ```
   VITE_API_URL=/enfitecjr/registro-horas/api      # ⚠️ ajuste o caminho se necessário
   VITE_BASE=/enfitecjr/registro-horas/            # ⚠️ mesmo caminho, com barra no fim
   ```
   > Deixe o `VITE_BASE` **no arquivo**, não na linha de comando — no Windows/Git Bash
   > um `VITE_BASE=/x/y` inline é mangleado (vira `/Program Files/Git/x/y`).
2. Gere o build:
   ```bash
   npm install
   npm run build
   ```
   > Sem o `VITE_BASE` correto, o `dist/` aponta os arquivos para a raiz do domínio e a
   > **aplicação abre em branco**.
3. Envie o conteúdo de **`dist/`** para `.../enfitecjr/registro-horas/`.
   O `.htaccess` da SPA já vai junto (vem de `public/.htaccess`) — ele faz o redirect
   para HTTPS, o roteamento do React e os cabeçalhos de segurança do front.
   > **⚠️** Abra esse `.htaccess` e confirme o `RewriteBase /enfitecjr/registro-horas/`.

---

## 5. HTTPS

- Garanta que o site abre em **https://** (certificado ativo).
- `frontend_url` (config) e `VITE_API_URL` devem usar **https** / caminho relativo.
- A API recusa HTTP fora de `localhost` (`exigir_https`), e o front redireciona para HTTPS.

---

## 6. Verificação depois de publicar

Arquivos sensíveis devem responder **403/404**:

```bash
BASE=https://if.ufrgs.br/enfitecjr/registro-horas/api
for f in seed.php migrar.php importar_membros.php router.php config.php \
         registrador.db lib/.jwt_secret schema.sql; do
  echo -n "$f -> "; curl -s -o /dev/null -w '%{http_code}\n' "$BASE/$f"
done
```

E o fluxo básico:

- [ ] `.../api/health` responde `{"status":"ok"}`.
- [ ] `curl -H "Authorization: Bearer <token>" .../api/auth/me` responde **200** (o
      cabeçalho `Authorization` chega ao PHP). Se der 401 aqui, confira o `CGIPassAuth`
      do `.htaccess` do backend.
- [ ] A pasta da API **não lista arquivos** ao ser aberta direto.
- [ ] Login da gestão **força criar senha** no 1º acesso.
- [ ] Um membro registra horas; recarregar `/registro` **não** dá 404 (SPA ok).
- [ ] Painel filtra por setor, troca o formato do gráfico e baixa **PDF** e **CSV**.

---

## 7. Checklist de segurança (bloqueadores)

Já resolvidos **no código** (nada a fazer, só conferir que a versão publicada é a atual):
scripts admin bloqueados na web + guarda CLI, sem credenciais fixas, token provisório
restrito, rate-limit de login, tratamento de erros sem vazamento, cabeçalhos de segurança.

A conferir **no deploy**:

- [ ] **HTTPS** ativo em todo o site.
- [ ] `jwt_secret` **próprio** no `config.php` (não deixar o valor de exemplo).
- [ ] Senha da conta de gestão **diferente** de qualquer exemplo, definida no `seed.php`.
- [ ] `config.php`, `*.db`, `lib/.jwt_secret`, scripts e `schema.sql` **negados** pela web
      (teste do passo 6).
- [ ] Publicado **só** `index.php`, `.htaccess`, `config.php` e `lib/` na pasta da API.
- [ ] `VITE_BASE` e `RewriteBase` batendo com o caminho real; `VITE_API_URL` relativo.
- [ ] Backups do banco habilitados (se o TI oferecer).

---

## 8. Manutenção a cada semestre

- **Entrada:** cadastrar novos membros pelo painel (ou `importar_membros.php` via SSH).
- **Saída:** **desativar** o acesso de quem saiu (não apagar — preserva o histórico).
  Desativar corta o acesso na hora, mesmo com token válido.
- **Conta de gestão:** repassar o acesso à nova gestão e **trocar a senha** na virada
  (o reset pelo painel já revoga os acessos antigos).
- **Emergência:** trocar o `jwt_secret` no `config.php` invalida **todas** as sessões de
  uma vez — o botão de pânico se houver suspeita de vazamento.
