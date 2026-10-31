require('dotenv').config()
const { requireExplicitMongo } = require('./maintenanceDb')
requireExplicitMongo()
const mongoose = require('mongoose')
const db = require('../database/db')
const Natureza = require('../model/natureza')
const Boletim = require('../model/boletim')
const { planejarConsolidacaoNaturezas } = require('../utils/naturezaDeduplication')

const apply = process.argv.includes('--apply')
const invalid = process.argv.slice(2).some(arg => !['--apply', '--dry-run'].includes(arg)) ||
    (apply && process.argv.includes('--dry-run'))
const camposRemovidos = ['tipoCatalogo', 'codigoOrigem', 'fonte', 'categoria', 'codigos', 'descricao', 'aliases', 'createdAt', 'updatedAt', '__v']

function ehIndiceNormalizado(index) {
    return Object.keys(index.key || {}).length === 1 && index.key.normalizado === 1
}

async function migrar() {
    if (invalid) throw new Error('Use --dry-run (padrão) ou --apply.')
    await db.connection.asPromise()

    const [naturezas, boletins] = await Promise.all([
        Natureza.collection.find({}).toArray(),
        Boletim.collection.find({}, { projection: { naturezaId: 1, naturezaIds: 1 } }).toArray()
    ])
    const plano = planejarConsolidacaoNaturezas(naturezas, boletins)
    let indices = []
    try {
        indices = await Natureza.collection.indexes()
    } catch (error) {
        if (error.codeName !== 'NamespaceNotFound') throw error
    }

    const indicesParaRemover = indices.filter(index =>
        index.key.tipoCatalogo === 1 || index.key.codigoOrigem === 1 ||
        (ehIndiceNormalizado(index) && !index.unique)
    )
    const relatorio = {
        modo: apply ? 'aplicacao' : 'simulacao',
        registrosAntes: naturezas.length,
        nomesUnicosDepois: plano.sobreviventes.length,
        gruposComNomeDuplicado: plano.duplicidades.length,
        documentosExcedentes: plano.removidos.length,
        boletinsComReferenciasRemapeadas: plano.atualizacoesBoletins.length,
        indicesParaRemover: indicesParaRemover.map(index => index.name),
        camposRemovidos: camposRemovidos,
        estrategiaSobrevivente: 'Prioriza referências de boletins; em empate, fato constatado; preserva ativo se qualquer duplicata estiver ativa.',
        impacto: 'Os boletins manterão suas referências, remapeadas para o único documento por nome.'
    }

    if (apply) {
        const atualizacoesBoletins = plano.atualizacoesBoletins.map(item => ({
            updateOne: {
                filter: { _id: item.id },
                update: { $set: { naturezaId: item.naturezaId, naturezaIds: item.naturezaIds } }
            }
        }))
        for (let i = 0; i < atualizacoesBoletins.length; i += 500) {
            await Boletim.collection.bulkWrite(atualizacoesBoletins.slice(i, i + 500), { ordered: false })
        }

        const atualizacoesNaturezas = plano.sobreviventes.map(item => ({
            updateOne: {
                filter: { _id: item.id },
                update: {
                    $set: { nome: item.nome, normalizado: item.normalizado, ativo: item.ativo },
                    $unset: Object.fromEntries(camposRemovidos.map(campo => [campo, '']))
                }
            }
        }))
        for (let i = 0; i < atualizacoesNaturezas.length; i += 500) {
            await Natureza.collection.bulkWrite(atualizacoesNaturezas.slice(i, i + 500), { ordered: false })
        }

        for (let i = 0; i < plano.removidos.length; i += 500) {
            await Natureza.collection.deleteMany({ _id: { $in: plano.removidos.slice(i, i + 500) } })
        }

        for (const index of indicesParaRemover) await Natureza.collection.dropIndex(index.name)
        const uniqueIndex = indices.find(index => ehIndiceNormalizado(index) && index.unique)
        const indexName = uniqueIndex
            ? uniqueIndex.name
            : await Natureza.collection.createIndex({ normalizado: 1 }, { unique: true, name: 'normalizado_1' })
        relatorio.indiceUnicoPorNome = indexName
        relatorio.registrosDepois = await Natureza.countDocuments()
        relatorio.boletinsDepois = await Boletim.countDocuments()
    }

    console.log(JSON.stringify(relatorio, null, 2))
}

migrar()
    .catch(error => {
        console.error('Migração do catálogo de naturezas interrompida:', error)
        process.exitCode = 1
    })
    .finally(async () => {
        await mongoose.disconnect()
    })
