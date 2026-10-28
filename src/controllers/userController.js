//controller de usuarios

const user = require('../model/user')
const roleModel = () => require('../model/role')
const mongoose = require('mongoose')
const bcrypt = require('bcryptjs')
const incidentReport = require('../model/boletim')
const { getEffectiveAccess } = require('../utils/authorization')

//list all users on db
exports.usersList = async (req, res)=>{
    try{
        const usersList = await user.find()
            .select('-userPassword -passwordResetTokenHash -emailConfirmationTokenHash')
            .lean()
        const normalizedUsers = usersList.map(item => ({
            ...(item.toObject ? item.toObject() : item),
            roleKey: item.roleKey || (item.tipo === 'admin' ? 'administrador' : 'basico'),
            emailConfirmed: !item.emailConfirmationTokenHash,
            accessPending: Boolean(item.accessPending)
        }))
        return res.status(200).json(normalizedUsers)
    }catch(err){
        return res.status(500).json({message: "Erro ao buscar usuários."})
    }
}

//create user on db
exports.userCreate = async (req, res) =>{
    if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
        return res.status(400).json({message: "Informe os dados do usuário."})
    }
    const { userName, userEmail, userPassword } = req.body
    if (typeof userName !== 'string' || !userName.trim() ||
        typeof userEmail !== 'string' || !userEmail.trim() ||
        typeof userPassword !== 'string' || !userPassword) {
        return res.status(400).json({message: "Nome, e-mail e senha são obrigatórios."})
    }
    try{
        const allowedFields = [
            'userName',
            'userEmail',
            'userContato',
            'userMatriculaId',
            'userGraduacao',
            'userNumero',
            'userBarra',
            'tipo'
        ]
        const newUser = Object.fromEntries(
            Object.entries(req.body).filter(([key]) => allowedFields.includes(key))
        )
        newUser.userEmail = userEmail.toLowerCase().trim()
        newUser.userName = userName.trim()
        const roleKey = typeof req.body.roleKey === 'string' && req.body.roleKey.trim()
            ? req.body.roleKey.trim()
            : 'basico'
        const role = await roleModel().findOne({ key: roleKey, active: true })
        if (!role) {
            return res.status(400).json({ message: 'Selecione uma role existente e ativa.' })
        }
        newUser.roleKey = role.key
        newUser.tipo = role.key === 'administrador' ? 'admin' : 'comum'
        newUser.isAtivo = 'true'
        newUser.userPassword = await bcrypt.hash(userPassword, 10)
        await user.create(newUser)
        return res.status(201).json({message: "Usuário criado com sucesso."})
    }catch(err){
        if (err.code === 11000 || err.name === 'ValidationError') {
            return res.status(400).json({message: "Dados inválidos ou usuário já cadastrado."})
        }
        return res.status(500).json({message: "Erro ao criar usuário."})
    }

}

exports.currentUser = async (req, res) => {
    if (!req.user || !req.user.userId) {
        return res.status(401).json({ message: 'Faça login novamente para acessar seu perfil.' })
    }
    try {
        const currentUser = await user.findById(req.user.userId)
            .select('-userPassword -passwordResetTokenHash -emailConfirmationTokenHash')
        if (!currentUser) return res.status(404).json({ message: 'Usuário não encontrado.' })
        return res.status(200).json(currentUser)
    } catch (err) {
        return res.status(500).json({ message: 'Erro ao carregar o perfil.' })
    }
}

