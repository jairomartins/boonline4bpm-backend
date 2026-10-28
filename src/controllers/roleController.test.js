const test = require('node:test')
const assert = require('node:assert/strict')
const Module = require('node:module')

const users = new Map()
const roles = new Map()
const auditEvents = []
let nextObjectId = 100

const adminId = '64b000000000000000000001'
const basicId = '64b000000000000000000002'

function installMock(modulePath, exports) {
    const resolvedPath = require.resolve(modulePath)
    const mocked = new Module(resolvedPath)
    mocked.filename = resolvedPath
    mocked.loaded = true
    mocked.exports = exports
    require.cache[resolvedPath] = mocked
}

function makeRole(data) {
    return {
        _id: data._id || (nextObjectId++).toString(16).padStart(24, '0'),
        permissions: [],
        ...data,
        async save() {
            roles.set(this.key, this)
            return this
        }
    }
}

const User = {
    findById: async id => users.get(String(id)) || null,
    countDocuments: async query => {
        if (query && query.roleKey) {
            return [...users.values()].filter(user => user.roleKey === query.roleKey).length
        }
        return [...users.values()].filter(user =>
            (user.roleKey === 'administrador' || (!user.roleKey && user.tipo === 'admin')) &&
            user.isAtivo !== false && user.isAtivo !== 'false'
        ).length
    },
    aggregate: async () => [...users.values()].reduce((counts, user) => {
        if (!user.roleKey) return counts
        const found = counts.find(item => item._id === user.roleKey)
        if (found) found.count += 1
        else counts.push({ _id: user.roleKey, count: 1 })
        return counts
    }, []),
    updateMany: async (query, update) => {
        let modifiedCount = 0
        for (const user of users.values()) {
            if (user.roleKey === query.roleKey) {
                user.roleKey = update.$set.roleKey
                modifiedCount += 1
            }
        }
        return { modifiedCount }
    }
}

const Role = {
    create: async data => {
        const role = makeRole(data)
        if ([...roles.values()].some(item =>
            item.key === role.key || item.normalizedName === role.normalizedName
        )) {
            const error = new Error('duplicate key')
            error.code = 11000
            throw error
        }
        roles.set(role.key, role)
        return role
    },
    findById: async id => [...roles.values()].find(role => String(role._id) === String(id)) || null,
    findOne: async query => roles.get(query.key) && (!query.active || roles.get(query.key).active)
        ? roles.get(query.key)
        : null,
    find: () => ({ sort() { return this }, lean: async () => [...roles.values()] }),
    updateOne: async (query, update) => {
        if (!roles.has(query.key)) roles.set(query.key, makeRole({ ...update.$setOnInsert, key: query.key }))
        return { acknowledged: true }
    }
}

installMock('../model/user', User)
installMock('../model/role', Role)
installMock('../model/adminAuditLog', {
    create: async event => {
        auditEvents.push(event)
        return event
    }
})

const controller = require('./roleController')
const { permissionCatalog } = require('../utils/permissionCatalog')
const {
    getEffectiveAccess,
    isAccountActive,
    isAdministratorUser,
    requirePermission
} = require('../utils/authorization')

function response() {
    return {
        statusCode: 200,
        body: null,
        status(code) {
            this.statusCode = code
            return this
        },
        json(body) {
            this.body = body
            return this
        }
    }
}

function request(body = {}, params = {}, userId = adminId) {
    return { body, params, user: { userId } }
}

test.beforeEach(() => {
    users.clear()
    roles.clear()
    auditEvents.length = 0
    nextObjectId = 100
    roles.set('basico', makeRole({
        key: 'basico',
        name: 'Básico',
        active: true,
        permissions: ['dashboard.view']
    }))
    roles.set('administrador', makeRole({
        key: 'administrador',
        name: 'Administrador',
        active: true,
        permissions: permissionCatalog.map(item => item.id)
    }))
    users.set(adminId, {
        _id: adminId,
        tipo: 'admin',
        roleKey: 'administrador',
        isAtivo: 'true',
        async save() { users.set(this._id, this); return this }
    })
    users.set(basicId, {
        _id: basicId,
        tipo: 'comum',
        roleKey: 'basico',
        isAtivo: 'true',
        async save() { users.set(this._id, this); return this }
    })
})

test('creates and edits roles using only catalogued permissions and audits changes', async () => {
    const createdResponse = response()
    await controller.createRole(
        request({ name: 'Plantão Noturno', description: 'Consulta operacional', permissions: ['dashboard.view'] }),
        createdResponse
    )
    assert.equal(createdResponse.statusCode, 201)
    assert.equal(createdResponse.body.role.key, 'plantao-noturno')
    assert.equal(auditEvents[0].action, 'role.created')

    const role = roles.get('plantao-noturno')
    const updatedResponse = response()
    await controller.updateRole(
        request({ permissions: ['dashboard.view', 'boletins.view.own'] }, { id: role._id }),
        updatedResponse
    )
    assert.equal(updatedResponse.statusCode, 200)
    assert.deepEqual(role.permissions, ['dashboard.view', 'boletins.view.own'])
    assert.equal(auditEvents.at(-1).action, 'role.updated')
})

