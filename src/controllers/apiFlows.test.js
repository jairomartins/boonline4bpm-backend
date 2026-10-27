const test = require('node:test')
const assert = require('node:assert/strict')
const http = require('node:http')
const Module = require('node:module')
const jsQR = require('jsqr')
const { PNG } = require('pngjs')
const express = require('express')
const bcrypt = require('bcryptjs')

process.env.SECRET_PASSWORD_TOKEN = 'test-secret-for-api-flows'

const userState = { user: null, created: null }
const reportState = {
    existing: null,
    created: null,
    updated: null,
    reports: [],
    municipalities: [],
    neighborhoods: [],
    distinctCalls: [],
    aggregateResult: [],
    aggregatePipeline: null,
    lastFindQuery: null,
    lastUpdate: null
}
const documentState = {
    documents: [],
    accesses: [],
    validationUrl: null,
    qrBuffer: null,
    mutateRevisionOnCreate: false
}

function mockModule(modulePath, exports) {
    const resolvedPath = require.resolve(modulePath)
    const mocked = new Module(resolvedPath)
    mocked.filename = resolvedPath
    mocked.loaded = true
    mocked.exports = exports
    require.cache[resolvedPath] = mocked
}

const User = {
    findOne: async () => userState.user,
    findById: id => {
        const foundUser = userState.user
            ? { ...userState.user, tipo: String(id) === 'admin-record' ? 'admin' : 'comum' }
            : null
        return {
            select() { return this },
            lean: async () => foundUser,
            then(resolve, reject) { return Promise.resolve(foundUser).then(resolve, reject) }
        }
    },
    create: async user => {
        userState.created = { _id: 'new-user-record', ...user }
        return userState.created
    },
    updateOne: async () => ({ acknowledged: true })
}

const IncidentReport = {
    create: async report => {
        reportState.created = { _id: 'created-report', ...report }
        return reportState.created
    },
    findById: async id => reportState.existing &&
        (!reportState.existing._id || String(reportState.existing._id) === String(id))
        ? reportState.existing
        : null,
    findByIdAndUpdate: async (id, data) => {
        reportState.lastUpdate = { id, data }
        const current = reportState.existing || {}
        const set = data.$set || data
        const increment = data.$inc || {}
        reportState.updated = {
            ...current,
            ...set,
            documentRevision: (Number(current.documentRevision) || 0) +
                (Number(increment.documentRevision) || 0),
            documentVersionSequence: (Number(current.documentVersionSequence) || 0) +
                (Number(increment.documentVersionSequence) || 0),
            currentDocumentVersion: Math.max(
                Number(current.currentDocumentVersion) || 0,
                Number(data.$max && data.$max.currentDocumentVersion) || 0
            )
        }
        Object.keys(data.$unset || {}).forEach(field => delete reportState.updated[field])
        reportState.existing = reportState.updated
        return reportState.updated
    },
    findOneAndUpdate: async (query, data) => {
        const report = reportState.existing
        if (!report || String(report._id) !== String(query._id)) return null
        const revision = query.$or[0].documentRevision
        const existsFallback = query.$or[1].documentRevision.$exists === false
        const matchesRevision = Number(report.documentRevision) === revision ||
            (existsFallback && report.documentRevision === undefined)
        if (!matchesRevision) return null
        report.currentDocumentVersion = Math.max(
            Number(report.currentDocumentVersion) || 0,
            Number(data.$max.currentDocumentVersion) || 0
        )
        return report
    },
    find: query => {
        reportState.lastFindQuery = query
        return {
            sort() { return this },
            limit() { return Promise.resolve(reportState.reports) }
        }
    },
    distinct: async (field, filter) => {
        reportState.distinctCalls.push({ field, filter })
        return field === 'municipio' ? reportState.municipalities : reportState.neighborhoods
    },
    aggregate: pipeline => {
        reportState.aggregatePipeline = pipeline
        return {
            allowDiskUse: async () => reportState.aggregateResult
        }
    },
    findOne: () => ({
        sort: async () => reportState.reports[0] || null
    })
}

const naturezaIds = ['64b000000000000000000001', '64b000000000000000000002']
const natureCatalog = naturezaIds.map((id, index) => ({
    _id: id,
    nome: index === 0 ? 'Roubo' : 'Furto',
    codigos: [index === 0 ? '01' : '02'],
    descricao: 'Classificação registrada',
    ativo: true
}))
const Natureza = {
    collection: { name: 'naturezas' },
    find: query => {
        const result = query && query._id
            ? query._id.$in.map(id => natureCatalog.find(item => item._id === String(id))).filter(Boolean)
            : natureCatalog
        return {
            select() { return this },
            sort() { return this },
            lean() { return this },
            then(resolve, reject) { return Promise.resolve(result).then(resolve, reject) }
        }
    }
}

