# API externa e editor do relato — implementação local

## Estado e escopo

Achados reconfirmados antes da implementação: Express sem prefixo global, aliases
de autenticação na raiz e em `/auth`, boletins em `/incidentReport`, estatísticas
em `/incidentReport/statistics` (não existe `/statistics` independente), localidades
em `/localidades`. O cliente HTTP é `src/Utils/api.js`; `src/services/api.js` o
reexporta. O editor usa Draft.js com importação/exportação de `historicohtml`.
O formulário público de senha tinha action absoluto sem o prefixo externo.

Nenhuma alteração foi aplicada à VPS. Não houve deploy, push, merge ou migração.
Os arquivos `.env` reais foram preservados. O workspace já continha alterações
locais: esta implementação não representa, por si só, uma release isolada delas.

## API e ambientes

Fluxo publicado: navegador HTTPS → `/api/` → Nginx → HTTP `127.0.0.1:3001/`.
O Nginx remove `/api`; Express mantém os contratos internos e os aliases legados.
O fallback de porta foi alinhado a 3001; `PORT` explícito continua tendo prioridade.

O cliente Axios continua único, com timeout de 20 segundos e JWT no cabeçalho
`x-access-token`. `REACT_APP_API_URL` tem prioridade. Em produção, sua ausência
agora resulta em `/api`, sem reaproveitar host/porta legados do `.env.local`.
No desenvolvimento, o fallback legado e `window.location.origin` permanecem.
O interceptor mantém o tratamento de 401 e a exceção para login/cadastro/recuperação;
também limpa permissões e role armazenadas. Tokens expirados retornam 401, não 500.
Token ausente recebe `TOKEN_MISSING`, expirado `TOKEN_EXPIRED`; inválidos continuam
401, permissões insuficientes continuam 403, falhas internas continuam 500.

Configuração explícita da build:

```env
# Desenvolvimento
REACT_APP_API_URL=http://localhost:3001
# Homologação e produção, em seus respectivos ambientes de build
REACT_APP_API_URL=/api
REACT_APP_ENABLE_OFFLINE_DRAFTS=false
```

Os exemplos estão em `boonline4bpm/.env.development.example` e
`.env.production.example`. Copiar/selecionar valores no ambiente de build é uma
ação de implantação; alterar o arquivo no servidor após compilar não muda o bundle.
Não publicar um bundle com URL local explicitamente configurada.

Backend, substituindo o domínio ilustrativo pelo domínio confirmado:

```env
PORT=3001
NODE_ENV=production
USE_HTTPS=false
PUBLIC_APP_URL=https://boonline.example.org/api
PUBLIC_VALIDATION_BASE_URL=https://boonline.example.org
```

`PUBLIC_APP_URL` é a base pública dos handlers de autenticação da API, incluindo
`/api` nesta arquitetura. Produção exige uma URL HTTPS explícita sem credenciais,
query ou fragmento; localhost e IPs são rejeitados. E-mails de confirmação e
recuperação acrescentam `/auth/...` a essa base. A recuperação abre o formulário
do backend; `action=""` envia ao endereço público atual, conservando `/api`.
O POST HTML bem-sucedido mostra confirmação e link para `/`, enquanto o cliente
JSON mantém a resposta anterior e sua navegação de login. A lógica de hash,
validade e uso único do token foi preservada.

`PUBLIC_VALIDATION_BASE_URL` é a origem HTTPS do FRONTEND, sem `/api`; QR Codes
continuam apontando para `/validar-boletim/:token`. As validações existentes dessa
variável permanecem. Credenciais JWT, banco e e-mail são somente do ambiente do
backend. Há `.env` na raiz e em `src`: confirmar o cwd real do processo PM2, pois
dotenv usa o diretório de execução.

## Nginx e verificações prévias

