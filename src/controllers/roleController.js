const mongoose = require('mongoose')
const User = require('../model/user')
const { permissionCatalog, initialRoles } = require('../utils/permissionCatalog')
const { getEffectiveAccess, isAdministratorUser } = require('../utils/authorization')

const permissionIds = new Set(permissionCatalog.map(permission => permission.id))
const roleModel = () => require('../model/role')
const auditModel = () => require('../model/adminAuditLog')

function normalizedName(name) {
    return name.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .trim().toLowerCase().replace(/\s+/g, ' ')
}

function roleKey(name) {
    return normalizedName(name).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

function validatePermissions(value) {
    return Array.isArray(value) &&
        new Set(value).size === value.length &&
        value.every(permission => typeof permission === 'string' && permissionIds.has(permission))
}

async function writeAudit(req, action, targetType, targetId, details = {}) {
    await auditModel().create({
        actorId: String(req.user.userId),
        action,
        targetType,
        targetId: String(targetId),
        details
    })
}

async function activeAdministratorCount() {
    return User.countDocuments({
        $and: [
            { $or: [{ roleKey: 'administrador' }, { roleKey: { $in: [null, ''] }, tipo: 'admin' }] },
            { isAtivo: { $nin: [false, 'false'] } }
        ]
    })
}

exports.listRoles = async (req, res) => {
    try {
        const [roles, counts] = await Promise.all([
            roleModel().find().sort({ name: 1 }).lean(),
            User.aggregate([
                { $match: { roleKey: { $type: 'string' } } },
                { $group: { _id: '$roleKey', count: { $sum: 1 } } }
            ])
        ])
        const countByKey = new Map(counts.map(item => [item._id, item.count]))
        return res.status(200).json({
            roles: roles.map(role => ({ ...role, userCount: countByKey.get(role.key) || 0 })),
            permissions: permissionCatalog
        })
    } catch (error) {
        console.error('Erro ao listar roles:', error)
        return res.status(500).json({ message: 'Não foi possível carregar as roles.' })
    }
}

exports.createRole = async (req, res) => {
    const { name, description = '', permissions = [] } = req.body || {}
    if (typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 80 ||
        typeof description !== 'string' || description.length > 500 ||
        !validatePermissions(permissions)) {
        return res.status(400).json({ message: 'Informe nome, descrição e permissões válidos.' })
    }
    const key = roleKey(name)
    if (!key) return res.status(400).json({ message: 'O nome da role não permite criar um identificador válido.' })
    try {
        const role = await roleModel().create({
            key,
            name: name.trim(),
            normalizedName: normalizedName(name),
            description: description.trim(),
            permissions,
            active: true,
            createdBy: String(req.user.userId),
            updatedBy: String(req.user.userId)
        })
        await writeAudit(req, 'role.created', 'role', role._id, { key, permissions })
        return res.status(201).json({ role, message: 'Role criada.' })
    } catch (error) {
        if (error.code === 11000) return res.status(409).json({ message: 'Já existe uma role com esse nome ou identificador.' })
        console.error('Erro ao criar role:', error)
        return res.status(500).json({ message: 'Não foi possível criar a role.' })
    }
}

exports.updateRole = async (req, res) => {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
        return res.status(400).json({ message: 'Identificador de role inválido.' })
    }
    const { name, description, permissions, active, confirmReassign } = req.body || {}
    if ((name !== undefined && (typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 80)) ||
        (description !== undefined && (typeof description !== 'string' || description.length > 500)) ||
        (permissions !== undefined && !validatePermissions(permissions)) ||
        (active !== undefined && typeof active !== 'boolean') ||
        (confirmReassign !== undefined && typeof confirmReassign !== 'boolean')) {
        return res.status(400).json({ message: 'Dados da role inválidos.' })
    }
    try {
        const role = await roleModel().findById(req.params.id)
        if (!role) return res.status(404).json({ message: 'Role não encontrada.' })
        const previousPermissions = role.permissions || []
        const actorAccess = req.access || await getEffectiveAccess(req.user.userId)
        if (!actorAccess) return res.status(401).json({ message: 'Conta inexistente ou desativada.' })
        const actorRoleKey = actorAccess.role?.key || actorAccess.user.roleKey ||
            (actorAccess.user.tipo === 'admin' ? 'administrador' : 'basico')
        if (role.key === actorRoleKey && permissions &&
            permissions.some(permission => !actorAccess.permissions.includes(permission))) {
            return res.status(403).json({ message: 'Você não pode conceder novas permissões à role atribuída à sua própria conta.' })
        }
        if (active === false && role.key === 'basico') {
            return res.status(409).json({ message: 'A role Básico é necessária para preservar o acesso legado e não pode ser desativada.' })
        }
        if (active === false && role.key === 'administrador' &&
            (await activeAdministratorCount()) > 0) {
            return res.status(409).json({ message: 'A role Administrador não pode ser desativada enquanto houver administradores ativos.' })
        }
        if (role.key === 'administrador' && permissions &&
            (!permissions.includes('roles.manage') || !permissions.includes('users.manage')) &&
            (await activeAdministratorCount()) > 0) {
            return res.status(409).json({ message: 'Não é possível remover as permissões administrativas enquanto houver administradores ativos.' })
        }

        const assignedCount = await User.countDocuments({ roleKey: role.key })
        if (active === false && assignedCount > 0) {
            if (!confirmReassign) {
                return res.status(409).json({
                    message: `Esta role está atribuída a ${assignedCount} usuário(s). Confirme para transferi-los para Básico.`,
                    usersAffected: assignedCount,
                    requiresConfirmation: true
                })
            }
            const basicRole = await roleModel().findOne({ key: 'basico', active: true })
            if (!basicRole) return res.status(409).json({ message: 'A role Básico ativa é necessária para reatribuição segura.' })
            await User.updateMany({ roleKey: role.key }, { $set: { roleKey: basicRole.key } })
            await writeAudit(req, 'users.role.reassigned', 'role', role._id, {
                previousRoleKey: role.key,
                roleKey: basicRole.key,
                count: assignedCount
            })
        }

        if (name !== undefined) {
            role.name = name.trim()
            role.normalizedName = normalizedName(name)
        }
        if (description !== undefined) role.description = description.trim()
        if (permissions !== undefined) role.permissions = permissions
        if (active !== undefined) role.active = active
        role.updatedBy = String(req.user.userId)
        await role.save()
        await writeAudit(req, 'role.updated', 'role', role._id, {
            changed: {
                name: name !== undefined,
                description: description !== undefined,
                permissions: permissions !== undefined,
                active: active !== undefined
            },
            removedPermissions: previousPermissions.filter(item => !(role.permissions || []).includes(item))
        })
        return res.status(200).json({ role, message: 'Role atualizada.' })
    } catch (error) {
        if (error.code === 11000) return res.status(409).json({ message: 'Já existe uma role com esse nome.' })
        console.error('Erro ao atualizar role:', error)
        return res.status(500).json({ message: 'Não foi possível atualizar a role.' })
    }
}