test('assigns active roles, rejects inactive roles, and reassigns only after deactivation confirmation', async () => {
    roles.set('copom', makeRole({ key: 'copom', name: 'COPOM', active: true, permissions: ['dashboard.view'] }))
    const assigned = response()
    await controller.assignUserRole(request({ roleKey: 'copom' }, { id: basicId }), assigned)
    assert.equal(assigned.statusCode, 200)
    assert.equal(users.get(basicId).roleKey, 'copom')

    roles.get('copom').active = false
    const inactiveAssignment = response()
    await controller.assignUserRole(request({ roleKey: 'copom' }, { id: basicId }), inactiveAssignment)
    assert.equal(inactiveAssignment.statusCode, 400)

    roles.get('copom').active = true
    const noConfirmation = response()
    await controller.updateRole(request({ active: false }, { id: roles.get('copom')._id }), noConfirmation)
    assert.equal(noConfirmation.statusCode, 409)
    assert.equal(noConfirmation.body.usersAffected, 1)
    assert.equal(users.get(basicId).roleKey, 'copom')

    const confirmed = response()
    await controller.updateRole(
        request({ active: false, confirmReassign: true }, { id: roles.get('copom')._id }),
        confirmed
    )
    assert.equal(confirmed.statusCode, 200)
    assert.equal(users.get(basicId).roleKey, 'basico')
    assert.equal(roles.get('copom').active, false)

    const basicDeactivation = response()
    await controller.updateRole(
        request({ active: false }, { id: roles.get('basico')._id }),
        basicDeactivation
    )
    assert.equal(basicDeactivation.statusCode, 409)
})

test('uses current role permissions on every check and protects the last active administrator', async () => {
    roles.set('custom', makeRole({ key: 'custom', name: 'Custom', active: true, permissions: ['roles.view'] }))
    users.get(basicId).roleKey = 'custom'
    assert.deepEqual((await getEffectiveAccess(basicId)).permissions, ['roles.view'])

    const middleware = requirePermission('roles.manage')
    const denied = response()
    await middleware({ user: { userId: basicId } }, denied, () => assert.fail('permission should be denied'))
    assert.equal(denied.statusCode, 403)

    roles.get('custom').permissions = ['roles.manage']
    const allowed = response()
    let passed = false
    await middleware({ user: { userId: basicId } }, allowed, () => { passed = true })
    assert.equal(passed, true)

    const adminRole = roles.get('administrador')
    const revokeLastAdmin = response()
    await controller.updateRole(
        request({ permissions: ['dashboard.view'] }, { id: adminRole._id }),
        revokeLastAdmin
    )
    assert.equal(revokeLastAdmin.statusCode, 409)

    const disableLastAdmin = response()
    await controller.setUserStatus(request({ active: false }, { id: adminId }), disableLastAdmin)
    assert.equal(disableLastAdmin.statusCode, 409)
})

test('prevents a role manager from granting permissions to their own role or assigning themselves another role', async () => {
    const basicRole = roles.get('basico')
    basicRole.permissions = ['roles.manage']

    const selfUpdate = response()
    await controller.updateRole(
        request({ permissions: ['roles.manage', 'users.manage'] }, { id: basicRole._id }, basicId),
        selfUpdate
    )
    assert.equal(selfUpdate.statusCode, 403)
    assert.deepEqual(basicRole.permissions, ['roles.manage'])

    roles.set('copom', makeRole({
        key: 'copom',
        name: 'COPOM',
        active: true,
        permissions: ['dashboard.view']
    }))
    const selfAssignment = response()
    await controller.assignUserRole(
        request({ roleKey: 'copom' }, { id: basicId }, basicId),
        selfAssignment
    )
    assert.equal(selfAssignment.statusCode, 403)
    assert.equal(users.get(basicId).roleKey, 'basico')
})

test('preserves legacy accounts without an explicit status while rejecting explicitly inactive accounts', () => {
    assert.equal(isAccountActive({}), true)
    assert.equal(isAccountActive({ isAtivo: 'true' }), true)
    assert.equal(isAccountActive({ isAtivo: 'false' }), false)
    assert.equal(isAccountActive({ isAtivo: false }), false)
})

test('uses the assigned role instead of legacy tipo when identifying administrators', () => {
    assert.equal(isAdministratorUser({ roleKey: 'basico', tipo: 'admin' }), false)
    assert.equal(isAdministratorUser({ roleKey: 'administrador', tipo: 'comum' }), true)
    assert.equal(isAdministratorUser({ tipo: 'admin' }), true)
})

test('requires email confirmation before an administrator activates a new account', async () => {
    const target = users.get(basicId)
    target.emailConfirmationTokenHash = 'pending-confirmation'
    target.accessPending = true
    const pendingApproval = response()
    await controller.setUserStatus(request({ active: true }, { id: basicId }), pendingApproval)
    assert.equal(pendingApproval.statusCode, 409)
    assert.equal(target.isAtivo, 'true')

    delete target.emailConfirmationTokenHash
    target.isAtivo = 'false'
    const approved = response()
    await controller.setUserStatus(request({ active: true }, { id: basicId }), approved)
    assert.equal(approved.statusCode, 200)
    assert.equal(target.isAtivo, 'true')
    assert.equal(target.accessPending, false)
})
