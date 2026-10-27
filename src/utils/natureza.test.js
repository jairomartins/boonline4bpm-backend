const test = require('node:test')
const assert = require('node:assert/strict')
const { normalizarNatureza, criarIndiceEquivalencias } = require('./natureza')

test('normalizes case, accents, and repeated surrounding whitespace', () => {
    assert.equal(normalizarNatureza('  VIOLÊNCIA   DOMÉSTICA '), 'violencia domestica')
    assert.equal(normalizarNatureza(' Roubo '), normalizarNatureza('ROUBO'))
})

test('does not equate legally distinct classifications', () => {
    assert.notEqual(normalizarNatureza('Roubo'), normalizarNatureza('Furto'))
})

test('resolves only explicit official names and aliases, retaining ambiguous candidates', () => {
    const catalog = [
        { _id: '1', nome: 'Roubo', aliases: ['Subtração com violência'] },
        { _id: '2', nome: 'Furto', aliases: ['Subtração sem violência'] },
        { _id: '3', nome: 'Outra classificação', aliases: ['Subtração com violência'] },
    ]
    const index = criarIndiceEquivalencias(catalog)
    assert.deepEqual(index.get(normalizarNatureza(' roubo ')).map(item => item._id), ['1'])
    assert.deepEqual(
        index.get(normalizarNatureza('Subtração com violência')).map(item => item._id),
        ['1', '3']
    )
    assert.equal(index.get(normalizarNatureza('Não cadastrada')), undefined)
})
