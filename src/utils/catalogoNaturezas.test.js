const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { EXPECTED_COUNTS, parseCatalogoNaturezas } = require('./catalogoNaturezas')
const { planejarImportacao } = require('./naturezaSeed')
const { planejarConsolidacaoNaturezas } = require('./naturezaDeduplication')

test('parses source sections but returns one active nature per normalized name', () => {
    const catalog = parseCatalogoNaturezas([
        'ANEXO A - GRUPOS',
        'TA04 - Roubo',
        'ANEXO C - FATOS CONSTATADOS',
        '1 - Roubo',
        '2 - Furto',
        'ANEXO B - FATOS COMUNICADOS',
        'FC001 - ROUBO'
    ].join('\n'), { GRUPO: 1, FATO_CONSTATADO: 2, FATO_COMUNICADO: 1 })

    assert.deepEqual(catalog.map(item => item.nome), ['Roubo', 'Furto'])
    assert.deepEqual(catalog[0], { nome: 'Roubo', normalizado: 'roubo', ativo: true })
})

test('validates all TXT source counts and returns unique descriptions', () => {
    const file = path.resolve(__dirname, '../../../naturezas_ocorrencias_PMMA.txt')
    const catalog = parseCatalogoNaturezas(fs.readFileSync(file, 'utf8'))
    assert.deepEqual(EXPECTED_COUNTS, { GRUPO: 28, FATO_CONSTATADO: 830, FATO_COMUNICADO: 133 })
    assert.equal(catalog.length, 943)
    assert.equal(new Set(catalog.map(item => item.normalizado)).size, catalog.length)
})

test('seed planning adds each normalized name once and reruns with no additions', () => {
    const catalog = [
        { nome: 'Roubo', normalizado: 'roubo', ativo: true },
        { nome: 'Furto', normalizado: 'furto', ativo: true }
    ]
    const first = planejarImportacao(catalog, [{ _id: 'old-id', nome: 'Roubo', normalizado: 'roubo', ativo: true }])
    assert.deepEqual(first.ausentes.map(item => item.normalizado), ['furto'])
    const second = planejarImportacao(catalog, [
        { _id: 'old-id', nome: 'Roubo', normalizado: 'roubo', ativo: true },
        { _id: 'new-id', nome: 'Furto', normalizado: 'furto', ativo: true }
    ])
    assert.equal(second.ausentes.length, 0)
})

test('consolidation remaps bulletin references and retains one row per description', () => {
    const naturezas = [
        { _id: 'c-id', nome: 'Roubo', normalizado: 'roubo', tipoCatalogo: 'FATO_CONSTATADO', ativo: true },
        { _id: 'b-id', nome: 'ROUBO', normalizado: 'roubo', tipoCatalogo: 'FATO_COMUNICADO', ativo: false },
        { _id: 'f-id', nome: 'Furto', normalizado: 'furto', ativo: false }
    ]
    const boletins = [{
        _id: 'bo-1',
        naturezaId: 'b-id',
        naturezaIds: ['b-id', 'c-id', 'b-id']
    }]
    const plan = planejarConsolidacaoNaturezas(naturezas, boletins)
    assert.deepEqual(plan.removidos, ['b-id'])
    assert.equal(plan.sobreviventes.length, 2)
    assert.equal(plan.sobreviventes.find(item => item.normalizado === 'roubo').ativo, true)
    assert.deepEqual(plan.atualizacoesBoletins, [{
        id: 'bo-1', naturezaId: 'c-id', naturezaIds: ['c-id']
    }])
})

test('rejects incomplete catalogs and duplicate codes within a source section', () => {
    assert.throws(() => parseCatalogoNaturezas('ANEXO A\nTA01 - Grupo', {
        GRUPO: 2, FATO_CONSTATADO: 0, FATO_COMUNICADO: 0
    }), /incompleto ou inesperado/)
    assert.throws(() => parseCatalogoNaturezas([
        'ANEXO B', 'FC001 - A', 'FC001 - B'
    ].join('\n'), { GRUPO: 0, FATO_CONSTATADO: 0, FATO_COMUNICADO: 2 }), /duplicado/)
})