const BoletimDocumento = {
    create: async data => {
        const document = {
            _id: `document-${documentState.documents.length + 1}`,
            ...data,
            save: async function save() { return this }
        }
        documentState.documents.push(document)
        if (documentState.mutateRevisionOnCreate) {
            reportState.existing.documentRevision =
                (Number(reportState.existing.documentRevision) || 0) + 1
            documentState.mutateRevisionOnCreate = false
        }
        return document
    },
    findOne: query => ({
        select() {
            return this
        },
        then(resolve, reject) {
            return Promise.resolve(documentState.documents.find(
                item => query.tokenHash
                    ? item.tokenHash === query.tokenHash
                    : String(item.incidentReportId) === String(query.incidentReportId) &&
                        item.version === query.version &&
                        item.reportRevision === query.reportRevision &&
                        item.pdfLayoutVersion === query.pdfLayoutVersion &&
                        item.status === query.status
            ) || null).then(resolve, reject)
        }
    }),
    updateMany: async (query, update) => {
        for (const document of documentState.documents) {
            if (String(document.incidentReportId) !== String(query.incidentReportId) ||
                (typeof query.status === 'string' && document.status !== query.status) ||
                (query.status && query.status.$ne && document.status === query.status.$ne) ||
                (query.version && document.version >= query.version.$lt) ||
                (query._id && document._id === query._id.$ne)) continue
            Object.assign(document, update.$set)
        }
        return { acknowledged: true }
    }
}
const BoletimDocumentoAcesso = {
    create: async access => {
        documentState.accesses.push(access)
        return access
    }
}

mockModule('../model/user', User)
mockModule('../model/boletim', IncidentReport)
mockModule('../model/natureza', Natureza)
mockModule('../model/boletimDocumento', BoletimDocumento)
mockModule('../model/boletimDocumentoAcesso', BoletimDocumentoAcesso)
mockModule('../lib/nodemailerconfig', {
    sendMailConfirm: async () => {},
    sendMailRecoverPassword: async () => {}
})
const realQRCode = require('qrcode')
mockModule(require.resolve('qrcode'), {
    ...realQRCode,
    toBuffer: async (value, options) => {
        documentState.validationUrl = value
        documentState.qrBuffer = await realQRCode.toBuffer(value, options)
        return documentState.qrBuffer
    }
})

const { gerarToken } = require('../lib/jwtconfig')
const crypto = require('node:crypto')
process.env.PUBLIC_VALIDATION_BASE_URL = 'https://validacao.example.test'
const app = express()
app.use(express.json())
require('../http/authRouter')(app)
require('../http/incidentReportRoute')(app)

let server
let baseUrl

async function ensureServer() {
    if (server) return
    server = app.listen(0)
    await new Promise(resolve => server.once('listening', resolve))
    server.unref()
    baseUrl = `http://127.0.0.1:${server.address().port}`
}

test.beforeEach(() => {
    userState.user = {
        _id: 'user-record-1',
        userName: 'Policial Teste',
        userEmail: 'policial@example.test',
        userMatriculaId: '12345',
        userPassword: bcrypt.hashSync('senha-segura', 4),
        tipo: 'comum'
    }
    reportState.existing = null
    reportState.created = null
    reportState.updated = null
    reportState.reports = []
    reportState.municipalities = []
    reportState.neighborhoods = []
    reportState.distinctCalls = []
    reportState.aggregateResult = []
    reportState.aggregatePipeline = null
    reportState.lastFindQuery = null
    reportState.lastUpdate = null
    documentState.documents = []
    documentState.accesses = []
    documentState.validationUrl = null
    documentState.qrBuffer = null
    documentState.mutateRevisionOnCreate = false
})

function tokenFor(userId = 'user-record-1', userTipo = 'comum') {
    return gerarToken({ userId, userTipo, userEmail: 'policial@example.test' })
}