exports.assignUserRole = async (req, res) => {
    const { roleKey: requestedRoleKey } = req.body || {}
    if (!mongoose.Types.ObjectId.isValid(req.params.id) ||
        typeof requestedRoleKey !== 'string' || !requestedRoleKey.trim()) {
        return res.status(400).json({ message: 'Usuário e role são obrigatórios.' })
    }
    try {
        const [target, role] = await Promise.all([
            User.findById(req.params.id),
            roleModel().findOne({ key: requestedRoleKey.trim(), active: true })
        ])
        if (!target) return res.status(404).json({ message: 'Usuário não encontrado.' })
        if (String(target._id) === String(req.user.userId)) {
            return res.status(403).json({ message: 'Você não pode alterar a role da própria conta.' })
        }
        if (!role) return res.status(400).json({ message: 'Role inexistente ou inativa.' })
        if (isAdministratorUser(target) &&
            role.key !== 'administrador' &&
            (await activeAdministratorCount()) <= 1) {
            return res.status(409).json({ message: 'Não é possível remover a role do último administrador ativo.' })
        }
        const previousRoleKey = target.roleKey || (target.tipo === 'admin' ? 'administrador' : 'basico')
        target.roleKey = role.key
        await target.save()
        await writeAudit(req, 'user.role.changed', 'user', target._id, { previousRoleKey, roleKey: role.key })
        return res.status(200).json({
            message: 'Role do usuário atualizada.',
            user: { _id: String(target._id), roleKey: role.key, permissions: role.permissions }
        })
    } catch (error) {
        console.error('Erro ao atribuir role:', error)
        return res.status(500).json({ message: 'Não foi possível atribuir a role.' })
    }
}

exports.setUserStatus = async (req, res) => {
    const { active } = req.body || {}
    if (!mongoose.Types.ObjectId.isValid(req.params.id) || typeof active !== 'boolean') {
        return res.status(400).json({ message: 'Usuário e status válido são obrigatórios.' })
    }
    try {
        const target = await User.findById(req.params.id)
        if (!target) return res.status(404).json({ message: 'Usuário não encontrado.' })
        if (active && target.emailConfirmationTokenHash) {
            return res.status(409).json({ message: 'O usuário precisa confirmar o e-mail antes da liberação do acesso.' })
        }
        if (!active && isAdministratorUser(target) &&
            (await activeAdministratorCount()) <= 1) {
            return res.status(409).json({ message: 'Não é possível desativar a última conta administrativa ativa.' })
        }
        const previousActive = target.isAtivo
        target.isAtivo = String(active)
        target.accessPending = false
        await target.save()
        await writeAudit(req, active ? 'user.activated' : 'user.deactivated', 'user', target._id, {
            previousActive,
            active
        })
        return res.status(200).json({ message: active ? 'Conta ativada.' : 'Conta desativada.' })
    } catch (error) {
        console.error('Erro ao alterar status do usuário:', error)
        return res.status(500).json({ message: 'Não foi possível alterar o status da conta.' })
    }
}

exports.currentAccess = async (req, res) => {
    try {
        const access = await getEffectiveAccess(req.user.userId)
        if (!access) return res.status(401).json({ message: 'Conta inexistente ou desativada.' })
        const roleKey = access.role
            ? access.role.key
            : access.user.roleKey || (access.user.tipo === 'admin' ? 'administrador' : 'basico')
        return res.status(200).json({ roleKey, permissions: access.permissions })
    } catch (error) {
        console.error('Erro ao consultar permissões efetivas:', error)
        return res.status(500).json({ message: 'Não foi possível consultar as permissões efetivas.' })
    }
}

exports.seedInitialRoles = async function seedInitialRoles() {
    for (const role of initialRoles) {
        await roleModel().updateOne(
            { key: role.key },
            {
                $setOnInsert: {
                    ...role,
                    normalizedName: normalizedName(role.name),
                    active: true,
                    system: true
                }
            },
            { upsert: true }
        )
    }
}
