# Atualização do BO Online 4º BPM em produção

Para a padronização externa `/api`, remoção da revisão por IA, URLs de autenticação
e editor mobile, consulte também [API_EDITOR_IMPLEMENTACAO.md](API_EDITOR_IMPLEMENTACAO.md).
O trecho recomendado do proxy está em [deploy/nginx-api.conf](deploy/nginx-api.conf).
Confirme a configuração ativa e obtenha autorização antes de publicar.

Este procedimento considera os diretórios `boonline4bpm` (frontend) e `boonline4bpm-backend` (API), MongoDB local ou remoto e Nginx como proxy TLS. Ajuste os caminhos abaixo aos diretórios confirmados na VPS. Os comandos de banco devem ser executados dentro de `boonline4bpm-backend` e exigem `MONGO` explícito.

## O que existe hoje e limites conhecidos

- Há scripts históricos em `src/scripts/`, além do registro central `_schema_migrations`. O executor grava conclusão somente depois da função terminar. As migrações centrais incluem o índice idempotente `2026-10-29-boletim-idempotency-v1` e `2026-10-29-roles-v1`.
- `migrateRoles.js` insere perfis de sistema ausentes com `$setOnInsert` e preenche `roleKey` somente onde está vazio. Não cria contas de usuário. Ela interrompe se não encontrar um administrador legado ativo.
- `migrateNaturezaSchema.js` é potencialmente destrutiva: remapeia referências, remove documentos duplicados da coleção de naturezas, remove campos e índices e cria índice único. Não é executada por `npm run migrate`. Rode-a somente após revisão do dry-run e autorização específica.
- `migrateNaturezas.js` preenche referências e pode mudar `natureza` em boletins. `backfillIncidentDates.js` grava o campo `dataOcorrencia` (inclusive `null` para datas antigas inválidas). Ambos ficam fora da migração central e requerem análise e execução explícita.
- `seedNaturezas.js` valida os 28 grupos, 830 fatos constatados e 133 fatos comunicados e faz upsert por nome normalizado, sem sobrescrever documentos encontrados. Execute com `npm run seed` para aplicar; o comando legado sem `--apply` apenas simula. O modelo atual guarda nome, `normalizado` e `ativo`, não guarda categoria/código de origem. Nomes iguais entre catálogos distintos viram um documento único. Não altere esse desenho em produção sem migração própria e compatível com referências históricas.
- O arquivo de catálogo padrão está na raiz do checkout, `naturezas_ocorrencias_PMMA_atualizado.txt`. Se a implantação copiar somente o diretório do backend, copie também esse arquivo ou informe o caminho com `npm run seed:naturezas -- --apply --file /caminho/catalogo.txt`.
- A conexão da API usa `MONGO` ou, como fallback legado da aplicação, `mongodb://127.0.0.1:27017/boonline`. Os comandos de manutenção recusam executar sem `MONGO` explícito e mostram host/banco antes da operação.
- O frontend usa `REACT_APP_API_URL` (incorporada ao build). Um componente que montava HTTPS e porta próprios foi migrado para o cliente Axios comum. `REACT_APP_API_URL=/api` funciona com proxy Nginx same-origin que encaminhe `/api/` ao backend removendo o prefixo. O valor anterior `http://localhost:3001` em `.env.example` era apenas local.
- O frontend agora inclui autosave, IndexedDB e fila offline controlados pela variável compilada `REACT_APP_ENABLE_OFFLINE_DRAFTS`. Deixe-a `false` em produção até aprovação institucional de segurança: os boletins locais não são criptografados pelo navegador. O Service Worker só armazena shell e recursos estáticos; nunca cacheia respostas de API.
- Backend recebe `MONGO`, `PORT`, `BASE_URL`, `USE_HTTPS`, `CORS_ORIGIN`, `SECRET_PASSWORD_TOKEN`, `PUBLIC_APP_URL` e `PUBLIC_VALIDATION_BASE_URL`; email é opcional conforme recursos utilizados. Segredos pertencem somente ao `.env` do backend.
- Com `USE_HTTPS=true`, o código ainda lê certificados de um caminho Let's Encrypt fixo para o domínio atual. No modelo Nginx terminando TLS, mantenha a API em HTTP local (`USE_HTTPS=false`) e não exponha a porta do backend publicamente.
- Não foi identificado script de deploy, configuração versionada de Nginx ou ecosystem do PM2. Confirme no host quais serviços, paths e nomes de processo realmente estão em uso.