O trecho pronto para revisão é `deploy/nginx-api.conf`. A barra final em
`proxy_pass http://127.0.0.1:3001/` é necessária: `/api/auth/session` chega ao
Express como `/auth/session`. Sem ela, o prefixo seria preservado e as rotas
principais retornariam 404. `/api` recebe redirecionamento 308 para `/api/`.
A revisão por IA foi removida, portanto não requer mais exceção de proxy.
Manter o fallback React fora do location da API. Não interceptar erros de API
para devolver `index.html`; não cachear respostas autenticadas.

Antes de aplicar qualquer alteração, executar somente leitura na VPS:

```bash
systemctl status nginx --no-pager
systemctl cat nginx
ps -C nginx -o pid,args
sudo nginx -T 2>&1 | less
sudo ss -ltnp
pm2 list
curl -i http://127.0.0.1:3001/
curl -i http://127.0.0.1:3001/auth/session
curl -i https://DOMINIO_CONFIRMADO/api/
curl -i https://DOMINIO_CONFIRMADO/api/auth/session
```

Conferir localmente informações sensíveis antes de compartilhar saídas.
`nginx -T` mostra arquivos em disco, não garante que workers carregaram a última
versão. Confirmar processo, arquivo de configuração, porta e release ativos.
O trecho não configura firewall nem restringe o listen do Node: verificar que
3001 não esteja acessível publicamente. CORS já permite Content-Type e
X-Access-Token; acesso same-origin não depende de CORS. Preservar CORS_ORIGIN
necessário para desenvolvimento ou consumidores externos conhecidos.
Não alterar `trust proxy` indiscriminadamente: validar a topologia antes de
configurar confiança em IPs encaminhados e limites por IP.

## Remoção da correção por IA

Removidos `src/http/verifyTextRoute.js`, `src/controllers/textController.js` e
`src/lib/openai.js`, o registro da rota, a seção da documentação da API e a
dependências `openai` e `axios` do backend, do package.json/package-lock.json.
Axios no backend era exclusivo do helper removido; Axios do frontend permanece.
Não foi encontrado botão
ou consumidor React atual dessa integração. `POST /api/verify-text` deixa de
existir. O teste verifica 404. Não foram apagados relatos corrigidos anteriormente.
`OPENAI_API_KEY` pode ser removida MANUALMENTE dos ambientes, inclusive do antigo
`src/.env`, após confirmar que nenhum serviço externo ao projeto compartilha a
variável. Os arquivos reais não foram modificados. Os exemplos não a incluem.

## Editor e compatibilidade

Mantido Draft.js, sem nova biblioteca de edição: reduz alterações no contrato
HTML, visualizações e impressão existentes. Não é uma garantia de suporte móvel
universal; Android/iOS reais precisam ser homologados.

Implementados negrito, itálico, sublinhado, listas numeradas/com marcadores,
desfazer/refazer, foco visível, fonte de 17px, altura inicial confortável e rolagem
vertical limitada. A barra compacta rola horizontalmente se necessário, sem
exigir hover. O modo ampliado mantém a MESMA instância do editor, seleção e undo;
não mantém um conteúdo paralelo. Usa visualViewport, altura dinâmica e safe-area
para acompanhar o teclado onde houver suporte. Escape ou o botão retorna ao
formulário. O bloqueio de scroll do body é restaurado ao sair.

`historicohtml` continua no BoletimContext. Alterar apenas a seleção não serializa
nem agenda salvamento; alterações de conteúdo seguem o debounce de 900ms já
existente, persistência IndexedDB opcional, sincronização e tratamento de conflitos.
O editor não anuncia confirmação de servidor. A impressão e emissão continuam
usando o mecanismo existente de salvamento. A flag offline continua desligada
por padrão e não foi habilitada por esta tarefa.

HTML recebido é serializado no backend com uma allowlist de tags e ZERO atributos.
Texto é escapado; scripts e elementos ativos não são emitidos. O frontend também
reconstrói uma árvore segura antes de importar no editor, detalhes e relatório P3.
Tags básicas, títulos, citações e texto pré-formatado são aceitos pelo filtro;
isso não significa que todo estilo será editável ou exportado identicamente pelo
Draft.js. Links, tabelas, imagens e estilos CSS arbitrários não são preservados
como recursos ricos. Texto descendente é mantido quando possível; imagens sem
texto alternativo não se tornam conteúdo textual.

