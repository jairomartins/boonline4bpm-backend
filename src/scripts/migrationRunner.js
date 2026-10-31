require('dotenv').config()
process.env.MIGRATION_MODE = 'true'

const { requireExplicitMongo } = require('./maintenanceDb')
requireExplicitMongo()
const mongoose = require('../database/db')
const migrateRoles = require('./migrateRoles')

const migrations = [
    {
        id: '2026-10-29-boletim-idempotency-v1',
        description: 'Cria índice parcial único por usuário e clientRequestId para impedir boletins duplicados em reenvios.',
        run: async () => {
            const Boletim = require('../model/boletim')
            await Boletim.collection.createIndex(
                { creatorId: 1, clientRequestId: 1 },
                {
                    unique: true,
                    partialFilterExpression: { clientRequestId: { $type: 'string' } },
                    name: 'creator_clientRequestId_unique'
                }
            )
        }
    },
    {
        id: '2026-10-29-roles-v1',
        description: 'Cria perfis de sistema ausentes e preenche roleKey legado vazio.',
        run: migrateRoles
    },
    {
        id: '2026-10-29-localidades-index-v1',
        description: 'Cria coleção territorial com unicidade por município, nome normalizado, tipo e zona.',
        run: async () => {
            await mongoose.connection.db.collection('localidades').createIndex(
                { municipio: 1, nomeNormalizado: 1, tipo: 1, zona: 1 },
                { unique: true, name: 'uniq_localidade_contexto' }
            )
        }
    },
    {
        id: '2026-10-29-localidades-alias-index-v1',
        description: 'Adiciona índice de busca dos aliases territoriais por município.',
        run: async () => {
            await mongoose.connection.db.collection('localidades').createIndex(
                { municipio: 1, aliasesNormalizados: 1 },
                { name: 'localidade_aliases_busca' }
            )
        }
    },
    {
        id: '2026-10-29-localidades-unique-name-v1',
        description: 'Garante nome territorial único por município; interrompe antes da alteração se houver nomes duplicados para revisão administrativa.',
        run: async () => {
            const collection = mongoose.connection.db.collection('localidades')
            const duplicates = await collection.aggregate([
                { $match: { municipio: { $type: 'string', $ne: '' }, nomeNormalizado: { $type: 'string', $ne: '' } } },
                { $group: { _id: { municipio: '$municipio', nomeNormalizado: '$nomeNormalizado' }, ids: { $push: '$_id' }, nomes: { $addToSet: '$nome' }, total: { $sum: 1 } } },
                { $match: { total: { $gt: 1 } } },
                { $limit: 20 }
            ]).toArray()
            if (duplicates.length) {
                const summary = duplicates.map(item => `${item._id.municipio}: ${item.nomes.join(' / ')} (${item.total} registros)`).join('; ')
                throw new Error(`Existem nomes duplicados no catálogo territorial. Revise-os antes de aplicar o índice único: ${summary}`)
            }
            await collection.createIndex(
                { municipio: 1, nomeNormalizado: 1 },
                { unique: true, name: 'uniq_localidade_municipio_nome' }
            )
            const indexes = await collection.listIndexes().toArray()
            if (indexes.some(index => index.name === 'uniq_localidade_contexto')) {
                await collection.dropIndex('uniq_localidade_contexto')
            }
        }
    },
    {
        id: '2026-10-29-boletim-localidade-index-v1',
        description: 'Otimiza filtros territoriais por identificador nos boletins sem alterar documentos.',
        run: async () => {
            const Boletim = require('../model/boletim')
            await Boletim.collection.createIndex({ localidadeId: 1 }, { name: 'boletim_localidade_id' })
        }
    }
]

function databaseLabel(uri) {
    try {
        const parsed = new URL(uri)
        const database = parsed.pathname.replace(/^\//, '').split('/')[0] || '(default)'
        return `${parsed.hostname}/${database}`
    } catch {
        return '(URI MongoDB configurada)'
    }
}

async function main() {
    const statusOnly = process.argv.includes('--status')
    const knownArgs = process.argv.slice(2)
    if (knownArgs.some(arg => arg !== '--status')) throw new Error('Argumento inválido. Use --status.')

    await mongoose.connection.asPromise()
    const database = mongoose.connection.db
    console.log(`MongoDB conectado: ${databaseLabel(process.env.MONGO)}`)
    const history = database.collection('_schema_migrations')
    const applied = await history.find({ status: 'applied' }).toArray()
    const appliedIds = new Set(applied.map(item => item._id))
    const pending = migrations.filter(migration => !appliedIds.has(migration.id))

    if (statusOnly) {
        console.log(JSON.stringify({ aplicadas: applied.map(item => item._id), pendentes: pending.map(item => ({ id: item.id, descricao: item.description })) }, null, 2))
        return
    }

    if (!pending.length) {
        console.log('Nenhuma migração pendente.')
        return
    }

    for (const migration of pending) {
        console.log(`Executando ${migration.id}: ${migration.description}`)
        const record = { _id: migration.id, description: migration.description, status: 'running', startedAt: new Date() }
        await history.updateOne({ _id: migration.id }, { $set: record }, { upsert: true })
        try {
            await migration.run()
            await history.updateOne({ _id: migration.id }, { $set: { status: 'applied', completedAt: new Date() }, $unset: { error: '' } })
            console.log(`Concluída: ${migration.id}`)
        } catch (error) {
            await history.updateOne({ _id: migration.id }, { $set: { status: 'failed', failedAt: new Date(), error: error.message } })
            throw new Error(`Migração ${migration.id} falhou e não foi marcada como concluída: ${error.message}`)
        }
    }
}

main()
    .catch(error => {
        console.error('Executor de migrações interrompido:', error.message)
        process.exitCode = 1
    })
    .finally(() => mongoose.disconnect())
