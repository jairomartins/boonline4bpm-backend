require('dotenv').config()
const mongoose = require('mongoose')
const db = require('../database/db')
const Boletim = require('../model/boletim')
const Natureza = require('../model/natureza')
const { normalizarNatureza, criarIndiceEquivalencias } = require('../utils/natureza')

const applyChanges = process.argv.includes('--apply')
const invalidArguments = process.argv.some(argument => !['--apply', '--dry-run'].includes(argument) &&
    argument !== process.argv[0] && argument !== process.argv[1])

async function migrate() {
    if (invalidArguments || (applyChanges && process.argv.includes('--dry-run'))) {
        throw new Error('Use apenas --dry-run (padrão) ou --apply.')
    }

    await db.connection.asPromise()
    const [catalog, groupedLegacy] = await Promise.all([
        Natureza.find().select('_id nome aliases').lean(),
        Boletim.aggregate([
            {
                $match: {
                    naturezaId: null,
                    $or: [
                        { naturezaIds: { $exists: false } },
                        { naturezaIds: { $size: 0 } }
                    ]
                }
            },
            {
                $group: {
                    _id: { $ifNull: ['$natureza', ''] },
                    quantidade: { $sum: 1 }
                }
            },
            { $sort: { quantidade: -1, _id: 1 } }
        ])
    ])

    const equivalencias = criarIndiceEquivalencias(catalog)

    const relatorio = {
        modo: applyChanges ? 'aplicacao' : 'simulacao',
        registrosExaminados: groupedLegacy.reduce((sum, item) => sum + item.quantidade, 0),
        associados: [],
        pendentes: [],
        conflitos: [],
        registrosJaAssociados: await Boletim.countDocuments({
            $or: [
                { naturezaId: { $ne: null } },
                { naturezaIds: { $exists: true, $ne: [] } }
            ]
        })
    }

    for (const grupo of groupedLegacy) {
        const correspondencias = equivalencias.get(normalizarNatureza(grupo._id)) || []
        if (correspondencias.length === 0) {
            relatorio.pendentes.push({ grafia: grupo._id, quantidade: grupo.quantidade })
            continue
        }
        if (correspondencias.length > 1) {
            relatorio.conflitos.push({
                grafia: grupo._id,
                quantidade: grupo.quantidade,
                candidatos: correspondencias.map(item => ({ id: String(item._id), nome: item.nome }))
            })
            continue
        }

        const oficial = correspondencias[0]
        relatorio.associados.push({
            grafia: grupo._id,
            naturezaId: String(oficial._id),
            nomeOficial: oficial.nome,
            quantidade: grupo.quantidade,
            alterado: applyChanges
        })
        if (applyChanges) {
            const filtro = { naturezaId: null }
            filtro.natureza = grupo._id === '' ? { $in: ['', null] } : grupo._id
            const alteracoes = {
                naturezaId: oficial._id,
                naturezaIds: [oficial._id],
                naturezaCatalogoMigrada: true
            }
            if (grupo._id !== oficial.nome) alteracoes.naturezaOriginal = grupo._id
            await Boletim.updateMany(filtro, {
                $set: { ...alteracoes, natureza: oficial.nome }
            }, { timestamps: false })
        }
    }

    console.log(JSON.stringify(relatorio, null, 2))
}

migrate()
    .catch(error => {
        console.error('Migração de naturezas interrompida:', error)
        process.exitCode = 1
    })
    .finally(async () => {
        await mongoose.disconnect()
    })