## Preparação local (Windows)

Na raiz de cada projeto, atualize o código e instale dependências travadas:

```powershell
cd boonline4bpm-backend
npm ci
npm test
npm run migrate:status
npm run seed:naturezas -- --dry-run
```

Os comandos de banco consultam o destino configurado no `.env` do backend. Use somente um MongoDB isolado de teste para ensaios; confirme `MONGO` antes de executar. A suíte de testes automatizados do backend também pode importar os modelos da aplicação, então não a execute com um `.env` que aponte para produção. Para os cenários com banco vazio, atualizado, antigo e falha parcial, configure um MongoDB descartável e uma URI de teste explícita.

Configure `boonline4bpm/.env.production` antes da build. CRA incorpora os valores no bundle; mudar o arquivo na VPS depois da build não muda as URLs compiladas:

```env
REACT_APP_API_URL=/api
REACT_APP_ENABLE_OFFLINE_DRAFTS=false
```

O modo offline de rascunhos exige aprovação de segurança do dispositivo antes de trocar a flag para `true`. O bundle compilado incorpora a configuração. Inclua `/service-worker.js`, `manifest.json`, `offline.html` e todos os assets de `build/`. Configure `Cache-Control: no-cache` para `/service-worker.js` para que o navegador descubra atualizações.

Se não houver proxy same-origin, use a URL pública HTTPS real da API em `REACT_APP_API_URL`. Não inclua segredos. Gere a build:

```powershell
cd ..\boonline4bpm
npm ci
npm run build
```

`build/` é a pasta estática a publicar. A raiz deve ter fallback SPA para `index.html`.

## Backup MongoDB

Antes de qualquer migração ou seed que grave dados, determine a URI exata e confirme nome do banco e host. Não coloque a URI com senha em histórico compartilhado de terminal. No servidor, restrinja permissões do arquivo de backup:

```bash
umask 077
BACKUP_DIR="$HOME/backups/boonline"
mkdir -p "$BACKUP_DIR"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
mongodump --uri="$MONGO" --archive="$BACKUP_DIR/boonline-$STAMP.archive" --gzip
test -s "$BACKUP_DIR/boonline-$STAMP.archive"
mongorestore --dryRun --uri="$MONGO" --archive="$BACKUP_DIR/boonline-$STAMP.archive" --gzip
ls -lh "$BACKUP_DIR/boonline-$STAMP.archive"
```

Confirme código de saída zero, arquivo não vazio, tamanho plausível e saída do dry-run antes de atualizar. Guarde o caminho e horário do arquivo. `mongorestore` sem `--dryRun` pode substituir/mesclar dados conforme opções e destino; não execute restauração como rotina. Recuperação deve ser decidida após confirmar banco, coleção e impacto; restauração requer autorização operacional explícita e, preferencialmente, restauração em banco isolado primeiro.

## Preparação e envio para VPS

1. Registre `pwd`, `pm2 list`, `systemctl --type=service --state=running`, configuração ativa do Nginx e caminhos atuais de frontend, backend e uploads. Confirme endpoint de saúde `/` e porta local da API.
2. Faça o backup acima. Copie o `.env` do backend para um local seguro de recuperação ou confirme que já existe e não será substituído. Preserve uploads e demais arquivos de usuário.
3. Envie apenas os arquivos versionados do backend e o conteúdo de `boonline4bpm/build/`. Não envie `node_modules` do Windows, `.env` local, `.env.production`, logs, `tmp/` ou caches. Preserve o diretório de uploads. Use diretórios de release novos ou sincronização com exclusões cuidadosamente limitadas; não use `--delete` sobre diretórios que contenham uploads ou configuração.
4. Mantenha o `.env` de produção no diretório persistente já utilizado pelo PM2/backend. Se os arquivos de release forem versionados em outro caminho, ligue o `.env` por configuração externa ou symlink e confira permissões antes de iniciar.