async function request(path, { method = 'GET', token, body } = {}) {
    await ensureServer()
    const headers = {}
    if (token) headers['x-access-token'] = token
    let payload
    if (body !== undefined) {
        headers['content-type'] = 'application/json'
        payload = JSON.stringify(body)
    }
    return new Promise((resolve, reject) => {
        const request = http.request(new URL(path, baseUrl), {
            method,
            headers,
            agent: false
        }, response => {
            let text = ''
            response.setEncoding('utf8')
            response.on('data', chunk => { text += chunk })
            response.on('end', () => {
                let responseBody
                try {
                    responseBody = text ? JSON.parse(text) : null
                } catch {
                    responseBody = text
                }
                resolve({ status: response.statusCode, body: responseBody })
            })
        })
        request.on('error', reject)
        request.end(payload)
    })
}

function validReport(overrides = {}) {
    return {
        numero: 'BO-2026-001',
        data: '27/10/2026',
        municipio: 'São Luís',
        naturezaIds: [naturezaIds[0]],
        ...overrides
    }
}

test('login normaliza e-mail, emite token válido e rejeita senha incorreta', async () => {
    const success = await request('/auth/login', {
        method: 'POST',
        body: { userEmail: ' POLICIAL@EXAMPLE.TEST ', userPassword: 'senha-segura' }
    })
    assert.equal(success.status, 200)
    assert.equal(success.body.authenticated, true)
    assert.equal(success.body.userTipo, 'comum')
    assert.ok(success.body.token)

    const invalid = await request('/auth/login', {
        method: 'POST',
        body: { userEmail: 'policial@example.test', userPassword: 'incorreta' }
    })
    assert.equal(invalid.status, 401)
    assert.equal(invalid.body.authenticated, false)
})

test('login exige confirmação do e-mail antes de autenticar', async () => {
    userState.user.emailConfirmationTokenHash = 'pending-confirmation'
    const response = await request('/auth/login', {
        method: 'POST',
        body: { userEmail: 'policial@example.test', userPassword: 'senha-segura' }
    })
    assert.equal(response.status, 403)
    assert.equal(response.body.authenticated, false)
})

test('registra novas contas com role básica e tipo legado comum, ignorando roles do cliente', async () => {
    userState.user = null
    userState.created = null

    const response = await request('/auth/register', {
        method: 'POST',
        body: {
            userName: 'Novo usuário',
            userEmail: 'novo@example.test',
            userPassword: 'senha-segura',
            roleKey: 'administrador',
            tipo: 'admin'
        }
    })

    assert.equal(response.status, 201)
    assert.equal(userState.created.roleKey, 'basico')
    assert.equal(userState.created.tipo, 'comum')
    assert.equal(userState.created.isAtivo, true)
})

test('cria boletim vinculado ao usuário autenticado e atualiza os dados do próprio boletim', async () => {
    const token = tokenFor()
    const created = await request('/incidentReport/create', {
        method: 'POST',
        token,
        body: { incidentReport: validReport({ creatorId: 'forged-user-id' }) }
    })
    assert.equal(created.status, 201)
    assert.equal(reportState.created.creatorId, 'user-record-1')
    assert.equal(reportState.created.natureza, 'Roubo')

    reportState.existing = {
        _id: '64b000000000000000000010',
        creatorId: 'user-record-1',
        numero: 'BO-2026-001',
        data: '27/10/2026',
        municipio: 'São Luís',
        natureza: 'Roubo',
        naturezaIds: [naturezaIds[0]],
        envolvidos: []
    }
    const updated = await request('/incidentReport/create', {
        method: 'POST',
        token,
        body: {
            incidentReport: validReport({
                _id: reportState.existing._id,
                endereco: 'Rua de teste',
                creatorId: 'forged-user-id'
            })
        }
    })
    assert.equal(updated.status, 200)
    assert.equal(reportState.lastUpdate.data.$set.creatorId, undefined)
    assert.equal(reportState.lastUpdate.data.$set.endereco, 'Rua de teste')
    assert.equal(reportState.lastUpdate.data.$inc.documentRevision, 1)
})

