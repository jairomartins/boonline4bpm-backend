const { normalizarNatureza } = require('./natureza')

function planejarImportacao(itens, existentes) {
    const porNome = new Map()
    for (const item of existentes) {
        const chave = normalizarNatureza(item.normalizado || item.nome)
        if (chave && !porNome.has(chave)) porNome.set(chave, item)
    }
    const ausentes = itens.filter(item => !porNome.has(normalizarNatureza(item.nome)))
    return { existentesPorNome: porNome, ausentes }
}

module.exports = { planejarImportacao }
