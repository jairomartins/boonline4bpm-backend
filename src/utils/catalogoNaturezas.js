const { normalizarNatureza } = require('./natureza')

const EXPECTED_COUNTS = { GRUPO: 28, FATO_CONSTATADO: 830, FATO_COMUNICADO: 133 }

function parseCatalogoNaturezas(text, expected = EXPECTED_COUNTS) {
    if (typeof text !== 'string') throw new TypeError('O catálogo deve ser um texto.')

    let secao = ''
    const contagens = { GRUPO: 0, FATO_CONSTATADO: 0, FATO_COMUNICADO: 0 }
    const codigos = new Set()
    const porNome = new Map()

    for (const linha of text.split(/\r?\n/)) {
        if (/^ANEXO A\b/.test(linha)) {
            secao = 'GRUPO'
            continue
        }
        if (/^ANEXO C\b/.test(linha)) {
            secao = 'FATO_CONSTATADO'
            continue
        }
        if (/^ANEXO B\b/.test(linha)) {
            secao = 'FATO_COMUNICADO'
            continue
        }

        const match = secao === 'GRUPO'
            ? /^TA(\d+)\s*-\s*(.+)$/.exec(linha)
            : secao === 'FATO_CONSTATADO'
                ? /^\s*(\d+)\s*-\s*(.+)$/.exec(linha)
                : secao === 'FATO_COMUNICADO'
                    ? /^FC(\d{3})\s*-\s*(.+)$/.exec(linha)
                    : null
        if (!match) continue

        const codigo = secao === 'GRUPO'
            ? `TA${match[1].padStart(2, '0')}`
            : match[1]
        const nome = match[2].trim().replace(/\s+/g, ' ')
        if (!nome) continue

        contagens[secao] += 1
        const codigoUnico = `${secao}:${codigo}`
        if (codigos.has(codigoUnico)) throw new Error(`Código de origem duplicado: ${codigoUnico}.`)
        codigos.add(codigoUnico)

        const normalizado = normalizarNatureza(nome)
        if (!porNome.has(normalizado)) porNome.set(normalizado, { nome, normalizado, ativo: true })
    }

    for (const tipo of Object.keys(EXPECTED_COUNTS)) {
        if (contagens[tipo] !== expected[tipo]) {
            throw new Error(`Catálogo incompleto ou inesperado: ${tipo} tem ${contagens[tipo]} itens; esperado ${expected[tipo]}.`)
        }
    }

    return Array.from(porNome.values())
}

module.exports = { EXPECTED_COUNTS, parseCatalogoNaturezas }
