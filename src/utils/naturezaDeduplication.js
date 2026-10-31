const { normalizarNatureza } = require('./natureza')

const PRIORIDADE_TIPO = {
    FATO_CONSTATADO: 0,
    FATO_COMUNICADO: 1,
    GRUPO: 2,
    PERSONALIZADO: 3,
    LEGADO: 4
}

function planejarConsolidacaoNaturezas(naturezas, boletins) {
    const referencias = new Map()
    for (const boletim of boletins) {
        const boletimIds = new Set([
            ...(Array.isArray(boletim.naturezaIds) ? boletim.naturezaIds : []),
            ...(boletim.naturezaId ? [boletim.naturezaId] : [])
        ].map(String))
        for (const chave of boletimIds) {
            referencias.set(chave, (referencias.get(chave) || 0) + 1)
        }
    }

    const grupos = new Map()
    for (const natureza of naturezas) {
        const normalizado = normalizarNatureza(natureza.normalizado || natureza.nome)
        if (!normalizado) continue
        const grupo = grupos.get(normalizado) || []
        grupo.push(natureza)
        grupos.set(normalizado, grupo)
    }

    const remapeamento = new Map()
    const sobreviventes = []
    const removidos = []
    const duplicidades = []

    for (const [normalizado, grupo] of grupos) {
        const ordenado = [...grupo].sort((a, b) => {
            const referenciasDelta = (referencias.get(String(b._id)) || 0) -
                (referencias.get(String(a._id)) || 0)
            if (referenciasDelta) return referenciasDelta
            const tipoDelta = (PRIORIDADE_TIPO[a.tipoCatalogo] ?? 5) -
                (PRIORIDADE_TIPO[b.tipoCatalogo] ?? 5)
            if (tipoDelta) return tipoDelta
            const ativoDelta = Number(Boolean(b.ativo)) - Number(Boolean(a.ativo))
            if (ativoDelta) return ativoDelta
            return String(a._id).localeCompare(String(b._id))
        })
        const sobrevivente = ordenado[0]
        sobreviventes.push({
            id: sobrevivente._id,
            nome: sobrevivente.nome,
            normalizado,
            ativo: grupo.some(item => item.ativo !== false)
        })
        for (const duplicada of ordenado.slice(1)) {
            remapeamento.set(String(duplicada._id), sobrevivente._id)
            removidos.push(duplicada._id)
        }
        if (grupo.length > 1) duplicidades.push({ normalizado, quantidade: grupo.length })
    }

    const atualizacoesBoletins = []
    for (const boletim of boletins) {
        const originais = Array.isArray(boletim.naturezaIds) ? boletim.naturezaIds : []
        const ids = []
        const vistos = new Set()
        for (const id of originais) {
            const novoId = remapeamento.get(String(id)) || id
            const chave = String(novoId)
            if (!vistos.has(chave)) {
                vistos.add(chave)
                ids.push(novoId)
            }
        }
        const naturezaId = boletim.naturezaId
            ? remapeamento.get(String(boletim.naturezaId)) || boletim.naturezaId
            : null
        const mudou = String(naturezaId || '') !== String(boletim.naturezaId || '') ||
            ids.length !== originais.length || ids.some((id, index) => String(id) !== String(originais[index]))
        if (mudou) atualizacoesBoletins.push({
            id: boletim._id,
            naturezaId,
            naturezaIds: ids
        })
    }

    return { sobreviventes, removidos, remapeamento, duplicidades, atualizacoesBoletins }
}

module.exports = { planejarConsolidacaoNaturezas }