test('valida o par de coordenadas no cadastro e normaliza decimais com vírgula', async () => {
    const token = tokenFor()
    const missing = await request('/incidentReport/create', {
        method: 'POST',
        token,
        body: { incidentReport: validReport({ latitude: '  ', longitude: '' }) }
    })
    assert.equal(missing.status, 201)
    assert.equal(Object.hasOwn(reportState.created, 'latitude'), false)
    assert.equal(Object.hasOwn(reportState.created, 'longitude'), false)

    for (const coordinates of [
        { latitude: '-2.5' },
        { longitude: '-44.3' },
        { latitude: '91', longitude: '0' },
        { latitude: '0', longitude: '181' },
        { latitude: 'NaN', longitude: '-44' },
        { latitude: 'Infinity', longitude: '-44' },
        { latitude: '-Infinity', longitude: '-44' },
        { latitude: 'norte', longitude: '-44' },
        { latitude: ' ', longitude: '-44' }
    ]) {
        const response = await request('/incidentReport/create', {
            method: 'POST',
            token,
            body: { incidentReport: validReport(coordinates) }
        })
        assert.equal(response.status, 400, JSON.stringify(coordinates))
    }

    const valid = await request('/incidentReport/create', {
        method: 'POST',
        token,
        body: { incidentReport: validReport({ latitude: '-2,5', longitude: '-44.3' }) }
    })
    assert.equal(valid.status, 201)
    assert.equal(reportState.created.latitude, '-2.5')
    assert.equal(reportState.created.longitude, '-44.3')

    const zeroPoint = await request('/incidentReport/create', {
        method: 'POST',
        token,
        body: { incidentReport: validReport({ latitude: '0', longitude: '0' }) }
    })
    assert.equal(zeroPoint.status, 201)
    assert.equal(reportState.created.latitude, '0')
    assert.equal(reportState.created.longitude, '0')
})

test('edições parciais preservam coordenadas e limpeza explícita remove o par', async () => {
    const reportId = '64b000000000000000000012'
    reportState.existing = {
        _id: reportId,
        creatorId: 'user-record-1',
        latitude: '-2.5',
        longitude: '-44.3',
        envolvidos: []
    }
    const partial = await request('/incidentReport/create', {
        method: 'POST',
        token: tokenFor(),
        body: { incidentReport: validReport({ _id: reportId }) }
    })
    assert.equal(partial.status, 200)
    assert.equal(reportState.updated.latitude, '-2.5')
    assert.equal(reportState.updated.longitude, '-44.3')
    assert.equal(Object.hasOwn(reportState.lastUpdate.data.$set, 'latitude'), false)

    const latitudeEdit = await request('/incidentReport/create', {
        method: 'POST',
        token: tokenFor(),
        body: { incidentReport: validReport({ _id: reportId, latitude: '-3,25' }) }
    })
    assert.equal(latitudeEdit.status, 200)
    assert.equal(reportState.updated.latitude, '-3.25')
    assert.equal(reportState.updated.longitude, '-44.3')

    const clear = await request('/incidentReport/create', {
        method: 'POST',
        token: tokenFor(),
        body: { incidentReport: validReport({ _id: reportId, latitude: '', longitude: '' }) }
    })
    assert.equal(clear.status, 200)
    assert.deepEqual(reportState.lastUpdate.data.$unset, { latitude: 1, longitude: 1 })
    assert.equal(Object.hasOwn(reportState.updated, 'latitude'), false)
    assert.equal(Object.hasOwn(reportState.updated, 'longitude'), false)
})

test('impede editar boletim de outro usuário e protege rotas administrativas', async () => {
    const reportId = '64b000000000000000000011'
    reportState.existing = {
        _id: reportId,
        creatorId: 'another-user',
        numero: 'BO-2026-002',
        data: '27/10/2026',
        municipio: 'São Luís',
        envolvidos: []
    }
    const forbiddenEdit = await request('/incidentReport/create', {
        method: 'POST',
        token: tokenFor(),
        body: { incidentReport: validReport({ _id: reportId }) }
    })
    assert.equal(forbiddenEdit.status, 403)

    const adminOnly = await request('/incidentReport', { token: tokenFor() })
    assert.equal(adminOnly.status, 403)

    const unauthenticated = await request('/incidentReport')
    assert.equal(unauthenticated.status, 401)
})

test('consulta limita resultados ao autor e valida os critérios de pesquisa', async () => {
    reportState.reports = [{ numero: 'BO-2026-001' }]
    const response = await request('/incidentReport/search?number=BO-2026-001&involved=João', {
        token: tokenFor()
    })
    assert.equal(response.status, 200)
    assert.deepEqual(reportState.lastFindQuery.creatorId, 'user-record-1')
    assert.equal(reportState.lastFindQuery.numero, 'BO-2026-001')
    assert.deepEqual(reportState.lastFindQuery['envolvidos.nome'], {
        $regex: 'João',
        $options: 'i'
    })

    const noCriteria = await request('/incidentReport/search', { token: tokenFor() })
    assert.equal(noCriteria.status, 400)

    const invalidDate = await request('/incidentReport/search?date=2026-02-30', {
        token: tokenFor()
    })
    assert.equal(invalidDate.status, 400)
})

