const test = require('node:test')
const assert = require('node:assert/strict')
const Module = require('node:module')

const naturezaIds = ['64b000000000000000000101', '64b000000000000000000102']
const catalogo = [
    { _id: naturezaIds[0], nome: 'Roubo', normalizado: 'roubo', ativo: true },
    { _id: naturezaIds[1], nome: 'Furto', normalizado: 'furto', ativo: true }
]

function mock(modulePath, exports) {
    const resolvedPath = require.resolve(modulePath)
    const mocked = new Module(resolvedPath)
    mocked.filename = resolvedPath
    mocked.loaded = true
    mocked.exports = exports
    require.cache[resolvedPath] = mocked
}

const Natureza = {
    find(query = {}) {
        let items = catalogo.filter(item => item.ativo === query.ativo || query.ativo === undefined)
        if (query.normalizado?.$regex) {
            const regex = new RegExp(query.normalizado.$regex, query.normalizado.$options || '')
            items = items.filter(item => regex.test(item.normalizado))
        }
        return { sort() { return this }, lean: async () => items }
    },
    findById: async id => catalogo.find(item => item._id === id) || null,
    exists: async query => catalogo.some(item => item.normalizado === query.normalizado),
    create: async data => data
}

mock('../model/natureza', Natureza)
mock('../model/boletim', { countDocuments: async () => 0, aggregate: async () => [] })
mock('../utils/authorization', { getEffectiveAccess: async () => ({ permissions: [] }) })
const controller = require('./naturezaController')

function response() {
    return {
        statusCode: 200,
        body: null,
        status(code) { this.statusCode = code; return this },
        json(value) { this.body = value; return this }
    }
}

test('API returns one active row per nature description', async () => {
    const res = response()
    await controller.listar({ user: { userId: 'user-1' }, query: {} }, res)
    assert.equal(res.statusCode, 200)
    assert.deepEqual(res.body.items.map(item => String(item._id)), naturezaIds)
    assert.ok(res.body.items.every(item => !item.tipoCatalogo && !item.codigoOrigem))
})

test('API can find a nature by its description', async () => {
    const res = response()
    await controller.listar({ user: { userId: 'user-1' }, query: { q: 'rou' } }, res)
    assert.equal(res.statusCode, 200)
    assert.equal(res.body.items.length, 1)
    assert.equal(res.body.items[0].nome, 'Roubo')
})

test('API rejects creating a second nature with the same normalized name', async () => {
    const res = response()
    await controller.criar({ body: { nome: ' RÓUBO ' } }, res)
    assert.equal(res.statusCode, 409)
})
