const mongoose = require('mongoose')
const Localidade = require('../model/localidade')
const Boletim = require('../model/boletim')
const Auditoria = require('../model/localidadeAuditoria')
const { normalizarLocalidade, TIPOS_LOCALIDADE, ZONAS } = require('../utils/localidade')
const { getEffectiveAccess } = require('../utils/authorization')

const idValido = value => mongoose.Types.ObjectId.isValid(value)
function validate(body, partial = false) {
    if (!body || typeof body !== 'object' || Array.isArray(body)) return 'Envie os dados da localidade em um objeto.'
    for (const [key, values] of [['tipo', TIPOS_LOCALIDADE], ['zona', ZONAS]]) {
        if ((!partial || Object.hasOwn(body, key)) && !values.includes(body[key])) return `Campo ${key} inválido.`
    }
    if ((!partial || Object.hasOwn(body, 'nome')) && (typeof body.nome !== 'string' || !body.nome.trim() || body.nome.length > 160)) return 'Informe um nome de até 160 caracteres.'
    if ((!partial || Object.hasOwn(body, 'municipio')) && (typeof body.municipio !== 'string' || !body.municipio.trim() || body.municipio.length > 120)) return 'Informe um município válido.'
    if (Object.hasOwn(body, 'aliases') && (!Array.isArray(body.aliases) || body.aliases.some(x => typeof x !== 'string' || x.length > 160))) return 'Aliases inválidos.'
    if (Object.hasOwn(body, 'ativo') && typeof body.ativo !== 'boolean') return 'O status ativo deve ser booleano.'
    return null
}
function fail(error, res, operation) {
    if (error.code === 11000) return res.status(409).json({ message: 'Já existe uma localidade com município, nome, tipo e zona iguais.' })
    console.error(`Erro ao ${operation} localidade:`, error)
    return res.status(500).json({ message: `Erro ao ${operation} localidade.` })
}
async function manage(req, res) {
    const access = req.access || await getEffectiveAccess(req.user.userId)
    if (!access) { res.status(401).json({ message: 'Conta inexistente ou desativada.' }); return false }
    if (!access.permissions.includes('localidades.manage')) { res.status(403).json({ message: 'Você não possui permissão para gerenciar localidades.' }); return false }
    return true
}