test('consulta administrativa não restringe a pesquisa ao autor', async () => {
    const response = await request('/incidentReport/search?number=BO-2026-001', {
        token: tokenFor('admin-record', 'admin')
    })
    assert.equal(response.status, 200)
    assert.equal(reportState.lastFindQuery.creatorId, undefined)
})

test('mapa geográfico é protegido por perfil administrativo e omite dados pessoais', async () => {
    const userOptions = await request('/incidentReport/statistics/geographic/options', {
        token: tokenFor()
    })
    assert.equal(userOptions.status, 403)
    const userMap = await request(
        '/incidentReport/statistics/geographic?from=2026-10-01&to=2026-10-27&municipality=Balsas',
        { token: tokenFor() }
    )
    assert.equal(userMap.status, 403)

    const noToken = await request('/incidentReport/statistics/geographic/options')
    assert.equal(noToken.status, 401)

    reportState.municipalities = ['São Luís', 'Balsas']
    const options = await request('/incidentReport/statistics/geographic/options', {
        token: tokenFor('admin-record', 'admin')
    })
    assert.equal(options.status, 200)
    assert.deepEqual(options.body.municipalities, ['Balsas', 'São Luís'])
    assert.deepEqual(options.body.neighborhoods, [])
    assert.deepEqual(options.body.natures.map(item => item.nome), ['Roubo', 'Furto'])
    assert.deepEqual(reportState.distinctCalls, [{ field: 'municipio', filter: undefined }])

    reportState.distinctCalls = []
    reportState.neighborhoods = ['Centro', 'Cohab']
    const selectedMunicipalityOptions = await request(
        `/incidentReport/statistics/geographic/options?municipality=${encodeURIComponent('São Luís')}`,
        { token: tokenFor('admin-record', 'admin') }
    )
    assert.equal(selectedMunicipalityOptions.status, 200)
    assert.deepEqual(selectedMunicipalityOptions.body.neighborhoods, ['Centro', 'Cohab'])
    assert.deepEqual(reportState.distinctCalls, [
        { field: 'municipio', filter: undefined },
        { field: 'bairro', filter: { municipio: 'São Luís' } }
    ])

    reportState.aggregateResult = [{
        summary: [{
            totalReports: 3,
            validCoordinates: 1,
            missingCoordinates: 1,
            invalidCoordinates: 1
        }],
        heat: Array.from({ length: 5001 }, (_item, index) => ({
            latitude: -2.53 + index / 10000,
            longitude: -44.3,
            weight: index === 0 ? 2 : 1
        })),
        points: [{
            _id: '64b000000000000000000040',
            numero: 'BO-2026-040',
            data: '27/10/2026',
            natureza: 'Roubo',
            bairro: 'Centro',
            municipio: 'São Luís',
            latitude: -2.53,
            longitude: -44.3
        }],
        pointCount: [{ value: 1 }],
        neighborhoods: [{ bairro: 'Centro', total: 1 }],
        natures: [{ naturezaId: naturezaIds[0], natureza: 'Roubo', total: 2 }]
    }]
    const map = await request(
        `/incidentReport/statistics/geographic?from=2026-10-01&to=2026-10-27&municipality=${encodeURIComponent('São Luís')}&natureId=${naturezaIds[0]}&bairro=Centro`,
        { token: tokenFor('admin-record', 'admin') }
    )
    assert.equal(map.status, 200)
    assert.equal(map.body.summary.totalReports, 3)
    assert.equal(map.body.summary.invalidCoordinates, 1)
    assert.equal(map.body.summary.geoCoveragePercent, 33.3)
    assert.equal(map.body.heatmap.cells.length, 5000)
    assert.equal(map.body.heatmap.truncated, true)
    assert.deepEqual(map.body.heatmap.cells[0], { latitude: -2.53, longitude: -44.3, weight: 2 })
    assert.deepEqual(Object.keys(map.body.points.items[0]).sort(), [
        '_id', 'bairro', 'data', 'latitude', 'longitude', 'municipio', 'natureza', 'numero'
    ])
    assert.equal(map.body.points.total, 1)
    assert.equal(map.body.natureCountingRule, 'Uma ocorrência com várias naturezas conta uma vez em cada natureza.')
    const mapMatch = reportState.aggregatePipeline[0].$match
    assert.equal(mapMatch.municipio, 'São Luís')
    assert.equal(mapMatch.bairro, 'Centro')
    assert.deepEqual(
        mapMatch.$or.map(condition => String(condition.naturezaIds || condition.naturezaId)),
        [naturezaIds[0], naturezaIds[0]]
    )
    const pointProjection = reportState.aggregatePipeline
        .find(stage => stage.$facet).$facet.points
        .find(stage => stage.$project).$project
    const facets = reportState.aggregatePipeline.find(stage => stage.$facet).$facet
    const countFacetStages = value => {
        if (Array.isArray(value)) return value.reduce((total, item) => total + countFacetStages(item), 0)
        if (!value || typeof value !== 'object') return 0
        return (Object.prototype.hasOwnProperty.call(value, '$facet') ? 1 : 0) +
            Object.values(value).reduce((total, item) => total + countFacetStages(item), 0)
    }
    assert.equal(countFacetStages(reportState.aggregatePipeline), 1)
    assert.equal(facets.heat.some(stage => stage.$facet), false)
    assert.ok(facets.heat.some(stage => stage.$limit === 5001))
    assert.ok(facets.heat.some(stage => stage.$match && stage.$match._mapCoordinatesValid))
    assert.ok(facets.natures.some(stage => stage.$unwind === '$_mapNatureIds'))
    assert.ok(facets.natures.some(stage =>
        stage.$match && stage.$match._mapCoordinatesValid === true
    ))
    const coordinateStages = reportState.aggregatePipeline.filter(stage => stage.$addFields)
    assert.ok(coordinateStages.some(stage =>
        stage.$addFields._mapLatitudeTypeValid &&
        stage.$addFields._mapLongitudeTypeValid
    ))
    assert.equal(
        facets.natures.find(stage => stage.$project).$project.natureza,
        '$nome'
    )
    assert.equal(pointProjection.cpf, undefined)
    assert.equal(pointProjection.historicohtml, undefined)
    assert.equal(facets.records.find(stage => stage.$project).$project.endereco, undefined)
    const coordinateStatus = reportState.aggregatePipeline.find(stage =>
        stage.$addFields && stage.$addFields._mapCoordinateStatus
    ).$addFields._mapCoordinateStatus.$switch
    assert.deepEqual(coordinateStatus.branches.map(branch => branch.then), ['missing', 'valid'])
})

