const test = require('node:test')
const assert = require('node:assert/strict')
const { publicApiUrl } = require('./publicApiUrl')
test('links públicos preservam /api e produção exige domínio HTTPS explícito', () => {
    assert.equal(publicApiUrl({ NODE_ENV: 'production', PUBLIC_APP_URL: 'https://bo.example.org/api/' }), 'https://bo.example.org/api')
    assert.equal(publicApiUrl({}), 'http://localhost:3001')
    for (const url of ['', 'http://bo.example.org/api', 'https://localhost/api', 'https://127.0.0.2/api', 'https://user:pass@bo.example.org/api', 'https://bo.example.org/api?x=1']) {
        assert.throws(() => publicApiUrl({ NODE_ENV: 'production', PUBLIC_APP_URL: url }))
    }
})