exports.currentUserIncidentReports = async (req, res) => {
    if (!req.user || !req.user.userId) {
        return res.status(401).json({ message: 'Faça login novamente para acessar seus boletins.' })
    }

    const page = req.query.page === undefined ? 1 : Number(req.query.page)
    const limit = req.query.limit === undefined ? 10 : Number(req.query.limit)
    if (!Number.isSafeInteger(page) || page < 1 ||
        !Number.isSafeInteger(limit) || limit !== 10 ||
        !Number.isSafeInteger((page - 1) * limit)) {
        return res.status(400).json({ message: 'A paginação deve usar página positiva e limite igual a 10.' })
    }

    const { numero, dataInicio, dataFim, municipio, natureza, bairro } = req.query
    const filters = {}
    if (numero !== undefined) {
        const value = String(numero).trim()
        if (!value || value.length > 50) {
            return res.status(400).json({ message: 'O número do boletim deve ter entre 1 e 50 caracteres.' })
        }
        filters.numero = { $regex: escapeRegex(value), $options: 'i' }
    }
    if (municipio !== undefined) {
        const value = String(municipio).trim()
        if (value.length > 100) return res.status(400).json({ message: 'O município deve ter até 100 caracteres.' })
        if (value) filters.municipio = { $regex: escapeRegex(value), $options: 'i' }
    }
    if (natureza !== undefined) {
        const value = String(natureza).trim()
        if (value.length > 120) return res.status(400).json({ message: 'A natureza deve ter até 120 caracteres.' })
        if (value) filters.natureza = { $regex: escapeRegex(value), $options: 'i' }
    }
    if (bairro !== undefined) {
        const value = String(bairro).trim()
        if (value.length > 100) return res.status(400).json({ message: 'O bairro deve ter até 100 caracteres.' })
        if (value) filters.bairro = { $regex: escapeRegex(value), $options: 'i' }
    }

    const parsedDateStart = parseIsoDate(dataInicio)
    const parsedDateEnd = parseIsoDate(dataFim)
    if (dataInicio !== undefined && !parsedDateStart) {
        return res.status(400).json({ message: 'A data inicial deve ser válida e usar o formato AAAA-MM-DD.' })
    }
    if (dataFim !== undefined && !parsedDateEnd) {
        return res.status(400).json({ message: 'A data final deve ser válida e usar o formato AAAA-MM-DD.' })
    }
    if (parsedDateStart && parsedDateEnd && parsedDateStart > parsedDateEnd) {
        return res.status(400).json({ message: 'A data inicial não pode ser posterior à data final.' })
    }

    try {
        const access = req.access || await getEffectiveAccess(req.user.userId)
        if (!access) return res.status(401).json({ message: 'Conta inexistente ou desativada.' })
        const currentUser = access.user
        if (!currentUser) return res.status(404).json({ message: 'Usuário não encontrado.' })

        const identifiers = [...new Set([
            currentUser.userMatriculaId,
            currentUser.userBarra,
            currentUser.userNumero
        ].filter(value => typeof value === 'string' && value.trim()).map(value => value.trim()))]
        if (!identifiers.length) {
            return res.status(200).json({ reports: [], page, limit, hasMore: false, total: 0 })
        }
        const participantConditions = identifiers.flatMap(value => [
            { 'efetivo.id': value },
            { 'efetivo.numeroBarra': value }
        ])
        const match = {
            $and: [
                { $or: participantConditions },
                ...Object.entries(filters).map(([field, value]) => ({ [field]: value }))
            ]
        }
        const dateRange = {}
        if (parsedDateStart) dateRange.$gte = parsedDateStart
        if (parsedDateEnd) {
            const exclusiveEnd = new Date(parsedDateEnd)
            exclusiveEnd.setUTCDate(exclusiveEnd.getUTCDate() + 1)
            dateRange.$lt = exclusiveEnd
        }
        const pipeline = [
            { $match: match },
            { $sort: { createdAt: -1, _id: -1 } },
            {
                $addFields: {
                    _profileReportDate: {
                        $dateFromString: {
                            dateString: '$data',
                            format: '%d/%m/%Y',
                            onError: {
                                $dateFromString: {
                                    dateString: '$data',
                                    onError: null,
                                    onNull: null
                                }
                            },
                            onNull: null
                        }
                    }
                }
            },
            ...(Object.keys(dateRange).length
                ? [{ $match: { _profileReportDate: dateRange } }]
                : []),
            {
                $facet: {
                    reports: [
                        { $skip: (page - 1) * limit },
                        { $limit: limit + 1 },
                        {
                            $project: {
                                numero: 1,
                                natureza: 1,
                                data: 1,
                                horario: 1,
                                municipio: 1,
                                bairro: 1,
                                endereco: 1,
                                numeroEndereco: 1,
                                createdAt: 1,
                                creatorId: 1,
                                isCreator: { $eq: ['$creatorId', String(req.user.userId)] }
                            }
                        }
                    ],
                    metadata: [{ $count: 'total' }]
                }
            }
        ]
        const [result = { reports: [], metadata: [] }] = await incidentReport.aggregate(pipeline).allowDiskUse(true)
        const hasMore = result.reports.length > limit
        return res.status(200).json({
            reports: result.reports.slice(0, limit),
            page,
            limit,
            hasMore,
            total: result.metadata[0]?.total || 0
        })
    } catch (err) {
        console.error('Erro ao buscar boletins do usuário:', err)
        return res.status(500).json({ message: 'Não foi possível carregar seus boletins.' })
    }
}