test('mapa valida município, intervalo, tipo de data e limites da paginação', async () => {
    const token = tokenFor('admin-record', 'admin')
    const base = 'from=2026-01-01&to=2026-01-02&municipality=Balsas'
    for (const query of [
        'from=2026-01-01&to=2026-01-02',
        'from=2024-01-01&to=2026-01-02&municipality=Balsas',
        `${base}&dateField=created`,
        `${base}&page=0`,
        `${base}&pageSize=101`
    ]) {
        const response = await request(`/incidentReport/statistics/geographic?${query}`, { token })
        assert.equal(response.status, 400)
    }
})

test('emite PDF persistido com QR e expõe apenas metadados mínimos na validação pública', async () => {
    reportState.existing = {
        _id: '64b000000000000000000020',
        creatorId: 'user-record-1',
        numero: 'BO-2026-003',
        data: '27/10/2026',
        municipio: 'São Luís',
        natureza: 'Roubo',
        naturezaIds: [naturezaIds[0]],
        documentRevision: 2,
        envolvidos: [{ nome: 'Pessoa restrita', cpf: '52998224725' }],
        materiaisApreendidos: [],
        efetivo: [],
        historicohtml: '<p>Relato completo</p>',
        createdAt: new Date('2026-10-27T10:00:00Z')
    }
    const issued = await request(`/incidentReport/${reportState.existing._id}/documents`, {
        method: 'POST',
        token: tokenFor(),
        body: {}
    })
    assert.equal(issued.status, 201)
    assert.match(issued.body.toString('latin1'), /^%PDF-/)
    assert.match(issued.body.toString('latin1'), /\/Subtype\s*\/Image/)
    assert.equal(documentState.documents.length, 1)
    assert.equal(documentState.documents[0].reportRevision, 2)
    assert.equal(reportState.existing.currentDocumentVersion, 1)

    const reprinted = await request(`/incidentReport/${reportState.existing._id}/documents`, {
        method: 'POST',
        token: tokenFor(),
        body: {}
    })
    assert.equal(reprinted.status, 200)
    assert.equal(reprinted.body, issued.body)
    assert.equal(documentState.documents.length, 1)

    const outdatedToken = new URL(documentState.validationUrl).pathname.split('/').pop()
    documentState.documents[0].pdfLayoutVersion = 2
    const updatedLayout = await request(`/incidentReport/${reportState.existing._id}/documents`, {
        method: 'POST',
        token: tokenFor(),
        body: {}
    })
    assert.equal(updatedLayout.status, 201)
    assert.equal(documentState.documents.length, 2)
    assert.equal(documentState.documents[0].status, 'superseded')
    assert.equal(documentState.documents[1].pdfLayoutVersion, 3)
    const outdatedValidation = await request(
        `/incidentReport/documents/validation/${outdatedToken}`
    )
    assert.equal(outdatedValidation.body.status, 'superseded')

    const token = new URL(documentState.validationUrl).pathname.split('/').pop()
    const qrUrl = new URL(documentState.validationUrl)
    assert.equal(qrUrl.protocol, 'https:')
    assert.equal(qrUrl.hostname, 'validacao.example.test')
    assert.equal(qrUrl.pathname, `/validar-boletim/${token}`)
    assert.equal(documentState.validationUrl.includes('52998224725'), false)
    const qrImage = PNG.sync.read(documentState.qrBuffer)
    const decodedQr = jsQR(
        Uint8ClampedArray.from(qrImage.data),
        qrImage.width,
        qrImage.height
    )
    assert.equal(decodedQr && decodedQr.data, documentState.validationUrl)
    assert.equal(documentState.documents[1].tokenHash,
        crypto.createHash('sha256').update(token).digest('hex'))
    const validation = await request(`/incidentReport/documents/validation/${token}`)
    assert.equal(validation.status, 200)
    assert.equal(validation.body.valid, true)
    assert.equal(validation.body.documentNumber, undefined)
    assert.equal(validation.body.version, 2)
    assert.equal(validation.body.integrityVerified, true)
    assert.equal(JSON.stringify(validation.body).includes('52998224725'), false)
    assert.equal(JSON.stringify(validation.body).includes('Pessoa restrita'), false)

    const publicDetails = await request(
        `/incidentReport/documents/validation/${token}/details`
    )
    assert.equal(publicDetails.status, 401)
    const authorizedDetails = await request(
        `/incidentReport/documents/validation/${token}/details`,
        { token: tokenFor() }
    )
    assert.equal(authorizedDetails.status, 200)
    assert.equal(authorizedDetails.body.documentNumber, 'BO-2026-003')
    const unauthorizedDetails = await request(
        `/incidentReport/documents/validation/${token}/details`,
        { token: tokenFor('different-user') }
    )
    assert.equal(unauthorizedDetails.status, 404)

    const unauthorized = await request(`/incidentReport/documents/validation/${token}/pdf`, {
        token: tokenFor('different-user')
    })
    assert.equal(unauthorized.status, 404)

    const downloaded = await request(`/incidentReport/documents/validation/${token}/pdf`, {
        token: tokenFor()
    })
    assert.equal(downloaded.status, 200)
    assert.equal(downloaded.body.toString('latin1'), updatedLayout.body.toString('latin1'))
    assert.equal(documentState.accesses.length, 1)
    assert.equal(documentState.accesses[0].actorId, 'user-record-1')

    documentState.documents[1].pdf = Buffer.from('%PDF adulterado')
    const altered = await request(`/incidentReport/documents/validation/${token}`)
    assert.equal(altered.body.valid, false)
    assert.equal(altered.body.status, 'integrity_error')
    assert.equal(altered.body.integrityVerified, false)
})

