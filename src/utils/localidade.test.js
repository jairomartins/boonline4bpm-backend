const test = require('node:test')
const assert = require('node:assert/strict')
const { normalizarLocalidade } = require('./localidade')

test('normaliza Unicode, acentos, caixa e espaços sem aproximar nomes por conta própria', () => {
    assert.equal(normalizarLocalidade('  SÃO   Félix '), 'sao felix')
    assert.equal(normalizarLocalidade('Sao Felix'), 'sao felix')
    assert.notEqual(normalizarLocalidade('São Félix'), normalizarLocalidade('São Felícia'))
})
