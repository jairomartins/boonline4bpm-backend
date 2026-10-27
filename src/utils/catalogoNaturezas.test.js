const test = require('node:test')
const assert = require('node:assert/strict')
const { parseCatalogoNaturezas } = require('./catalogoNaturezas')

test('parses catalog groups and facts, merging equivalent names while retaining codes', () => {
    const catalog = parseCatalogoNaturezas([
        'ANEXO A - GRUPOS',
        'TA04 - Roubo',
        'ANEXO C - FATOS',
        '81 - roubo',
        '82 - Furto'
    ].join('\n'), { grupos: 1, fatos: 2 })

    assert.deepEqual(catalog, [
        { nome: 'Roubo', categoria: 'Tipos de atendimento; Fatos constatados', codigos: ['TA04', '81'] },
        { nome: 'Furto', categoria: 'Fatos constatados', codigos: ['82'] }
    ])
})

test('rejects incomplete source files', () => {
    assert.throws(
        () => parseCatalogoNaturezas('ANEXO A\nTA01 - Roubo', { grupos: 1, fatos: 1 }),
        /incompleto ou inesperado/
    )
})
