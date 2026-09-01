# Guia de Deploy — Registrador de Horas (servidor da UFRGS)

Passo a passo para publicar o sistema em produção (hospedagem **PHP + MySQL**).
Faça na ordem. Ao final há um **checklist de segurança**.

> Antes de começar, confirme com o TI os itens de `CHECKLIST-SERVIDOR-UFRGS.md`
> (versão do PHP ≥ 7.4, acesso ao MySQL/phpMyAdmin, `mod_rewrite` e HTTPS).

---

## 1. Banco de dados (phpMyAdmin)

1. Crie um banco, ex.: `enfitec_horas` (charset `utf8mb4`).
2. Aba **Importar** → selecione `backend/schema.sql` → **Executar**.
3. Anote **host, nome do banco, usuário e senha** (usados no passo 2).

---

## 2. Backend (pasta `backend/`)

1. Copie `config.example.php` para **`config.php`** e preencha:
   ```php
   'db_dsn'  => 'mysql:host=SEU_HOST;dbname=enfitec_horas;charset=utf8mb4',
   'db_user' => 'USUARIO_DO_BANCO',
   'db_pass' => 'SENHA_DO_BANCO',
   'jwt_secret' => 'COLE_AQUI_UM_VALOR_ALEATORIO_LONGO',
   'frontend_url' => 'https://SEU-DOMINIO',   // origem exata do front (sem barra no fim)
   ```
   > Se deixar o `jwt_secret` no valor de exemplo, o sistema gera um automático em
   > `lib/.jwt_secret` — mas o ideal é definir um próprio.
2. Envie a pasta `backend/` para o servidor, por ex. em `public_html/api/`
   (assim a API fica em `https://SEU-DOMINIO/api`).
3. **NÃO** envie: `config.php` de teste local, `registrador.db`, `lib/.jwt_secret`,
   `lib/ultimo-link.txt` (são locais — o `.gitignore` já os ignora).
4. Confirme o acesso: abra `https://SEU-DOMINIO/api/health` → deve responder
   `{"status":"ok"}`.
   - Se der 404 nas rotas, o `mod_rewrite` pode estar off. Peça para ativar, ou use
     as rotas no formato `.../api/index.php/health`.

---

## 3. Contas (admin + membros)

Pelo terminal do servidor (SSH), na pasta `backend/`:

- **Conta de gestão** com senha escolhida:
  ```bash
  php seed.php enfitecjunior@gmail.com "Gestão ENFITEC" gestor "SENHA_FORTE"
  ```
- **Importar os membros de uma vez:**
  ```bash
  php importar_membros.php
  ```
  (gera uma senha provisória por membro e imprime a lista para você distribuir)

> Sem acesso SSH? Dá para cadastrar tudo pelo **painel da gestão** depois de logar,
> ou inserir na tabela `membros` pelo phpMyAdmin (a senha precisa ir com hash — o
> mais simples é usar o painel).

Todas as senhas iniciais são **provisórias**: cada pessoa cria a sua no 1º acesso.

---

## 4. Front-end (React)

1. No projeto, crie **`.env.production`** com a URL da API publicada:
   ```
   VITE_API_URL=https://SEU-DOMINIO/api
   ```
2. Gere a versão de produção:
   ```bash
   npm install
   npm run build
   ```
   Isso cria a pasta **`dist/`**.
3. Envie o conteúdo de `dist/` para a raiz do site (ex.: `public_html/`).
4. **SPA no Apache** — crie um `.htaccess` na raiz do front para o roteamento
   funcionar ao recarregar páginas (ex.: `/registro`):
   ```apache
   <IfModule mod_rewrite.c>
     RewriteEngine On
     RewriteBase /
     RewriteCond %{REQUEST_FILENAME} !-f
     RewriteCond %{REQUEST_FILENAME} !-d
     RewriteRule . /index.html [L]
   </IfModule>
   ```
   > Se o site ficar numa subpasta (ex.: `/horas`), ajuste `RewriteBase /horas/` e
   > gere o build com `base` correspondente no `vite.config.js` (`base: '/horas/'`).

---

## 5. HTTPS

- Garanta que o site abre em **https://** (certificado ativo).
- O `frontend_url` no `config.php` e o `VITE_API_URL` devem usar **https**.
- Sem HTTPS, senhas e tokens trafegam expostos — **não publique sem isso**.

---

## 6. Testes finais (no ambiente real)

- [ ] `https://SEU-DOMINIO/api/health` responde `{"status":"ok"}`.
- [ ] Login da gestão exige criar senha no 1º acesso.
- [ ] Um membro consegue registrar horas.
- [ ] Painel de gestão mostra os dados, filtra por setor e troca o formato do gráfico.
- [ ] Exportações **PDF** e **CSV** baixam corretamente.
- [ ] Recarregar uma página interna (ex.: `/registro`) não dá 404 (SPA ok).

---

## 7. Checklist de segurança

- [ ] **HTTPS** ativo em todo o site.
- [ ] `jwt_secret` próprio (ou o autogerado em `lib/.jwt_secret`).
- [ ] Senha do admin **trocada** (não usar a de exemplo).
- [ ] `config.php` e o banco **não acessíveis** pela web (testar abrir
      `https://SEU-DOMINIO/api/config.php` → deve ser negado/vazio).
- [ ] `.htaccess` do backend ativo (proteção de `lib/` e `config.php`).
- [ ] Backups do banco habilitados (se o TI oferecer).

---

## 8. Manutenção a cada semestre

- **Entrada:** cadastrar novos membros pelo painel (ou `importar_membros.php`).
- **Saída:** **desativar** o acesso de quem saiu (não apagar — preserva o histórico).
- **Conta de gestão:** repassar o acesso à nova gestão e, de preferência, **trocar a
  senha** na virada.
