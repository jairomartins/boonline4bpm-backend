# Catalogo de naturezas por nome

A colecao `naturezas` mantem um documento por nome normalizado. Cada registro guarda `nome`, `ativo` e o campo tecnico `normalizado`, alem do `_id` do MongoDB. Codigos, tipos de catalogo, fonte, categoria, aliases, descricao e timestamps nao sao persistidos.

O parser ainda valida os 28 codigos do Anexo A, 830 do Anexo C e 133 do Anexo B no arquivo TXT, mas o seed deduplica os nomes antes de consultar/inserir. O seed e idempotente e nao recria nomes existentes.

## Migracao

A migracao e simulada por padrao. Ela escolhe um documento por nome normalizado, remapeia `naturezaId` e `naturezaIds` dos boletins para o documento sobrevivente, preserva o status ativo se qualquer duplicata estiver ativa, apaga os documentos excedentes e remove os campos antigos da colecao. A selecao do sobrevivente prioriza referencias de boletins e, em empate, fatos constatados.

Confira `src/database/db.js` antes de executar. A configuracao atual conecta a `mongodb://127.0.0.1:27017/boonline`.

```powershell
mongodump --uri="mongodb://127.0.0.1:27017/boonline" --archive="$env:TEMP/boonline-before-natureza-name-dedup.archive"
npm run migrate:naturezas:schema -- --dry-run
npm run migrate:naturezas:schema -- --apply
npm run seed:naturezas -- --dry-run
npm run seed:naturezas -- --apply
```

A migracao pode ser repetida. Ela cria um indice unico em `normalizado`; o seed so adiciona nomes que ainda nao existem. A aplicacao deste workspace foi feita somente no MongoDB local, nunca em producao.