## Atualização manual na VPS

Entre no release/backend enviado e carregue o `.env` persistente no shell atual, sem imprimir seu conteúdo. Exemplo se ele estiver no diretório da aplicação:

```bash
cd /srv/boonline4bpm/backend
set -a
. ./.env
set +a
test -n "$MONGO"
node -e 'const u=new URL(process.env.MONGO); console.log(`MongoDB destino: ${u.hostname}/${u.pathname.replace(/^\//, "")}`)'
npm ci --omit=dev
```

Compare o destino mostrado com o banco aprovado para a VPS. Em seguida:

```bash
npm run migrate:status
npm run migrate
npm run migrate:status
```

Somente migrações da lista central serão executadas. Para o catálogo, primeiro simule e revise a saída:

```bash
npm run seed:naturezas -- --dry-run --file /srv/boonline4bpm/shared/naturezas_ocorrencias_PMMA_atualizado.txt
```

Após revisar arquivo, banco e quantidade de inclusões, aplique explicitamente:

```bash
npm run seed -- --file /srv/boonline4bpm/shared/naturezas_ocorrencias_PMMA_atualizado.txt
```

Nota: `npm run seed` já passa `--apply`; acrescente `--file` com um arquivo legível no servidor. Migrações antigas não são chamadas automaticamente. Revise antes de usar qualquer uma delas:

```bash
npm run migrate:naturezas:schema -- --dry-run
npm run migrate:naturezas -- --dry-run
npm run migrate:incident-dates
```

O schema de naturezas pode excluir documentos e não deve ser aplicado como rotina. O backfill exige `--apply` e `CONFIRM_INCIDENT_DATE_BACKFILL=yes`. Para `migrate:naturezas`, confira conflitos/pendências do relatório antes de qualquer `--apply`.

## Publicação e verificações

1. Publique o conteúdo de `build/` no document root do Nginx, preservando a release anterior. Atualize o symlink/document root de forma atômica se a estrutura existente permitir.
2. Confira que o Nginx encaminha `/api/` para a API sem prefixo e que o fallback de rotas React retorna `index.html`. Valide a configuração antes do reload: `sudo nginx -t && sudo systemctl reload nginx`.
3. Reinicie somente o processo PM2 existente após migrações, seeds selecionados e publicação concluírem sem erro. Não invente um nome de processo; confirme com `pm2 list`, depois use o nome real, por exemplo `pm2 restart <nome-confirmado> --update-env`.
4. Verifique `pm2 status`, `pm2 logs <nome-confirmado> --lines 100`, `curl -fsS http://127.0.0.1:3001/` (ajuste a porta confirmada) e o domínio HTTPS público. Verifique no navegador que as requisições vão para `/api`, faça login, consulte um boletim existente e cadastre/consulte um boletim de teste operacional aprovado. Confirme também que referências de naturezas continuam sendo resolvidas.
5. Registre versão publicada, horário, destino MongoDB, backup usado, migrações aplicadas e resultado das verificações.

## Recuperação

Se a falha for de aplicação, volte o symlink/release do backend e do frontend para as versões anteriores, restaure a configuração Nginx anterior se necessária, valide com `nginx -t`, recarregue Nginx e reinicie o processo PM2 confirmado. Isso é rollback de código/build e não reverte alterações no banco.

Não há rollback automático de banco. Migrações devem ser compatíveis para frente e projetadas para preservar registros. Se uma mudança de banco precisar ser revertida, pare e avalie os dados gravados desde a migração. Recriar o banco a partir do backup perde atualizações posteriores; faça restauração somente em destino isolado para avaliação ou com aprovação explícita após plano de recuperação.

## Automação futura

O fluxo está organizado em comandos separados para permitir um `deploy.sh` futuro. Ele deve exigir backup verificável, conferir destino MongoDB, exibir pendências, parar ao primeiro erro e só publicar/reiniciar depois das etapas anteriores concluírem. Não automatize `migrateNaturezaSchema.js` nem restaurações. Nenhum `deploy.sh` é criado agora porque paths, processo PM2, estratégia de release e health check reais da VPS ainda precisam ser confirmados.