test('retificação substitui a versão antiga e token inválido não revela dados', async () => {
    const reportId = '64b000000000000000000021'
    reportState.existing = {
        _id: reportId,
        creatorId: 'user-record-1',
        numero: 'BO-2026-004',
        data: '27/10/2026',
        municipio: 'São Luís',
        natureza: 'Roubo',
        naturezaIds: [],
        documentRevision: 0,
        envolvidos: [],
        materiaisApreendidos: [],
        efetivo: [],
        historicohtml: ''
    }
    const issued = await request(`/incidentReport/${reportId}/documents`, {
        method: 'POST',
        token: tokenFor(),
        body: {}
    })
    assert.equal(issued.status, 201)
    const token = new URL(documentState.validationUrl).pathname.split('/').pop()
    const update = await request('/incidentReport/create', {
        method: 'POST',
        token: tokenFor(),
        body: {
            incidentReport: validReport({
                _id: reportId,
                endereco: 'Endereço atualizado'
            })
        }
    })
    assert.equal(update.status, 200)
    assert.equal(reportState.existing.documentRevision, 1)
    assert.equal(documentState.documents[0].status, 'superseded')

    const validation = await request(`/incidentReport/documents/validation/${token}`)
    assert.equal(validation.body.valid, false)
    assert.equal(validation.body.status, 'superseded')
    assert.equal(validation.body.documentNumber, undefined)

    const invalid = await request('/incidentReport/documents/validation/invalid-token')
    assert.equal(invalid.status, 200)
    assert.equal(invalid.body.status, 'invalid')
    assert.equal(invalid.body.documentNumber, undefined)
})