Ao detectar atributos ou tags não suportadas, o editor começa somente leitura,
avisa e exige aceite para editar com formatação básica. O original permanece no
contexto até uma alteração efetiva. Atualização de outros campos preserva o HTML
legado se ele for idêntico ao existente no banco. Não há conversão em lote nem
migração. Antes de autorizar a conversão, comparar relatos com tabelas, cores,
alinhamentos, links ou imagens; usar a versão anterior do sistema se a edição
exigir preservar esses recursos. HTML malformado pode ser normalizado pelo parser
do navegador; homologar amostras institucionais antes de publicar.

O PDF anteriormente reduzia tudo a texto simples. Agora renderiza estilos básicos,
listas, entidades, quebras e parágrafos usando as fontes já disponíveis no PDFKit.
Não importa CSS do editor. O tratamento existente de páginas, assinaturas, QR e
versões digitais permanece. PDFs já armazenados não são regravados.

## Testes e evidências locais

Arquivos desta implementação (além de exemplos e documentação): backend
`src/index.js`, `src/lib/jwtconfig.js`, `src/lib/nodemailerconfig.js`,
`src/controllers/authController.js`, `src/controllers/incidentReportController.js`,
`src/controllers/apiFlows.test.js`, `src/http/docsRoute.js`,
`src/utils/historyHtml.js`, `historyHtml.test.js`, `historyPdf.js`,
`historyPdf.test.js`, `publicApiUrl.js`, `publicApiUrl.test.js`, `boletimPdf.js`,
`src/scripts/testNoDatabase.cjs`, `package.json`, `package-lock.json` e os três
arquivos exclusivos de IA removidos. Frontend: `src/Utils/api.js`, `api.test.js`,
`historyHtml.js`, `historyHtml.test.js`, `src/pages/Boletim/Historico/Historico.jsx`,
`historico.css`, `Historico.test.jsx`, `src/pages/Boletim/Detalhe/BoletimDetalhe.jsx`,
`src/pages/Boletim/BoletimDetalheFromBD.jsx` e
`src/pages/Dashboard/Boletim/components/BoletimListRelatorioP3.jsx`.
`build/` foi regenerado; PDFs sintéticos existentes em `tmp/pdfs` também foram
regenerados para QA. Não publicar arquivos de teste, logs ou PDFs sintéticos.

- Backend: 79 testes aprovados. Inclui login, cadastro, consulta/criação/edição,
  autorização, estatísticas gerais/geográficas, idempotência, revisão otimista,
  PDF/QR/revogação, token expirado/ausente/inválido, formulário sob `/api`, reset
  de senha com hash/uso único, validação de URL pública e serialização segura.
- Frontend: 26 suítes e 79 testes aprovados. Inclui estatísticas original e
  operacional, mapa, perfil, impressão, filtros, editor, undo/redo, mesma instância
  ao expandir, aceite para HTML legado e combinação de prefixo Axios.
- Build de produção aprovada com `REACT_APP_API_URL=/api`, incluindo Service Worker.
  Busca no JS compilado não encontrou `localhost:3001`, `/api/api/` ou domínio OpenAI.
- Geradas amostras sintéticas curta e longa de PDF: 185811 e 372069 bytes;
  longa com cinco páginas. Testes automatizados de paginação e conteúdo aprovados.
- A suíte backend passou a carregar `testNoDatabase.cjs`: bloqueia conexões reais
  e fornece Mongoose sem conexão. Foi completado mock de localidades na suíte de
  fluxos, que antes poderia carregar a conexão padrão. A execução inicial sem essa
  proteção foi interrompida; não foi usada como evidência de validação isolada.
- Avisos existentes de React Router, gráficos sem dimensão no JSDOM, act() e
  caniuse-lite antigo foram mantidos; não impediram testes/build.

