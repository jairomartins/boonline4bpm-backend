require('dotenv').config()
const fs = require('fs')
const path = require('path')
const mongoose = require('mongoose')
const db = require('../database/db')
const Natureza = require('../model/natureza')
const { EXPECTED_COUNTS, parseCatalogoNaturezas } = require('../utils/catalogoNaturezas')
const { planejarImportacao } = require('../utils/naturezaSeed')
const { requireExplicitMongo } = require('./maintenanceDb')
requireExplicitMongo()

function argumentos() {
    const args = process.argv.slice(2)
    const apply = args.includes('--apply')
    const dryRun = args.includes('--dry-run')
    const fileIndex = args.indexOf('--file')
    if (args.some((arg, index) => !['--apply', '--dry-run', '--file'].includes(arg) &&
        index !== fileIndex + 1) || (apply && dryRun) ||
        (fileIndex !== -1 && !args[fileIndex + 1])) {
        throw new Error('Use --dry-run (padrão) ou --apply, opcionalmente com --file <caminho>.')
    }
    const arquivo = fileIndex === -1
        ? path.resolve(__dirname, '../../../naturezas_ocorrencias_PMMA_atualizado.txt')
        : path.resolve(process.cwd(), args[fileIndex + 1])
    return { apply, arquivo }
}

async function importar() {
    const { apply, arquivo } = argumentos()
    console.log(`Operação: ${apply ? 'aplicar seed idempotente' : 'simular seed'}; coleção: naturezas; fonte: ${arquivo}`)
    const texto = fs.readFileSync(arquivo, 'utf8')
    const itens = parseCatalogoNaturezas(texto)
    const catalogoBruto = Object.values(EXPECTED_COUNTS).reduce((sum, count) => sum + count, 0)
    await db.connection.asPromise()

    let indices = []
    try {
        indices = await Natureza.collection.indexes()
    } catch (error) {
        if (error.codeName !== 'NamespaceNotFound') throw error
    }
    const hasUniqueNameIndex = indices.some(index => index.unique && index.key.normalizado === 1)
    if (apply && !hasUniqueNameIndex) {
        const duplicates = await Natureza.collection.aggregate([
            { $group: { _id: '$normalizado', quantidade: { $sum: 1 } } },
            { $match: { quantidade: { $gt: 1 } } },
            { $limit: 10 }
        ]).toArray()
        if (duplicates.length) {
            throw new Error(`Seed interrompido: existem nomes normalizados duplicados (${duplicates.map(item => item._id).join(', ')}). Revise os dados; nenhuma exclusao foi feita.`)
        }
        await Natureza.collection.createIndex({ normalizado: 1 }, { unique: true, name: 'normalizado_1' })
    }

    const existentes = await Natureza.find().select('_id nome normalizado ativo').lean()
    const plano = planejarImportacao(itens, existentes)
    const relatorio = {
        modo: apply ? 'aplicacao' : 'simulacao',
        fonte: arquivo,
        codigosOrigemValidados: EXPECTED_COUNTS,
        descricoesUnicasNoTxt: itens.length,
        descricoesRepetidasNoTxt: catalogoBruto - itens.length,
        descricoesJaNoBanco: itens.length - plano.ausentes.length,
        documentosAdicionados: plano.ausentes.map(item => ({ nome: item.nome, normalizado: item.normalizado })),
        quantidadeAdicionada: plano.ausentes.length,
        quantidadeDepois: existentes.length + (apply ? plano.ausentes.length : 0)
    }

    if (apply) {
        for (const item of plano.ausentes) {
            await Natureza.updateOne(
                { normalizado: item.normalizado },
                { $setOnInsert: { nome: item.nome, normalizado: item.normalizado, ativo: true } },
                { upsert: true, runValidators: true }
            )
        }
        relatorio.quantidadeDepois = await Natureza.countDocuments()
    }

    console.log(JSON.stringify(relatorio, null, 2))
}

importar()
    .catch(error => {
        console.error('Importacao do catalogo de naturezas interrompida:', error)
        process.exitCode = 1
    })
    .finally(async () => {
        await mongoose.disconnect()
    })