test('proprietário pode revogar a cópia e usuários externos não podem baixar seu conteúdo', async () => {
    const reportId = '64b000000000000000000022'
    reportState.existing = {
        _id: reportId,
        creatorId: 'user-record-1',
        numero: 'BO-2026-005',
        natureza: 'Furto',
        naturezaIds: [],
        documentRevision: 0,
        envolvidos: [],
        materiaisApreendidos: [],
        efetivo: [],
        historicohtml: ''
    }
    const issued = await request(`/incidentReport/${reportId}/documents`, {
        method: 'POST',
        token: tokenFor(),
        body: {}
    })
    assert.equal(issued.status, 201)
    const token = new URL(documentState.validationUrl).pathname.split('/').pop()

    const revoked = await request(`/incidentReport/documents/validation/${token}/revoke`, {
        method: 'POST',
        token: tokenFor(),
        body: {}
    })
    assert.equal(revoked.status, 200)
    assert.equal(documentState.documents[0].status, 'revoked')

    const validation = await request(`/incidentReport/documents/validation/${token}`)
    assert.equal(validation.body.valid, false)
    assert.equal(validation.body.status, 'revoked')
    const download = await request(`/incidentReport/documents/validation/${token}/pdf`, {
        token: tokenFor()
    })
    assert.equal(download.status, 404)
})

test('não emite como atual um PDF se o boletim mudar durante a geração', async () => {
    const reportId = '64b000000000000000000023'
    reportState.existing = {
        _id: reportId,
        creatorId: 'user-record-1',
        numero: 'BO-2026-006',
        natureza: 'Furto',
        naturezaIds: [],
        documentRevision: 0,
        envolvidos: [],
        materiaisApreendidos: [],
        efetivo: [],
        historicohtml: ''
    }
    documentState.mutateRevisionOnCreate = true
    const response = await request(`/incidentReport/${reportId}/documents`, {
        method: 'POST',
        token: tokenFor(),
        body: {}
    })
    assert.equal(response.status, 409)
    assert.equal(documentState.documents[0].status, 'superseded')
    assert.equal(reportState.existing.currentDocumentVersion, 0)
})

test('permite localhost em desenvolvimento, mas exige domínio HTTPS em produção', async () => {
    const reportId = '64b000000000000000000024'
    reportState.existing = {
        _id: reportId,
        creatorId: 'user-record-1',
        numero: 'BO-2026-007',
        documentRevision: 0,
        envolvidos: [],
        materiaisApreendidos: [],
        efetivo: [],
        historicohtml: ''
    }
    const previousUrl = process.env.PUBLIC_VALIDATION_BASE_URL
    const previousNodeEnv = process.env.NODE_ENV
    process.env.NODE_ENV = 'development'
    process.env.PUBLIC_VALIDATION_BASE_URL = 'http://localhost:3000'
    try {
        const developmentResponse = await request(`/incidentReport/${reportId}/documents`, {
            method: 'POST',
            token: tokenFor(),
            body: {}
        })
        assert.equal(developmentResponse.status, 201)
        assert.equal(new URL(documentState.validationUrl).origin, 'http://localhost:3000')
        assert.equal(documentState.documents.length, 1)

        process.env.NODE_ENV = 'production'
        process.env.PUBLIC_VALIDATION_BASE_URL = 'http://localhost:3000'
        reportState.existing._id = '64b000000000000000000025'
        const productionResponse = await request(
            '/incidentReport/64b000000000000000000025/documents',
            { method: 'POST', token: tokenFor(), body: {} }
        )
        assert.equal(productionResponse.status, 503)
        assert.equal(documentState.documents.length, 1)
    } finally {
        if (previousUrl === undefined) delete process.env.PUBLIC_VALIDATION_BASE_URL
        else process.env.PUBLIC_VALIDATION_BASE_URL = previousUrl
        if (previousNodeEnv === undefined) delete process.env.NODE_ENV
        else process.env.NODE_ENV = previousNodeEnv
    }
})