Comandos locais (em cada diretório):

```powershell
# backend
npm test
# frontend
$env:CI='true'
npm test -- --watchAll=false --runInBand
$env:REACT_APP_API_URL='/api'
npm run build
```

Nesta máquina, o wrapper npm.ps1 apresentou acesso negado ao prefixo do usuário;
os comandos foram executados diretamente com node e o CLI npm instalado.
Uma tentativa de instalar sanitização externa foi bloqueada por acesso à rede;
nenhuma dependência nova foi mantida. O filtro restritivo tem testes próprios.

Limites: mocks não substituem teste de banco/SMTP/Nginx reais. Estatísticas
operacionais possuem testes de UI e cálculo, sem ensaio com dados de produção.
Não foram testados dispositivos Android/iOS, composição/ditado, teclado virtual
real nem interrupção real de rede em aparelho. O teste do editor usa um adaptador
de entrada no JSDOM para validar estado/HTML/undo, não a interação nativa Draft.js.
A inspeção visual do PDF foi impedida pelo controle do computador, que encerrou
a sessão por não conseguir confirmar a URL do Chrome; não se afirma QA visual.

## Homologação obrigatória e implantação após aprovação

1. Revisar diff junto às alterações locais preexistentes. Separar release aprovada.
2. Confirmar VPS, PM2, caminhos, banco, porta, proxy e origens públicas por leitura.
3. Preparar ambiente isolado com SMTP de teste e dados sintéticos, sem produção.
4. Executar testes/build; conferir requests no navegador e Content-Type JSON,
   incluindo 401 e 403, sem fallback HTML nem `/api/api`.
5. Testar cadastro/confirmar e-mail, recuperar/resetar senha pelo link real, login,
   sessão, expiração, perfis e negativa de permissão. Testar links antigos ainda
   em circulação; se necessário, preservar encaminhamentos legados no Nginx.
6. Consultar/criar/editar boletim sintético; salvar/imprimir; validar QR público e
   PDFs privados; testar localidades, usuários, estatísticas original/operacional
   e mapas com filtros e limites.
7. Android Chrome e iOS Safari: relatos curtos e longos, acentos/composição,
   colagem, seleção, ferramentas, undo/redo, expandir/recolher com teclado aberto,
   rotação, retorno de foco e rolagem. Conferir perda/restauração de conexão com
   flag offline aprovada; verificar indicador antes de abandonar a página.
8. Abrir relatos legados representativos sem editar, comparar texto/formatação,
   autorizar conversão apenas em cópia de teste, salvar/reabrir/imprimir/PDF.
   Inspecionar primeira/última página, parágrafos, listas, estilos e assinaturas.
9. Após autorização explícita, publicar backend/release completo e o conteúdo
   integral de `build/`, preservar env persistente, uploads e PDFs armazenados.
   `npm ci --omit=dev` no backend respeita o lockfile sem OpenAI. Esta mudança não
   exige seed, migração ou gravação de manutenção no banco.
10. Integrar o trecho Nginx ao server HTTPS confirmado; conferir variáveis públicas
    de backend. Somente na janela autorizada: `sudo nginx -t`, depois
    `sudo systemctl reload nginx` e `pm2 restart NOME_CONFIRMADO --update-env`.
    Esses comandos não foram executados. Não iniciar um segundo processo PM2.
11. Repetir smoke test pelo domínio, conferir logs e atualização do Service Worker.

## Reversão

Preservar previamente release/build e configuração Nginx/variáveis anteriores.
Se necessário, voltar os três em conjunto, validar Nginx e reiniciar somente o
processo confirmado, sob autorização operacional. Não restaurar MongoDB como
rotina: não há migração nesta tarefa. HTML básico salvo pelo novo editor continua
compatível com o leitor anterior; estilos removidos após aceite explícito não
são recuperados por rollback de código. Manter cópia de teste/original quando
avaliar conversões e confirmar o procedimento institucional de recuperação.
