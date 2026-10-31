const Natureza = require('../model/natureza')
const Boletim = require('../model/boletim')
const { normalizarNatureza, escapeRegex } = require('../utils/natureza')
const { getEffectiveAccess } = require('../utils/authorization')

function isValidNatureId(value) {
    return typeof value === 'string' && /^[0-9a-fA-F]{24}$/.test(value)
}

function validarCampos(body, parcial = false) {
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
        return 'Envie os dados da natureza em um objeto.'
    }
    const camposNaoPermitidos = Object.keys(body).filter(campo => !['nome', 'ativo'].includes(campo))
    if (camposNaoPermitidos.length) return 'A natureza aceita somente nome e status ativo.'
    if (!parcial || Object.prototype.hasOwnProperty.call(body, 'nome')) {
        if (typeof body.nome !== 'string' || !body.nome.trim() || body.nome.trim().length > 500) {
            return 'Informe um nome oficial de até 500 caracteres.'
        }
        if (!normalizarNatureza(body.nome)) return 'Informe um nome oficial válido.'
    }
    if (Object.prototype.hasOwnProperty.call(body, 'ativo') && typeof body.ativo !== 'boolean') {
        return 'O status ativo deve ser booleano.'
    }
    return null
}

function mapearErro(error, res, acao) {
    if (error && error.code === 11000) {
        return res.status(409).json({ message: 'Já existe uma natureza com esse nome normalizado.' })
    }
    console.error(`Erro ao ${acao} natureza:`, error)
    return res.status(500).json({ message: `Erro ao ${acao} natureza.` })
}

function filtroSemNaturezaCatalogada() {
    return {
        naturezaId: null,
        $or: [
            { naturezaIds: { $exists: false } },
            { naturezaIds: { $size: 0 } }
        ]
    }
}

exports.listar = async (req, res) => {
    try {
        const access = await getEffectiveAccess(req.user.userId)
        if (!access) return res.status(401).json({ message: 'Conta inexistente ou desativada.' })
        const canManage = access.permissions.includes('naturezas.manage')
        const query = {}
        const incluirInativas = req.query.incluirInativas === 'true'
        if (incluirInativas && !canManage) {
            return res.status(403).json({ message: 'Acesso restrito a administradores.' })
        }
        if (!incluirInativas) query.ativo = true

        if (req.query.q !== undefined) {
            const termo = normalizarNatureza(String(req.query.q))
            if (termo.length > 100) return res.status(400).json({ message: 'A pesquisa deve ter até 100 caracteres.' })
            if (termo) query.normalizado = { $regex: escapeRegex(termo) }
        }

        const naturezas = await Natureza.find(query).sort({ nome: 1 }).lean()
        if (!canManage) {
            return res.status(200).json({ items: naturezas })
        }
        const items = await Promise.all(naturezas.map(async natureza => ({
            ...natureza,
            ocorrencias: await Boletim.countDocuments({
                $or: [
                    { naturezaId: natureza._id },
                    { naturezaIds: natureza._id }
                ]
            })
        })))
        const semNatureza = filtroSemNaturezaCatalogada()
        const pendentes = await Boletim.countDocuments(semNatureza)
        const grafiasPendentes = await Boletim.aggregate([
            { $match: semNatureza },
            {
                $group: {
                    _id: { $ifNull: ['$natureza', ''] },
                    ocorrencias: { $sum: 1 }
                }
            },
            { $sort: { ocorrencias: -1, _id: 1 } },
            { $project: { _id: 0, natureza: '$_id', ocorrencias: 1 } }
        ])
        return res.status(200).json({ items, pendentes, grafiasPendentes })
    } catch (error) {
        return mapearErro(error, res, 'listar')
    }
}

exports.consultar = async (req, res) => {
    if (!isValidNatureId(req.params.id)) {
        return res.status(400).json({ message: 'Identificador de natureza inválido.' })
    }
    try {
        const natureza = await Natureza.findById(req.params.id)
        if (!natureza) return res.status(404).json({ message: 'Natureza não encontrada.' })
        const access = await getEffectiveAccess(req.user.userId)
        if (!access) return res.status(401).json({ message: 'Conta inexistente ou desativada.' })
        if (!natureza.ativo && !access.permissions.includes('naturezas.manage')) {
            return res.status(404).json({ message: 'Natureza não encontrada.' })
        }
        return res.status(200).json(natureza)
    } catch (error) {
        return mapearErro(error, res, 'consultar')
    }
}

