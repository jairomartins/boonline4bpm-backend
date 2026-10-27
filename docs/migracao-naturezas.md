# Catálogo oficial de naturezas

## Preparação e proteção dos dados

O arquivo `naturezas_ocorrencias_PMMA.txt` contém 28 grupos de atendimento e 830 fatos constatados. No backend, execute primeiro `npm run seed:naturezas` para simular a importação ou `npm run seed:naturezas -- --apply` para inserir o catálogo. A importação agrega códigos que têm o mesmo nome normalizado (por exemplo, Roubo aparece como grupo e fato), preserva cadastros existentes e é idempotente.

O catálogo usa nomes normalizados para impedir duplicidades de acentuação, caixa e espaços. Antes de migrar boletins antigos, revise os nomes e aliases. O script de migração só associa grafias normalizadas ao nome oficial ou a aliases explicitamente cadastrados; registros sem correspondência única permanecem pendentes.

Antes de qualquer execução com `--apply`, faça backup completo do banco e valide que ele pode ser restaurado em uma base isolada. Exemplo no PowerShell:

```powershell
mongodump --uri="mongodb://127.0.0.1:27017/boonline" --out="C:\backups\boonline-antes-naturezas"
```

Uma restauração de verificação deve apontar para um banco separado, nunca sobre a base em uso. Por exemplo, com uma instalação recente do Database Tools:

```powershell
mongorestore --uri="mongodb://127.0.0.1:27017" --nsFrom="boonline.*" --nsTo="boonline_restore_check.*" "C:\backups\boonline-antes-naturezas"
```

Confirme a existência e a contagem dos documentos no banco de verificação antes da migração. Não use `--drop` nem restaure sobre a base ativa.

## Simulação

Na pasta `boonline4bpm-backend`, execute:

```powershell
npm run migrate:naturezas -- --dry-run
```

O modo padrão também é simulação. O relatório JSON mostra grafias e quantidades, associações que seriam feitas, registros pendentes e conflitos de aliases. Revise cada associação e resolva aliases ambíguos no catálogo antes de aplicar.

## Aplicação

Depois do backup, da revisão do relatório e da aprovação administrativa:

```powershell
npm run migrate:naturezas -- --apply
```

A execução é idempotente: boletins que já têm `naturezaId` não são processados novamente. Uma natureza não é criada pelo script; só são usadas entradas oficiais existentes.

## Reversão da implantação

Para reverter o código, publique novamente as versões anteriores do frontend e backend. Os campos novos (`naturezaId`, `naturezaOriginal`, `naturezaCatalogoMigrada`) e a coleção `naturezas` são aditivos; versões antigas ignoram os campos que não conhecem. Não apague a coleção, os campos ou boletins para reverter o código.

Se for necessário retornar os dados ao estado do backup, restaure-o em uma base isolada e valide-a. Faça a troca da conexão para essa base somente por um procedimento operacional aprovado, com manutenção e novo backup; não restaure diretamente sobre a base ativa. Classificações adicionadas após o backup exigem reconciliação manual antes de qualquer retorno de dados.
