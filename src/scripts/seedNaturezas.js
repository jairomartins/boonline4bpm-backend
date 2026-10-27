require('dotenv').config()
const fs = require('fs')
const path = require('path')
const mongoose = require('mongoose')
const db = require('../database/db')
const Natureza = require('../model/natureza')
const { normalizarNatureza } = require('../utils/natureza')
const { parseCatalogoNaturezas } = require('../utils/catalogoNaturezas')

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
        ? path.resolve(__dirname, '../../../naturezas_ocorrencias_PMMA.txt')
        : path.resolve(process.cwd(), args[fileIndex + 1])
    return { apply, arquivo }
}

async function importar() {
    const { apply, arquivo } = argumentos()
    const itens = parseCatalogoNaturezas(fs.readFileSync(arquivo, 'utf8'))
    await db.connection.asPromise()
    await Natureza.init()

    const catalogoExistente = await Natureza.find().select('nome normalizado').lean()
    const nomesExistentes = new Set(catalogoExistente.map(item =>
        normalizarNatureza(item.nome || item.normalizado)
    ))
    const resultados = { modo: apply ? 'aplicacao' : 'simulacao', fonte: arquivo, catalogo: itens.length, inseridas: 0, existentes: 0 }
    for (const item of itens) {
        const normalizado = normalizarNatureza(item.nome)
        if (nomesExistentes.has(normalizado)) {
            resultados.existentes += 1
            continue
        }
        resultados.inseridas += 1
        if (apply) {
            await Natureza.updateOne(
                { normalizado },
                { $setOnInsert: { ...item, normalizado, ativo: true } },
                { upsert: true, runValidators: true }
            )
        }
        nomesExistentes.add(normalizado)
    }
    console.log(JSON.stringify(resultados, null, 2))
}

importar()
    .catch(error => {
        console.error('Importação do catálogo de naturezas interrompida:', error)
        process.exitCode = 1
    })
    .finally(async () => {
        await mongoose.disconnect()
    })