exports.criar = async (req, res) => {
    const erro = validarCampos(req.body)
    if (erro) return res.status(400).json({ message: erro })
    try {
        const normalizado = normalizarNatureza(req.body.nome)
        if (await Natureza.exists({ normalizado })) {
            return res.status(409).json({ message: 'Já existe uma natureza com esse nome normalizado.' })
        }
        const natureza = await Natureza.create({
            nome: req.body.nome,
            ativo: req.body.ativo === undefined ? true : req.body.ativo
        })
        return res.status(201).json(natureza)
    } catch (error) {
        if (error.name === 'ValidationError') return res.status(400).json({ message: error.message })
        return mapearErro(error, res, 'criar')
    }
}

exports.editar = async (req, res) => {
    if (!isValidNatureId(req.params.id)) {
        return res.status(400).json({ message: 'Identificador de natureza inválido.' })
    }
    const erro = validarCampos(req.body, true)
    if (erro) return res.status(400).json({ message: erro })
    if (Object.prototype.hasOwnProperty.call(req.body, 'ativo')) {
        return res.status(400).json({ message: 'Use o endpoint /:id/status para alterar o status.' })
    }
    const permitidos = ['nome']
    const alteracoes = {}
    permitidos.forEach(campo => {
        if (Object.prototype.hasOwnProperty.call(req.body, campo)) alteracoes[campo] = req.body[campo]
    })
    if (!Object.keys(alteracoes).length) {
        return res.status(400).json({ message: 'Informe ao menos um campo para atualizar.' })
    }
    try {
        const natureza = await Natureza.findById(req.params.id)
        if (!natureza) return res.status(404).json({ message: 'Natureza não encontrada.' })
        if (Object.prototype.hasOwnProperty.call(alteracoes, 'nome')) {
            const normalizado = normalizarNatureza(alteracoes.nome)
            if (await Natureza.exists({ normalizado, _id: { $ne: natureza._id } })) {
                return res.status(409).json({ message: 'Já existe uma natureza com esse nome normalizado.' })
            }
        }
        Object.assign(natureza, alteracoes)
        const erroCombinado = validarCampos({ nome: natureza.nome })
        if (erroCombinado) return res.status(400).json({ message: erroCombinado })
        await natureza.save()
        if (Object.prototype.hasOwnProperty.call(alteracoes, 'nome')) {
            const boletins = await Boletim.find({
                $or: [
                    { naturezaId: natureza._id },
                    { naturezaIds: natureza._id }
                ]
            }).select('_id natureza naturezaId naturezaIds naturezaOriginal').lean()
            const idsRelacionados = new Set()
            boletins.forEach(boletim => {
                (boletim.naturezaIds || []).forEach(id => idsRelacionados.add(id.toString()))
                if (boletim.naturezaId) idsRelacionados.add(boletim.naturezaId.toString())
            })
            const catalogo = await Natureza.find({ _id: { $in: Array.from(idsRelacionados) } })
                .select('_id nome').lean()
            const nomesPorId = new Map(catalogo.map(item => [item._id.toString(), item.nome]))
            const atualizacoes = boletins.map(boletim => {
                const ids = (boletim.naturezaIds && boletim.naturezaIds.length
                    ? boletim.naturezaIds
                    : boletim.naturezaId ? [boletim.naturezaId] : [])
                const nomes = ids.map(id => nomesPorId.get(id.toString())).filter(Boolean)
                return {
                    updateOne: {
                        filter: { _id: boletim._id },
                        update: {
                            $set: {
                                natureza: nomes.join('; '),
                                naturezaOriginal: boletim.naturezaOriginal || boletim.natureza
                            }
                        },
                        timestamps: false
                    }
                }
            })
            if (atualizacoes.length) await Boletim.bulkWrite(atualizacoes)
        }
        return res.status(200).json(natureza)
    } catch (error) {
        if (error.name === 'ValidationError') return res.status(400).json({ message: error.message })
        return mapearErro(error, res, 'editar')
    }
}

exports.alterarStatus = async (req, res) => {
    if (!isValidNatureId(req.params.id)) {
        return res.status(400).json({ message: 'Identificador de natureza inválido.' })
    }
    if (!req.body || typeof req.body.ativo !== 'boolean') {
        return res.status(400).json({ message: 'O status ativo deve ser booleano.' })
    }
    try {
        const natureza = await Natureza.findByIdAndUpdate(
            req.params.id,
            { ativo: req.body.ativo },
            { new: true, runValidators: true }
        )
        if (!natureza) return res.status(404).json({ message: 'Natureza não encontrada.' })
        return res.status(200).json(natureza)
    } catch (error) {
        return mapearErro(error, res, 'alterar status da')
    }
}