exports.listar = async (req, res) => {
    try {
        const q = String(req.query.q || '').trim()
        if (q.length > 100) return res.status(400).json({ message: 'A pesquisa deve ter até 100 caracteres.' })
        const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1)
        const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 30))
        const filter = {}
        if (req.query.municipio) filter.municipio = String(req.query.municipio).trim()
        if (req.query.tipo && TIPOS_LOCALIDADE.includes(req.query.tipo)) filter.tipo = req.query.tipo
        if (req.query.zona && ZONAS.includes(req.query.zona)) filter.zona = req.query.zona
        const access = req.access || await getEffectiveAccess(req.user.userId)
        const canManage = Boolean(access?.permissions.includes('localidades.manage'))
        if (req.query.incluirInativas === 'true' && canManage) { /* admin listing */ } else filter.ativo = true
        if (q) {
            const key = normalizarLocalidade(q)
            filter.$or = [{ nomeNormalizado: { $regex: key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') } }, { aliasesNormalizados: key }]
        }
        const [items, total] = await Promise.all([
            Localidade.find(filter).sort({ nome: 1 }).skip((page - 1) * limit).limit(limit).lean(),
            Localidade.countDocuments(filter)
        ])
        return res.json({ items, page, limit, total })
    } catch (error) { return fail(error, res, 'listar') }
}
exports.consultar = async (req, res) => {
    if (!idValido(req.params.id)) return res.status(400).json({ message: 'Identificador de localidade inválido.' })
    try {
        const item = await Localidade.findById(req.params.id).lean()
        if (!item || (!item.ativo && !await manage(req, res))) return item ? undefined : res.status(404).json({ message: 'Localidade não encontrada.' })
        const ocorrencias = await Boletim.countDocuments({ localidadeId: item._id })
        return res.json({ ...item, ocorrencias })
    } catch (error) { return fail(error, res, 'consultar') }
}
exports.boletins = async (req, res) => {
    if (!await manage(req, res)) return
    if (!idValido(req.params.id)) return res.status(400).json({ message: 'Identificador de localidade inválido.' })
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1)
    const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 30))
    try {
        const filter = { localidadeId: req.params.id }
        const [items, total] = await Promise.all([
            Boletim.find(filter).select('_id numero municipio bairro localidadeNome localidadeId').sort({ updatedAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
            Boletim.countDocuments(filter)
        ])
        return res.json({ items, total, page, limit })
    } catch (err) { return fail(err, res, 'consultar boletins vinculados à') }
}
exports.auditoria = async (req, res) => {
    if (!await manage(req, res)) return
    if (!idValido(req.params.id)) return res.status(400).json({ message: 'Identificador de localidade inválido.' })
    try {
        const items = await Auditoria.find({ localidadeId: req.params.id }).sort({ createdAt: -1 }).limit(100).lean()
        return res.json({ items })
    } catch (err) { return fail(err, res, 'consultar auditoria da') }
}
exports.criar = async (req, res) => {
    if (!await manage(req, res)) return
    const error = validate(req.body)
    if (error) return res.status(400).json({ message: error })
    try { return res.status(201).json(await Localidade.create({ ...req.body, nomeNormalizado: normalizarLocalidade(req.body.nome) })) }
    catch (err) { return fail(err, res, 'cadastrar') }
}

// Operators can add a locality while filling a report. Existing names are
// returned unchanged so the catalog is not overwritten by a report form.
exports.registrarPeloBoletim = async (req, res) => {
    const { nome, municipio, tipo } = req.body || {}
    const zona = req.body?.zona || 'NAO_INFORMADA'
    const payload = { nome, municipio, tipo, zona }
    const error = validate(payload)
    if (error) return res.status(400).json({ message: error })
    const nomeNormalizado = normalizarLocalidade(nome)
    try {
        const matches = await Localidade.find({
            municipio: municipio.trim(),
            $or: [{ nomeNormalizado }, { aliasesNormalizados: nomeNormalizado }]
        }).limit(2).lean()
        if (matches.length > 1) {
            return res.status(409).json({ message: 'Há mais de uma localidade com esse nome neste município. Solicite a revisão do catálogo.' })
        }
        if (matches.length === 1) return res.json(matches[0])

        const item = await Localidade.findOneAndUpdate(
            { municipio: municipio.trim(), nomeNormalizado },
            { $setOnInsert: { nome: nome.trim(), nomeNormalizado, municipio: municipio.trim(), tipo, zona, ativo: true } },
            { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
        )
        return res.status(201).json(item)
    } catch (err) {
        if (err.code === 11000) {
            const existing = await Localidade.findOne({ municipio: municipio.trim(), nomeNormalizado }).lean().catch(() => null)
            if (existing) return res.json(existing)
        }
        return fail(err, res, 'registrar pelo boletim')
    }
}

exports.editar = async (req, res) => {
    if (!await manage(req, res)) return
    if (!idValido(req.params.id)) return res.status(400).json({ message: 'Identificador de localidade inválido.' })
    const error = validate(req.body, true)
    if (error) return res.status(400).json({ message: error })
    const allowed = Object.fromEntries(['nome', 'municipio', 'tipo', 'zona', 'aliases', 'ativo'].filter(k => Object.hasOwn(req.body, k)).map(k => [k, req.body[k]]))
    if (allowed.nome) allowed.nomeNormalizado = normalizarLocalidade(allowed.nome)
    if (allowed.aliases) allowed.aliasesNormalizados = [...new Set(allowed.aliases.map(normalizarLocalidade).filter(Boolean))]
    try {
        const item = await Localidade.findByIdAndUpdate(req.params.id, { $set: allowed }, { new: true, runValidators: true })
        return item ? res.json(item) : res.status(404).json({ message: 'Localidade não encontrada.' })
    } catch (err) { return fail(err, res, 'editar') }
}
exports.status = async (req, res) => {
    if (!await manage(req, res)) return
    if (!idValido(req.params.id) || typeof req.body?.ativo !== 'boolean') return res.status(400).json({ message: 'Informe um identificador e status válidos.' })
    try {
        const item = await Localidade.findByIdAndUpdate(req.params.id, { $set: { ativo: req.body.ativo } }, { new: true })
        return item ? res.json(item) : res.status(404).json({ message: 'Localidade não encontrada.' })
    } catch (err) { return fail(err, res, 'alterar status da') }
}
exports.sugestoesDuplicidade = async (req, res) => {
    if (!await manage(req, res)) return
    try {
        const municipio = String(req.query.municipio || '').trim()
        const filter = municipio ? { municipio } : {}
        const [items, legacy] = await Promise.all([
            Localidade.aggregate([
                { $match: filter },
                { $unwind: '$aliases' },
                { $group: { _id: '$aliases', localidades: { $addToSet: { id: '$_id', nome: '$nome', municipio: '$municipio', tipo: '$tipo', zona: '$zona' } } } },
                { $match: { $expr: { $gt: [{ $size: '$localidades' }, 1] } } },
                { $limit: 100 }
            ]),
            Boletim.aggregate([{ $match: { bairro: { $type: 'string', $ne: '' }, ...(municipio ? { municipio } : {}) } }, { $group: { _id: { municipio: '$municipio', nome: '$bairro' }, registros: { $sum: 1 } } }, { $sort: { registros: -1 } }, { $limit: 1000 }])
        ])
        const candidates = await Localidade.find(filter).lean()
        const grouped = new Map()
        legacy.forEach(row => {
            const key = `${row._id.municipio}\u0000${normalizarLocalidade(row._id.nome)}`
            const group = grouped.get(key) || { municipio: row._id.municipio, grafias: [], registros: 0 }
            group.grafias.push(row._id.nome)
            group.registros += row.registros
            grouped.set(key, group)
        })
        const suggested = [...grouped.values()].sort((a, b) => b.registros - a.registros).map(group => {
            const normalizedNames = new Set(group.grafias.map(normalizarLocalidade))
            const matches = candidates.filter(item => item.municipio === group.municipio && (normalizedNames.has(item.nomeNormalizado) || item.aliases.some(alias => normalizedNames.has(normalizarLocalidade(alias)))))
            return { ...group, nomeEncontrado: group.grafias[0], sugestoes: matches.map(({ _id, nome, tipo, zona }) => ({ id: _id, nome, tipo, zona })), requerConfirmacao: true }
        })
        return res.json({ aliasesDuplicados: items, grafiasHistoricas: suggested })
    } catch (err) { return fail(err, res, 'consultar sugestões de') }
}
exports.associarHistorico = async (req, res) => {
    if (!await manage(req, res)) return
    const { municipio, nomeEncontrado, localidadeId, boletimId } = req.body || {}
    if (!idValido(localidadeId)) return res.status(400).json({ message: 'Informe um identificador de localidade válido.' })
    try {
        const item = await Localidade.findById(localidadeId)
        if (boletimId) {
            if (!idValido(boletimId)) return res.status(400).json({ message: 'Identificador de boletim inválido.' })
            const report = await Boletim.findOne({ _id: boletimId, municipio: item?.municipio })
            if (!item || !report) return res.status(404).json({ message: 'Boletim ou localidade não encontrados no mesmo município.' })
            await Boletim.updateOne({ _id: report._id }, { $set: { localidadeId: item._id, localidadeNome: item.nome, localidadeTipo: item.tipo, zona: item.zona } })
            await Auditoria.create({ localidadeId: item._id, acao: 'CORRIGIR_ASSOCIACAO', municipio: item.municipio, boletimId: report._id, administradorId: String(req.user.userId), registrosAfetados: 1 })
            return res.json({ vinculados: 1, localidade: item })
        }
        if (typeof municipio !== 'string' || typeof nomeEncontrado !== 'string' || !nomeEncontrado.trim()) return res.status(400).json({ message: 'Informe município, grafia exata e localidade selecionada.' })
        if (!item || item.municipio !== municipio) return res.status(422).json({ message: 'A localidade precisa pertencer ao município informado.' })
        const normalized = normalizarLocalidade(nomeEncontrado)
        const conflicting = await Localidade.findOne({ municipio, _id: { $ne: item._id }, $or: [{ nomeNormalizado: normalized }, { aliasesNormalizados: normalized }] }).select('_id').lean()
        if (conflicting) return res.status(409).json({ message: 'Esta grafia também identifica outra localidade. Resolva a ambiguidade antes de vincular boletins.' })
        const result = await Boletim.updateMany({ municipio, bairro: nomeEncontrado, $or: [{ localidadeId: { $exists: false } }, { localidadeId: null }] }, { $set: { localidadeId: item._id, localidadeNome: item.nome, localidadeTipo: item.tipo, zona: item.zona } })
        await Auditoria.create({ localidadeId: item._id, acao: 'ASSOCIAR_GRAFIA', municipio, grafia: nomeEncontrado, administradorId: String(req.user.userId), registrosAfetados: result.modifiedCount })
        if (!item.aliases.some(alias => normalizarLocalidade(alias) === normalized)) item.aliases.push(nomeEncontrado)
        item.aliasesNormalizados = [...new Set(item.aliases.map(normalizarLocalidade).filter(Boolean))]
        await item.save()
        return res.json({ vinculados: result.modifiedCount, localidade: item })
    } catch (err) { return fail(err, res, 'associar registros históricos à') }
}
exports.validarReferencia = async (data, existing) => {
    if (data.zona && !ZONAS.includes(data.zona)) return { error: 'Zona territorial inválida.' }
    if (data.localidadeTipo && !TIPOS_LOCALIDADE.includes(data.localidadeTipo)) return { error: 'Tipo de localidade inválido.' }
    if (!Object.hasOwn(data, 'localidadeId')) return { data }
    if (!data.localidadeId) {
        const compatibleData = { ...data }
        delete compatibleData.localidadeId
        delete compatibleData.localidadeNome
        return { clear: Boolean(existing?.localidadeId), data: compatibleData }
    }
    if (!idValido(data.localidadeId)) return { error: 'Identificador de localidade inválido.' }
    const item = await Localidade.findById(data.localidadeId)
    if (!item) return { error: 'A localidade selecionada não foi encontrada.' }
    if (!item.ativo && String(existing?.localidadeId || '') !== String(item._id)) return { error: 'Localidade inativa não pode ser usada em novo boletim.' }
    if (String(data.municipio || '').trim() !== item.municipio) return { error: 'A localidade selecionada não pertence ao município do boletim.' }
    return { data: { ...data, bairro: item.nome, localidadeId: item._id, localidadeNome: item.nome, localidadeTipo: item.tipo, zona: item.zona } }
}
