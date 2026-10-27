function normalizarNatureza(value) {
    if (typeof value !== 'string') return ''
    return value
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim()
        .replace(/\s+/g, ' ')
        .toLocaleLowerCase('pt-BR')
}

function escapeRegex(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function criarIndiceEquivalencias(naturezas) {
    const equivalencias = new Map()
    for (const natureza of naturezas) {
        for (const nome of [natureza.nome, ...(natureza.aliases || [])]) {
            const chave = normalizarNatureza(nome)
            if (!chave) continue
            const destinos = equivalencias.get(chave) || []
            if (!destinos.some(item => String(item._id) === String(natureza._id))) {
                destinos.push(natureza)
            }
            equivalencias.set(chave, destinos)
        }
    }
    return equivalencias
}

module.exports = { normalizarNatureza, escapeRegex, criarIndiceEquivalencias }
