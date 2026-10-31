# Relatorio da consolidacao de naturezas

## Resultado no banco local

| Medida | Antes | Depois |
| --- | ---: | ---: |
| Documentos em `naturezas` | 991 | 943 |
| Nomes normalizados distintos | 943 | 943 |
| Grupos com nome duplicado | 44 | 0 |
| Documentos excedentes removidos | — | 48 |
| Boletins | 4.358 | 4.358 |
| Referencias orfas de natureza | — | 0 |

Os 48 documentos excedentes foram removidos, deixando um registro por nome normalizado. A simulacao e a aplicacao nao encontraram boletins referenciando os registros excedentes; todos os 4.358 boletins continuam com suas referencias validas. O registro sobrevivente fica ativo se qualquer duplicata estava ativa; em caso de escolha, preserva-se o registro mais referenciado.

A colecao agora contem o ID interno do MongoDB, `nome`, `ativo` e `normalizado` (chave tecnica de busca e unicidade). Tipo de catalogo, codigos de origem, fonte, categoria, descricao, aliases, timestamps e versao foram removidos. A aplicacao foi feita somente em `127.0.0.1:27017/boonline`; producao nao foi alterada.

## Validacao dos arquivos TXT

O parser validou os 28 grupos do Anexo A, 830 fatos constatados do Anexo C e 133 fatos comunicados do Anexo B, incluindo os codigos FC001-FC133. Os 991 itens-fonte correspondem a 943 nomes distintos; 48 ocorrencias repetidas foram consolidadas. Todos os 943 nomes do TXT ja existiam no banco apos a consolidacao; a segunda execucao do seed adicionou zero documentos.

Os codigos e tipos continuam descritos nos TXT de referencia, mas nao sao persistidos individualmente no banco, conforme a instrucao de manter somente o nome e o status.

## Testes e comandos

- Migracao idempotente: 48 excedentes removidos; segunda simulacao encontrou zero excedentes.
- Seed idempotente: segunda execucao adicionou 0 de 943 nomes.
- Verificacao pos-migracao: 943 documentos, 943 nomes unicos, indice unico em `normalizado`, 4.358 boletins e zero referencias orfas.
- Backend: `npm test` passou nos 9 arquivos de teste. Frontend: 22 suites e 68 testes passaram. Build de produção: compilado com sucesso.

```powershell
npm run migrate:naturezas:schema -- --dry-run
npm run migrate:naturezas:schema -- --apply
npm run seed:naturezas -- --dry-run
npm run seed:naturezas -- --apply
```

## Arquivos alterados

- `naturezas_ocorrencias_PMMA.txt` — catalogo consolidado de referencia com os Anexos A, B e C.
- `boonline4bpm-backend/src/model/natureza.js` — modelo reduzido a nome, status e chave tecnica.
- `boonline4bpm-backend/src/utils/catalogoNaturezas.js`, `naturezaSeed.js` e `naturezaDeduplication.js` — validacao, seed por nome e consolidacao/remapeamento de IDs.
- `boonline4bpm-backend/src/scripts/migrateNaturezaSchema.js` e `seedNaturezas.js` — migracao e seed idempotentes.
- `boonline4bpm-backend/src/controllers/naturezaController.js` e `incidentReportController.js` — API e estatisticas sem classificacoes duplicadas.
- `boonline4bpm-backend/src/utils/catalogoNaturezas.test.js`, `src/controllers/naturezaController.test.js` e `src/controllers/apiFlows.test.js` — testes de deduplicacao, API e compatibilidade com boletins.
- `boonline4bpm-backend/package.json`, `docs/migracao-naturezas.md` e este relatorio — comandos e procedimento operacional.
- `boonline4bpm/src/pages/Admin/Naturezas/Naturezas.jsx` — cadastro e lista somente com nome e status.
- `boonline4bpm/src/pages/Boletim/Header/compoments/FormHeader.jsx`, `src/Utils/naturezaLabel.js` e testes — select por descricao.
- `boonline4bpm/src/pages/Dashboard/Estatisticas/Estatistica.jsx` e `MapaOcorrencias.jsx` — filtros por ID sem categoria/codigo.

## Nomes consolidados

| Nome mantido | Ocorrencias nos catalogos TXT |
| --- | ---: |
| Roubo | 3 |
| Furto | 3 |
| Dano | 3 |
| Incêndio | 2 |
| Desastre natural | 2 |
| Disparo de Alarme | 3 |
| Outros Acidentes | 2 |
| Abuso de Autoridade | 2 |
| Disparo de arma de fogo | 2 |
| Comércio ilegal de arma de fogo | 2 |
| Omissão de socorro | 2 |
| Constrangimento ilegal | 2 |
| Ameaça | 2 |
| Violação de domicílio | 2 |
| Latrocínio | 2 |
| Extorsão mediante sequestro | 2 |
| Apropriação indébita | 2 |
| Estelionato | 2 |
| Receptação | 2 |
| Vilipêndio a cadáver | 2 |
| Estupro | 2 |
| Assédio sexual | 2 |
| Ato obsceno | 2 |
| Charlatanismo | 2 |
| Moeda falsa | 2 |
| Falsa identidade | 2 |
| Usurpação de função pública | 2 |
| Desacato | 2 |
| Provocar tumulto | 2 |
| Recusa de moeda de curso legal | 2 |
| Jogo de azar | 2 |
| Tráfico de drogas | 2 |
| Afogamento | 2 |
| Apoio | 2 |
| Auxílio | 2 |
| Buracos/Obstáculos em via pública | 2 |
| Desaparecimento de pessoa | 2 |
| Encontro de feto abandonado | 2 |
| Reaparecimento de pessoa | 2 |
| Suicídio | 2 |
| Uso de cerol em pipas ou similares | 2 |
| Farra do boi | 2 |
| Tortura | 2 |
| Cumprimento de mandado de | 2 |
