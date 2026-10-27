const { normalizarNatureza } = require('./natureza')

function parseCatalogoNaturezas(text, expected = { grupos: 28, fatos: 830 }) {
    if (typeof text !== 'string') throw new TypeError('O catálogo deve ser um texto.')

    let secao = ''
    let grupos = 0
    let fatos = 0
    const naturezas = new Map()

    for (const linha of text.split(/\r?\n/)) {
        if (/^ANEXO A\b/.test(linha)) {
            secao = 'grupo'
            continue
        }
        if (/^ANEXO C\b/.test(linha)) {
            secao = 'fato'
            continue
        }

        const correspondencia = secao === 'grupo'
            ? /^TA(\d+)\s*-\s*(.+)$/.exec(linha)
            : secao === 'fato'
                ? /^\s*(\d+)\s*-\s*(.+)$/.exec(linha)
                : null
        if (!correspondencia) continue

        const codigo = secao === 'grupo'
            ? `TA${correspondencia[1].padStart(2, '0')}`
            : correspondencia[1]
        const nome = correspondencia[2].trim().replace(/\s+/g, ' ')
        if (!nome) continue
        if (secao === 'grupo') grupos += 1
        else fatos += 1

        const chave = normalizarNatureza(nome)
        const natureza = naturezas.get(chave) || { nome, categorias: [], codigos: [] }
        const categoria = secao === 'grupo' ? 'Tipos de atendimento' : 'Fatos constatados'
        if (!natureza.categorias.includes(categoria)) natureza.categorias.push(categoria)
        if (!natureza.codigos.includes(codigo)) natureza.codigos.push(codigo)
        naturezas.set(chave, natureza)
    }

    if (grupos !== expected.grupos || fatos !== expected.fatos) {
        throw new Error(`Catálogo incompleto ou inesperado: ${grupos} grupos e ${fatos} fatos encontrados.`)
    }

    return Array.from(naturezas.values()).map(({ nome, categorias, codigos }) => ({
        nome,
        categoria: categorias.join('; '),
        codigos
    }))
}

module.exports = { parseCatalogoNaturezas }