function escapeRegex(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function parseIsoDate(value) {
    if (value === undefined) return null
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
    const date = new Date(`${value}T00:00:00.000Z`)
    return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value
        ? null
        : date
}

exports.updateCurrentUser = async (req, res) => {
    if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
        return res.status(400).json({ message: 'Informe os dados para atualização.' })
    }
    const fields = ['userName', 'userEmail', 'userContato', 'userMatriculaId', 'userGraduacao', 'userBarra']
    const updates = Object.fromEntries(Object.entries(req.body).filter(([key]) => fields.includes(key)))
    if (!Object.keys(updates).length) {
        return res.status(400).json({ message: 'Nenhum campo de perfil permitido foi informado.' })
    }
    if (updates.userEmail !== undefined) {
        if (typeof updates.userEmail !== 'string' || !updates.userEmail.trim()) {
            return res.status(400).json({ message: 'Informe um e-mail válido.' })
        }
        updates.userEmail = updates.userEmail.trim().toLowerCase()
    }
    if (updates.userName !== undefined) {
        if (typeof updates.userName !== 'string' || !updates.userName.trim()) {
            return res.status(400).json({ message: 'Informe o nome do usuário.' })
        }
        updates.userName = updates.userName.trim()
    }
    try {
        const updated = await user.findByIdAndUpdate(
            req.user.userId,
            { $set: updates },
            { new: true, runValidators: true }
        ).select('-userPassword -passwordResetTokenHash -emailConfirmationTokenHash')
        if (!updated) return res.status(404).json({ message: 'Usuário não encontrado.' })
        return res.status(200).json({ message: 'Perfil atualizado com sucesso.', user: updated })
    } catch (err) {
        if (err.name === 'ValidationError' || err.code === 11000) {
            return res.status(400).json({ message: 'E-mail inválido ou já cadastrado.' })
        }
        return res.status(500).json({ message: 'Erro ao atualizar o perfil.' })
    }
}

exports.updatePassword = async (req, res) => {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
        return res.status(400).json({ message: 'ID de usuário inválido.' })
    }
    const { userPassword } = req.body || {}
    if (typeof userPassword !== 'string' || userPassword.length < 8) {
        return res.status(400).json({ message: 'A senha deve ter ao menos 8 caracteres.' })
    }
    try {
        const updated = await user.findByIdAndUpdate(
            req.params.id,
            { $set: { userPassword: await bcrypt.hash(userPassword, 12) } },
            { new: true }
        )
        if (!updated) return res.status(404).json({ message: 'Usuário não encontrado.' })
        return res.status(200).json({ message: 'Senha atualizada com sucesso.' })
    } catch (err) {
        return res.status(500).json({ message: 'Erro ao atualizar a senha.' })
    }
}

//delete user on db
exports.userDelete = async (req, res) =>{
    const {id} = req.params
    if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({message: "ID de usuário inválido."})
    }
    try{
        const deletedUser = await user.findByIdAndDelete(id)
        if (!deletedUser) {
            return res.status(404).json({message: "Usuário não encontrado."})
        }
        return res.status(200).json({message:"Usuário excluído com sucesso."})
    }catch(err){
        return res.status(500).json({message: "Erro ao excluir usuário."})
    }
}

//update user on db
exports.userUpdate = async (req, res) =>{
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
        return res.status(400).json({message: "ID de usuário inválido."})
    }
    if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
        return res.status(400).json({message: "Informe os dados para atualização."})
    }
    const editableFields = [
        'userName',
        'userEmail',
        'userContato',
        'userMatriculaId',
        'userGraduacao',
        'userBarra',
        'userNumero'
    ]
    const updates = Object.fromEntries(
        Object.entries(req.body).filter(([key]) => editableFields.includes(key))
    )
    if (!Object.keys(updates).length) {
        return res.status(400).json({message: "Nenhum campo permitido para atualização foi informado."})
    }
    try{
        const result  = await user.updateOne(
            {_id : req.params.id},
            { $set :updates},
            { runValidators: true }
        )
        if (!result.matchedCount) {
            return res.status(404).json({message: "Usuário não encontrado."})
        }
        return res.status(200).json({message: "Dados atualizados com sucesso."})
    }catch(err){
        if (err.name === 'ValidationError' || err.code === 11000) {
            return res.status(400).json({message: "Dados inválidos ou e-mail já cadastrado."})
        }
        return res.status(500).json({message: "Erro ao atualizar usuário."})
    }
    
}

//find user by matricula id
exports.findUserByMatriculaId = async (req, res)=>{
    try {
        const matchingUsers = await user.find({userMatriculaId:req.params.id})
            .select('-userPassword -passwordResetTokenHash -emailConfirmationTokenHash')
        if (!matchingUsers.length) {
            return res.status(404).json({message: "Usuário não encontrado."})
        }
        return res.status(200).json(matchingUsers)
    } catch (err) {
        return res.status(500).json({message: "Erro ao buscar usuário."})
    }
}