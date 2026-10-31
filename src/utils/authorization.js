const User = require('../model/user')
const { BASIC_PERMISSIONS, LEGACY_ADMIN_PERMISSIONS } = require('./permissionCatalog')

function isAccountActive(user) {
    return user && user.isAtivo !== false && user.isAtivo !== 'false'
}

function isAdministratorUser(user) {
    return Boolean(user && (user.roleKey ? user.roleKey === 'administrador' : user.tipo === 'admin'))
}

function expandPermissions(permissions = []) {
    const effective = new Set(permissions)
    if (effective.has('naturezas.manage')) effective.add('localidades.manage')
    if (effective.has('users.manage')) effective.add('users.view')
    if (effective.has('users.manage')) effective.add('roles.view')
    if (effective.has('roles.manage')) effective.add('roles.view')
    return [...effective]
}

function isUserInIncidentReportEffective(user, report) {
    if (!user || !report || !Array.isArray(report.efetivo)) return false
    const identifiers = new Set([
        user.userMatriculaId,
        user.userBarra,
        user.userNumero
    ].filter(value => typeof value === 'string' && value.trim()).map(value => value.trim()))
    if (!identifiers.size) return false
    return report.efetivo.some(policial =>
        [policial.id, policial.numeroBarra].some(value =>
            typeof value === 'string' && identifiers.has(value.trim())
        )
    )
}

async function getEffectiveAccess(userId) {
    const userQuery = User.findById(userId)
    const user = userQuery && typeof userQuery.lean === 'function'
        ? await userQuery.lean()
        : await userQuery
    if (!user || !isAccountActive(user)) return null

    if (user.roleKey) {
        const Role = require('../model/role')
        const role = await Role.findOne({ key: user.roleKey, active: true })
        if (!role) return { user, role: null, permissions: [] }
        return { user, role, permissions: expandPermissions(role.permissions || []) }
    }

    if (user.tipo === 'admin') {
        return {
            user,
            role: null,
            permissions: expandPermissions(LEGACY_ADMIN_PERMISSIONS)
        }
    }
    return { user, role: null, permissions: expandPermissions(BASIC_PERMISSIONS) }
}

function requirePermission(permission) {
    return requireAnyPermission([permission])
}

function requireAnyPermission(permissions) {
    return async (req, res, next) => {
        try {
            const userId = req.user && req.user.userId
            if (!userId) return res.status(401).json({ message: 'Faça login novamente para continuar.' })
            const access = await getEffectiveAccess(userId)
            if (!access) return res.status(401).json({ message: 'Conta inexistente ou desativada.' })
            if (!permissions.some(permission => access.permissions.includes(permission))) {
                return res.status(403).json({ message: 'Você não possui permissão para esta operação.' })
            }
            req.access = access
            return next()
        } catch (error) {
            console.error('Erro ao verificar permissões:', error)
            return res.status(500).json({ message: 'Não foi possível verificar as permissões da conta.' })
        }
    }
}

async function protectLastAdministratorRemoval(req, res, next) {
    try {
        const target = await User.findById(req.params.id)
        if (!isAdministratorUser(target)) {
            return next()
        }
        const activeAdministrators = await User.countDocuments({
            $and: [
                { $or: [{ roleKey: 'administrador' }, { roleKey: { $in: [null, ''] }, tipo: 'admin' }] },
                { isAtivo: { $nin: [false, 'false'] } }
            ]
        })
        if (activeAdministrators <= 1) {
            return res.status(409).json({ message: 'A última conta administrativa não pode ser removida; desative ou reatribua outras contas primeiro.' })
        }
        return next()
    } catch (error) {
        console.error('Erro ao verificar remoção do administrador:', error)
        return res.status(500).json({ message: 'Não foi possível validar a operação administrativa.' })
    }
}

module.exports = {
    getEffectiveAccess,
    isAccountActive,
    isAdministratorUser,
    requirePermission,
    requireAnyPermission,
    protectLastAdministratorRemoval,
    isUserInIncidentReportEffective
}
