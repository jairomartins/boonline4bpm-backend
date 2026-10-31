//Controller of Incident Reports

const IncidentReport = require('../model/boletim')
const { sanitizeHistoryHtml } = require('../utils/historyHtml')
const mongoose = require('mongoose')
const Natureza = require('../model/natureza')
const Localidade = require('../model/localidade')
const { validarMateriaisApreendidos } = require('../utils/materialValidation')
const {
    getEffectiveAccess,
    isUserInIncidentReportEffective
} = require('../utils/authorization')
const boletimDocumentoController = require('./boletimDocumentoController')
const localidadeController = require('./localidadeController')
const { parseIncidentDate } = require('../utils/incidentDate')
const {
    isValidCpf,
    mesclarEnvolvidosExistentes,
    validarEnvolvidos
} = require('../utils/envolvidoValidation')

async function validarNaturezasRecebidas(data, existing, creating) {
    const temLista = Object.prototype.hasOwnProperty.call(data, 'naturezaIds')
    const temIdLegado = Object.prototype.hasOwnProperty.call(data, 'naturezaId')
    if (!temLista && !temIdLegado) {
        return creating
            ? { status: 400, error: 'Selecione ao menos uma natureza oficial para o boletim.' }
            : {}
    }

    if (temLista && !Array.isArray(data.naturezaIds)) {
        return { status: 400, error: 'A lista de naturezas selecionadas é inválida.' }
    }
    const values = temLista && data.naturezaIds.length
        ? data.naturezaIds
        : temIdLegado && data.naturezaId ? [data.naturezaId] : []
    if (!values.length && !creating) return {}
    if (!Array.isArray(values) || values.length < 1 ||
        values.some(value => typeof value !== 'string' || !/^[0-9a-fA-F]{24}$/.test(value)) ||
        new Set(values.map(value => value.toLowerCase())).size !== values.length) {
        return { status: 400, error: 'Selecione uma ou mais naturezas oficiais, sem duplicidade.' }
    }

    const documentos = await Natureza.find({ _id: { $in: values } })
    if (documentos.length !== values.length) {
        return { status: 404, error: 'Uma ou mais naturezas não foram encontradas.' }
    }
    const porId = new Map(documentos.map(documento => [documento._id.toString(), documento]))
    const selecionadas = values.map(value => porId.get(value.toLowerCase()))
    const referenciasExistentes = new Set([
        ...(existing && Array.isArray(existing.naturezaIds) ? existing.naturezaIds : []),
        ...(existing && existing.naturezaId ? [existing.naturezaId] : [])
    ].map(value => value.toString()))
    if (selecionadas.some(documento =>
        !documento.ativo && !referenciasExistentes.has(documento._id.toString()))) {
        return { status: 422, error: 'Naturezas inativas não podem ser usadas em novos registros ou associações.' }
    }
    return { documentos: selecionadas }
}

async function getRequestAccess(req) {
    return req.access || getEffectiveAccess(req.user.userId)
}

function naturezaDisplayExpression(catalogoPath, fallback) {
    return {
        $let: {
            vars: { item: { $arrayElemAt: [catalogoPath, 0] } },
            in: { $ifNull: ['$$item.nome', fallback] }
        }
    }
}

// Create or Update Incident Report
exports.createOrUpdateIncidentReport = async (req, res) => {
    const incidentReportData = req.body && req.body.incidentReport;
    if (!incidentReportData || typeof incidentReportData !== 'object' || Array.isArray(incidentReportData)) {
        return res.status(400).json({ message: "O campo incidentReport deve ser um objeto." })
    }
    const receivedHistory = incidentReportData.historicohtml
    if (incidentReportData.historicohtml !== undefined) {
        if (typeof incidentReportData.historicohtml !== 'string') return res.status(400).json({ message: 'Histórico deve ser texto HTML.' })
        incidentReportData.historicohtml = sanitizeHistoryHtml(incidentReportData.historicohtml)
    }
    const { numero, data } = incidentReportData
    if (typeof numero !== 'string' || !numero.trim() ||
        typeof data !== 'string' || !isValidIncidentDate(data)) {
        return res.status(400).json({ message: "Informe número e uma data válida no formato DD/MM/AAAA." })
    }
    if (typeof incidentReportData.municipio !== 'string' || !incidentReportData.municipio.trim()) {
        return res.status(400).json({ message: "Informe o município da ocorrência." })
    }
    const erroMateriais = validarMateriaisApreendidos(incidentReportData.materiaisApreendidos)
    if (erroMateriais) return res.status(400).json({ message: erroMateriais })
    // logic to update an existing Incident Report if _id is provided (when incidentReportData._id exists in the request body)
    if (incidentReportData._id) {
        if (!mongoose.Types.ObjectId.isValid(incidentReportData._id)) {
            return res.status(400).json({ message: "ID de boletim inválido." })
        }
        try {
            const existing = await IncidentReport.findById(incidentReportData._id)
            // Preserve untouched legacy HTML during unrelated report edits.
            if (existing && receivedHistory === existing.historicohtml) incidentReportData.historicohtml = receivedHistory
            if (!existing) {
                return res.status(404).json({ message: "Boletim não encontrado." })
            }
            const access = await getEffectiveAccess(req.user.userId)
            if (!access) return res.status(401).json({ message: 'Conta inexistente ou desativada.' })
            const isOwner = String(existing.creatorId) === String(req.user.userId)
            if (isOwner && !access.permissions.includes('boletins.edit.own') &&
                !access.permissions.includes('boletins.edit.all')) {
                return res.status(403).json({ message: 'Você não possui permissão para editar boletins.' })
            }
            if (!isOwner && !access.permissions.includes('boletins.edit.all')) {
                return res.status(403).json({ message: "Você só pode editar boletins registrados por você." })
            }
            const syncRequestId = incidentReportData.syncRequestId
            if (syncRequestId !== undefined &&
                (typeof syncRequestId !== 'string' ||
                    !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}:\d+$/i.test(syncRequestId))) {
                return res.status(400).json({ message: 'Invalid sync request identifier.' })
            }
            if (syncRequestId && existing.lastClientMutationId === syncRequestId) {
                return res.status(200).json({ incidentReport: existing, message: 'Update already applied for this synchronization request.', idempotentReplay: true })
            }
            const latitudeRecebida = Object.prototype.hasOwnProperty.call(incidentReportData, 'latitude')
            const longitudeRecebida = Object.prototype.hasOwnProperty.call(incidentReportData, 'longitude')
            let coordenadasAtualizadas = null
            if (latitudeRecebida || longitudeRecebida) {
                coordenadasAtualizadas = normalizarParCoordenadas(
                    latitudeRecebida ? incidentReportData.latitude : existing.latitude,
                    longitudeRecebida ? incidentReportData.longitude : existing.longitude
                )
                if (coordenadasAtualizadas.error) {
                    return res.status(400).json({ message: coordenadasAtualizadas.error })
                }
            }
            const erroEnvolvidos = validarEnvolvidos(incidentReportData.envolvidos, existing.envolvidos)
            if (erroEnvolvidos) return res.status(400).json({ message: erroEnvolvidos })
            const naturezasRecebidas = await validarNaturezasRecebidas(incidentReportData, existing, false)
            if (naturezasRecebidas.error) {
                return res.status(naturezasRecebidas.status).json({ message: naturezasRecebidas.error })
            }
            const territorio = await localidadeController.validarReferencia(incidentReportData, existing)
            if (territorio.error) return res.status(422).json({ message: territorio.error })
            const updateData = { ...territorio.data }
            if (territorio.clear) { delete updateData.localidadeId; delete updateData.localidadeNome }
            delete updateData.dataOcorrencia
            updateData.dataOcorrencia = parseIncidentDate(incidentReportData.data)
            if (coordenadasAtualizadas) {
                delete updateData.latitude
                delete updateData.longitude
                if (!coordenadasAtualizadas.absent) {
                    updateData.latitude = coordenadasAtualizadas.latitude
                    updateData.longitude = coordenadasAtualizadas.longitude
                }
            }
            if (Array.isArray(updateData.envolvidos)) {
                updateData.envolvidos = mesclarEnvolvidosExistentes(
                    updateData.envolvidos,
                    existing.envolvidos || []
                )
            }
            delete updateData._id
            delete updateData.creatorId
            delete updateData.createdAt
            delete updateData.updatedAt
            delete updateData.__v
            delete updateData.natureza
            delete updateData.naturezaId
            delete updateData.naturezaIds
            delete updateData.naturezaOriginal
            delete updateData.naturezaCatalogoMigrada
            const expectedRevision = Object.prototype.hasOwnProperty.call(incidentReportData, 'expectedRevision')
                ? incidentReportData.expectedRevision
                : null
            if (expectedRevision !== null && (!Number.isInteger(expectedRevision) || expectedRevision < 0)) {
                return res.status(400).json({ message: 'Invalid expectedRevision.' })
            }
            delete updateData.expectedRevision
            delete updateData.clientRequestId
            delete updateData.syncRequestId
            delete updateData.lastClientMutationId
            delete updateData.documentRevision
            delete updateData.documentVersionSequence
            delete updateData.currentDocumentVersion
            if (naturezasRecebidas.documentos) {
                const documentos = naturezasRecebidas.documentos
                const ids = documentos.map(documento => documento._id)
                const nomes = documentos.map(documento => documento.nome)
                const antigas = (existing.naturezaIds || []).map(value => value.toString())
                if (!antigas.length && existing.naturezaId) antigas.push(existing.naturezaId.toString())
                const alterouReferencia = antigas.length !== ids.length ||
                    antigas.some((id, index) => id !== ids[index].toString())
                updateData.naturezaIds = ids
                updateData.naturezaId = ids.length === 1 ? ids[0] : null
                updateData.natureza = nomes.join('; ')
                if (!existing.naturezaOriginal && existing.natureza &&
                    existing.natureza !== updateData.natureza) {
                    updateData.naturezaOriginal = existing.natureza
                }
                if (alterouReferencia) updateData.naturezaCatalogoMigrada = false
            }
            const updateOperation = {
                $set: updateData,
                $inc: { documentRevision: 1 }
            }
            if (territorio.clear) updateOperation.$unset = { ...(updateOperation.$unset || {}), localidadeId: 1, localidadeNome: 1 }
            if (syncRequestId) updateOperation.$set.lastClientMutationId = syncRequestId
            if (coordenadasAtualizadas && coordenadasAtualizadas.absent) {
                updateOperation.$unset = { ...(updateOperation.$unset || {}), latitude: 1, longitude: 1 }
            }
            const updatedIncidentReport = expectedRevision === null
                ? await IncidentReport.findByIdAndUpdate(
                    incidentReportData._id,
                    updateOperation,
                    { new: true, runValidators: true })
                : await IncidentReport.findOneAndUpdate(
                    {
                        _id: incidentReportData._id,
                        $or: [
                            { documentRevision: expectedRevision },
                            ...(expectedRevision === 0 ? [{ documentRevision: { $exists: false } }] : [])
                        ]
                    },
                    updateOperation,
                    { new: true, runValidators: true })
            if (!updatedIncidentReport) {
                if (expectedRevision !== null) {
                    const latest = await IncidentReport.findById(incidentReportData._id)
                    if (latest) return res.status(409).json({
                        message: 'This report changed elsewhere. Reload and compare versions before syncing.',
                        serverRevision: Number(latest.documentRevision) || 0
                    })
                }
                return res.status(404).json({ message: "Boletim não encontrado." })
            }
            await boletimDocumentoController.invalidarVersoesAnteriores(
                incidentReportData._id,
                req.user.userId
            )
            return res.status(200).json({incidentReport: updatedIncidentReport, message: "Boletim atualizado com sucesso."});
        } catch (err) {
            if (err && err.name === 'ValidationError') {
                return res.status(400).json({ message: err.message })
            }
            return res.status(500).json({message:"Erro ao atualizar boletim."});
        }
    } else {
      // logic to create a new Incident Report if _id is not provided (when incidentReportData._id does not exist in the request body)
        try{
            const access = await getEffectiveAccess(req.user.userId)
            if (!access) return res.status(401).json({ message: 'Conta inexistente ou desativada.' })
            if (!access.permissions.includes('boletins.create')) {
                return res.status(403).json({ message: 'Você não possui permissão para criar boletins.' })
            }
            const clientRequestId = incidentReportData.clientRequestId
            if (clientRequestId !== undefined &&
                (typeof clientRequestId !== 'string' ||
                    !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(clientRequestId))) {
                return res.status(400).json({ message: 'Invalid idempotency identifier.' })
            }
            if (clientRequestId) {
                const alreadyCreated = await IncidentReport.findOne({ creatorId: req.user.userId, clientRequestId })
                if (alreadyCreated) {
                    return res.status(200).json({ incidentReport: alreadyCreated, message: 'Report already exists for this draft.', idempotentReplay: true })
                }
            }
            const coordenadas = normalizarParCoordenadas(
                incidentReportData.latitude,
                incidentReportData.longitude
            )
            if (coordenadas.error) {
                return res.status(400).json({ message: coordenadas.error })
            }
            const erroEnvolvidos = validarEnvolvidos(incidentReportData.envolvidos)
            if (erroEnvolvidos) return res.status(400).json({ message: erroEnvolvidos })
            const naturezasRecebidas = await validarNaturezasRecebidas(incidentReportData, null, true)
            if (naturezasRecebidas.error) {
                return res.status(naturezasRecebidas.status).json({ message: naturezasRecebidas.error })
            }
            const territorio = await localidadeController.validarReferencia(incidentReportData, null)
            if (territorio.error) return res.status(422).json({ message: territorio.error })
            const documentos = naturezasRecebidas.documentos
            const ids = documentos.map(documento => documento._id)
            const newIncidentReport = {
                ...territorio.data,
                dataOcorrencia: parseIncidentDate(incidentReportData.data),
                natureza: documentos.map(documento => documento.nome).join('; '),
                naturezaId: ids.length === 1 ? ids[0] : null,
                naturezaIds: ids,
                creatorId: req.user.userId
            };
            if (clientRequestId) newIncidentReport.clientRequestId = clientRequestId
            delete newIncidentReport.latitude
            delete newIncidentReport.longitude
            if (!coordenadas.absent) {
                newIncidentReport.latitude = coordenadas.latitude
                newIncidentReport.longitude = coordenadas.longitude
            }
            delete newIncidentReport.documentRevision
            delete newIncidentReport.documentVersionSequence
            delete newIncidentReport.currentDocumentVersion
            delete newIncidentReport.naturezaOriginal
            delete newIncidentReport.naturezaCatalogoMigrada
            const createdIncidentReport = await IncidentReport.create(newIncidentReport);
            return res.status(201).json({incidentReport: createdIncidentReport, message: "Boletim criado com sucesso."});
        }catch(err){
            if (err && err.code === 11000 && incidentReportData.clientRequestId) {
                const alreadyCreated = await IncidentReport.findOne({
                    creatorId: req.user.userId,
                    clientRequestId: incidentReportData.clientRequestId
                })
                if (alreadyCreated) {
                    return res.status(200).json({ incidentReport: alreadyCreated, message: 'Report already exists for this draft.', idempotentReplay: true })
                }
            }
            if (err && err.name === 'ValidationError') {
                return res.status(400).json({ message: err.message })
            }
            return res.status(500).json({message:"Erro ao criar boletim."});
        }

    }

}

exports.buscarEnvolvidoPorCpf = async (req, res) => {
    const cpf = String(req.params.cpf || '').replace(/\D/g, '')
    if (!isValidCpf(cpf)) {
        return res.status(400).json({ message: 'Informe um CPF válido para a pesquisa.' })
    }
    const cpfFormatado = `${cpf.slice(0, 3)}.${cpf.slice(3, 6)}.${cpf.slice(6, 9)}-${cpf.slice(9)}`
    const filtro = {
        envolvidos: {
            $elemMatch: { cpf: { $in: [cpf, cpfFormatado] } }
        }
    }
    try {
        const access = await getRequestAccess(req)
        if (!access) return res.status(401).json({ message: 'Conta inexistente ou desativada.' })
        const canViewAll = access.permissions.includes('boletins.view.all')
        if (!canViewAll && !access.permissions.includes('boletins.view.own')) {
            return res.status(403).json({ message: 'Você não possui permissão para consultar boletins.' })
        }
        if (!canViewAll) filtro.creatorId = req.user.userId

        const boletim = await IncidentReport.findOne(filtro)
            .sort({ updatedAt: -1, _id: -1 })
            .select('envolvidos')
            .lean()
        const envolvido = boletim?.envolvidos?.find(item =>
            String(item.cpf || '').replace(/\D/g, '') === cpf
        )
        if (!envolvido) return res.status(200).json({ found: false })

        const {
            nome, nomeSocial, alcunha, cpf: cpfSalvo, cnhPpd, corRaca, sexo, nascimento,
            orientacaoSexual, naturalidade, profissao, estadoCivil, escolaridade, endereco,
            numero, complemento, pontoReferencia, bairro, municipio, uf, telefone, nomeMae,
            nomePai, obs
        } = envolvido
        return res.status(200).json({
            found: true,
            pessoa: {
                nome: nome || '',
                nomeSocial: nomeSocial || '',
                alcunha: alcunha || '',
                cpf: cpfSalvo || cpfFormatado,
                cnhPpd: cnhPpd || '',
                sexo: sexo || '',
                nascimento: nascimento || '',
                corRaca: corRaca || '',
                orientacaoSexual: orientacaoSexual || '',
                naturalidade: naturalidade || '',
                profissao: profissao || '',
                estadoCivil: estadoCivil || '',
                escolaridade: escolaridade || '',
                endereco: endereco || '',
                numero: numero || '',
                complemento: complemento || '',
                pontoReferencia: pontoReferencia || '',
                bairro: bairro || '',
                municipio: municipio || '',
                uf: uf || '',
                telefone: telefone || '',
                nomeMae: nomeMae || '',
                nomePai: nomePai || '',
                obs: obs || ''
            }
        })
    } catch (error) {
        console.error('Erro ao consultar envolvido por CPF:', error)
        return res.status(500).json({ message: 'Erro ao consultar os dados do envolvido.' })
    }
}

//  Delete Incident Report by ID
exports.removeIncidentReport = async( req, res)=>{
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
        return res.status(400).json({ message: "ID de boletim inválido." })
    }
    try {
        const incidentReport = await IncidentReport.findById(req.params.id);
        if (!incidentReport) {
            return res.status(404).json({ message: "Boletim não encontrado." })
        }
        const access = req.access || await getRequestAccess(req)
        if (!access) return res.status(401).json({ message: 'Conta inexistente ou desativada.' })
        const canDeleteAny = access.permissions.includes('boletins.delete')
        const canDeleteOwn = access.permissions.includes('boletins.delete.own')
        if (!canDeleteAny && (!canDeleteOwn || String(incidentReport.creatorId) !== String(req.user.userId))) {
            return res.status(403).json({ message: "Você só pode excluir boletins registrados por você." })
        }
        await incidentReport.deleteOne()
        return res.status(200).json({ message: "Boletim excluído com sucesso." })
    } catch (err) {
        return res.status(500).json({message:"Erro ao excluir boletim."})
    } 
}

// Search all Incident Reports on database
exports.incidentReports = async (req, res) => {
  try {
    const incidentReports = await IncidentReport.find().sort({ _id: -1 }); 
    return res.status(200).json(incidentReports);
  } catch (err) {
    return res.status(500).json({
      message: "Erro ao buscar boletins."
    });
  }
};

exports.incidentReportsByViolenceDomestic = async (req, res) => {
  try {
    const ocorrencias = await IncidentReport.find(
      {
        natureza: { $regex: "viol[eê]ncia dom[eé]stica", $options: "i" }
      }
    ).sort({ _id: -1 });

    return res.status(200).json({
      incidentesReports: ocorrencias
    });

  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message: "Erro ao buscar boletins de violência doméstica"
    });
  }
};

//Search Incident Report by ID on database  
exports.incidentReportByID = async (req, res)=>{
    if (!mongoose.Types.ObjectId.isValid(req.params.incidentReportId)) {
        return res.status(400).json({ message: "ID de boletim inválido." })
    }
    try{
        const incidentReport = await IncidentReport.findById(req.params.incidentReportId)
        if (!incidentReport) {
            return res.status(404).json({ message: "Boletim não encontrado." })
        }
        const access = await getRequestAccess(req)
        if (!access) return res.status(401).json({ message: 'Conta inexistente ou desativada.' })
        const canViewAll = access.permissions.includes('boletins.view.all')
        const canViewOwn = access.permissions.includes('boletins.view.own')
        const canViewOwnReport = canViewOwn && (
            String(incidentReport.creatorId) === String(req.user.userId) ||
            isUserInIncidentReportEffective(access.user, incidentReport)
        )
        if (!canViewAll && !canViewOwnReport) {
            return res.status(404).json({ message: "Boletim não encontrado." })
        }
        return res.status(200).json(incidentReport)
    }catch(err){
        return res.status(500).json({message:"Erro ao buscar boletim."})
    }
}

//Search Incident Report by number of report
exports.incidentReportByNumber = async (req, res)=>{
    try{
        const incidentReport = await IncidentReport.findOne({numero: req.params.number}).sort({'_id':-1})
        if (!incidentReport) {
            return res.status(404).json({ message: "Boletim não encontrado." })
        }
        return res.status(200).json(incidentReport)
    }catch(err){
        return res.status(500).json({message:"Erro ao buscar boletim pelo número."})
    }
}

//Search Incident Report by number and city
exports.incidentReportByCityAndNumber = async (req, res)=>{
    try {
        const incidentReport = await IncidentReport.findOne({numero: req.params.number, municipio: req.params.city}).sort({'_id':-1})
        if (!incidentReport) {
            return res.status(404).json({ message: "Boletim não encontrado." })
        }
        return res.status(200).json(incidentReport)
    } catch (err) {
        return res.status(500).json({message:"Erro ao buscar boletim por município e número."})
    }    
}

// Return a list of Incident Reports by date
exports.incidentReportListByDate = async (req, res) => {
    try {
        const { day, month, year } = req.params;
        if (!/^\d{1,2}$/.test(day) || !/^\d{1,2}$/.test(month) || !/^\d{4}$/.test(year)) {
            return res.status(400).json({ message: "Data inválida." })
        }
        const parsedDate = new Date(Number(year), Number(month) - 1, Number(day))
        if (parsedDate.getFullYear() !== Number(year) || parsedDate.getMonth() !== Number(month) - 1 || parsedDate.getDate() !== Number(day)) {
            return res.status(400).json({ message: "Data inválida." })
        }
        const dateToSearch = `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}`;

        const incidentReportList = await IncidentReport.find({ data: dateToSearch }).sort({ municipio: 1, numero: 1 }); 
        return res.status(200).json(incidentReportList);
    } catch (err) {
        return res.status(500).send({
            message: "Erro ao buscar boletins por data."
        });
    }
};

function isValidIncidentDate(value) {
    const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value)
    if (!match) return false
    const [, day, month, year] = match
    const date = new Date(Number(year), Number(month) - 1, Number(day))
    return date.getFullYear() === Number(year) &&
        date.getMonth() === Number(month) - 1 &&
        date.getDate() === Number(day)
}

function normalizarCoordenada(value, min, max, label) {
    if (value === undefined || value === null ||
        (typeof value === 'string' && !value.trim())) {
        return { absent: true }
    }
    if (typeof value !== 'string' && typeof value !== 'number') {
        return { error: `${label} deve ser um número finito entre ${min} e ${max}.` }
    }
    let texto = String(value).trim()
    if (texto.includes(',')) {
        if (texto.includes('.') || (texto.match(/,/g) || []).length !== 1) {
            return { error: `${label} deve ser um número finito entre ${min} e ${max}.` }
        }
        texto = texto.replace(',', '.')
    }
    if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(texto)) {
        return { error: `${label} deve ser um número finito entre ${min} e ${max}.` }
    }
    const coordinate = Number(texto)
    if (!Number.isFinite(coordinate) || coordinate < min || coordinate > max) {
        return { error: `${label} deve ser um número finito entre ${min} e ${max}.` }
    }
    return { value: String(coordinate), absent: false }
}

function normalizarParCoordenadas(latitude, longitude) {
    const lat = normalizarCoordenada(latitude, -90, 90, 'Latitude')
    const lon = normalizarCoordenada(longitude, -180, 180, 'Longitude')
    if (lat.error) return { error: lat.error }
    if (lon.error) return { error: lon.error }
    if (lat.absent !== lon.absent) {
        return { error: 'Latitude e longitude devem ser informadas juntas ou ambas deixadas vazias.' }
    }
    if (lat.absent) return { absent: true }
    return { latitude: lat.value, longitude: lon.value, absent: false }
}

exports.searchIncidentReports = async (req, res) => {
    const { date, number, involved, keyword } = req.query
    const query = {}

    const access = await getRequestAccess(req)
    if (!access) return res.status(401).json({ message: 'Conta inexistente ou desativada.' })
    const canViewAll = access.permissions.includes('boletins.view.all')
    if (!canViewAll && !access.permissions.includes('boletins.view.own')) {
        return res.status(403).json({ message: 'Você não possui permissão para consultar boletins.' })
    }
    if (!canViewAll) query.creatorId = req.user.userId

    if (date) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date))) {
            return res.status(400).json({ message: "Informe a data no formato AAAA-MM-DD." })
        }
        let formattedDate = date
        const [year, month, day] = date.split('-')
        formattedDate = `${day}/${month}/${year}`
        if (!isValidIncidentDate(formattedDate)) {
            return res.status(400).json({ message: "Informe uma data válida." })
        }
        query.data = formattedDate
    }
    if (number) query.numero = String(number).trim()
    if (involved) {
        const term = String(involved).trim()
        if (term.length > 100) return res.status(400).json({ message: "O nome para pesquisa deve ter até 100 caracteres." })
        query['envolvidos.nome'] = { $regex: escapeRegex(term), $options: 'i' }
    }
    if (keyword) {
        const term = String(keyword).trim()
        if (term.length > 120) return res.status(400).json({ message: "A palavra-chave deve ter até 120 caracteres." })
        const pattern = { $regex: escapeRegex(term), $options: 'i' }
        query.$or = [
            { natureza: pattern },
            { endereco: pattern },
            { bairro: pattern },
            { referencia: pattern },
            { historicohtml: pattern },
            { 'envolvidos.nome': pattern },
            { 'envolvidos.obs': pattern }
        ]
    }
    if (!date && !number && !involved && !keyword) {
        return res.status(400).json({ message: "Informe ao menos um critério de pesquisa." })
    }

    try {
        const reports = await IncidentReport.find(query).sort({ data: -1, _id: -1 }).limit(200)
        return res.status(200).json(reports)
    } catch (err) {
        return res.status(500).json({ message: "Erro ao pesquisar boletins." })
    }
}

function escapeRegex(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function parseNatureFilterValues(...queryValues) {
    return [...new Set(queryValues
        .flatMap(value => value === undefined || value === null
            ? []
            : (Array.isArray(value) ? value : [value])
                .flatMap(item => String(item).split(',')))
        .map(value => String(value).trim())
        .filter(Boolean))]
}

function isValidNatureFilterValues(values) {
    return values.length <= 1000 && values.every(value =>
        value === 'pendente' || /^[0-9a-fA-F]{24}$/.test(value))
}

exports.incidentReportGeographicOptions = async (req, res) => {
    const municipality = typeof req.query.municipality === 'string'
        ? req.query.municipality.trim()
        : ''
    if (municipality.length > 120) {
        return res.status(400).json({ message: 'Município inválido.' })
    }
    try {
        const [municipalities, natures, neighborhoods] = await Promise.all([
            IncidentReport.distinct('municipio'),
            Natureza.find().select('_id nome ativo').sort({ nome: 1 }).lean(),
            municipality
                ? IncidentReport.distinct('bairro', { municipio: municipality })
                : Promise.resolve([])
        ])
        return res.status(200).json({
            municipalities: municipalities.filter(Boolean).sort((a, b) => a.localeCompare(b, 'pt-BR')),
            neighborhoods: neighborhoods.filter(Boolean).sort((a, b) => a.localeCompare(b, 'pt-BR')),
            natures: natures.map(item => ({
                id: String(item._id),
                nome: item.nome,
                ativo: item.ativo
            }))
        })
    } catch (error) {
        console.error('Erro ao carregar opções do mapa de ocorrências:', error)
        return res.status(500).json({ message: 'Erro ao carregar opções do mapa.' })
    }
}

exports.incidentReportGeographic = async (req, res) => {
    const {
        from, to, municipality, natureId, natureIds: natureIdsQuery, bairro, dateField = 'fact',
        groupBy = 'month', page = '1', pointPage = '1', pageSize = '100', zone, localityType, localityId
    } = req.query
    const selectedNatureValues = parseNatureFilterValues(natureId, natureIdsQuery)
    const startDate = String(from || '')
    const endDate = String(to || '')
    if (!isValidIsoDate(startDate) || !isValidIsoDate(endDate) || startDate > endDate) {
        return res.status(400).json({ message: 'Informe um período válido para o mapa.' })
    }
    if (Date.parse(`${endDate}T00:00:00Z`) - Date.parse(`${startDate}T00:00:00Z`) > 366 * 24 * 60 * 60 * 1000) {
        return res.status(400).json({ message: 'O período do mapa deve ser de no máximo 366 dias.' })
    }
    if (typeof municipality !== 'string' || !municipality.trim() || municipality.length > 120) {
        return res.status(400).json({ message: 'Selecione um município válido.' })
    }
    if (bairro && (typeof bairro !== 'string' || bairro.length > 120)) {
        return res.status(400).json({ message: 'Bairro inválido.' })
    }
    if (dateField !== 'fact' && dateField !== 'registered') {
        return res.status(400).json({ message: 'Tipo de data inválido.' })
    }
    if (!['day', 'week', 'month'].includes(String(groupBy))) {
        return res.status(400).json({ message: 'Agrupamento temporal inválido.' })
    }
    if (!isValidNatureFilterValues(selectedNatureValues)) {
        return res.status(400).json({ message: 'Natureza inválida.' })
    }
    const pageNumber = Number(page)
    const pointPageNumber = Number(pointPage)
    const pageLength = Number(pageSize)
    if (!Number.isSafeInteger(pageNumber) || pageNumber < 1 ||
        !Number.isSafeInteger(pointPageNumber) || pointPageNumber < 1 ||
        !Number.isSafeInteger(pageLength) || pageLength < 1 || pageLength > 100) {
        return res.status(400).json({ message: 'Paginação inválida.' })
    }

    const timezone = dateField === 'registered' ? '-03:00' : 'Z'
    const start = new Date(`${startDate}T00:00:00.000${timezone}`)
    const end = new Date(`${endDate}T23:59:59.999${timezone}`)
    const match = { municipio: municipality.trim() }
    if (bairro) match.bairro = String(bairro).trim()
    if (zone && ['URBANA', 'RURAL', 'NAO_INFORMADA'].includes(zone)) match.zona = zone
    if (localityType && ['BAIRRO', 'POVOADO', 'LOCALIDADE_RURAL', 'VILA', 'DISTRITO', 'ASSENTAMENTO', 'COMUNIDADE', 'OUTRO'].includes(localityType)) match.localidadeTipo = localityType
    if (localityId && mongoose.Types.ObjectId.isValid(localityId)) match.localidadeId = new mongoose.Types.ObjectId(localityId)
    if (dateField === 'registered') match.createdAt = { $gte: start, $lte: end }
    if (dateField === 'fact') {
        match.$and = [{
            $or: [
                { dataOcorrencia: { $gte: start, $lte: end } },
                { dataOcorrencia: { $exists: false } }
            ]
        }]
    }
    const selectedNatureIds = selectedNatureValues
        .filter(value => value !== 'pendente')
        .map(value => new mongoose.Types.ObjectId(value))
    const selectedNatureFacetIds = [
        ...selectedNatureIds,
        ...(selectedNatureValues.includes('pendente') ? [null] : [])
    ]
    if (selectedNatureValues.length) {
        const natureConditions = []
        if (selectedNatureIds.length) {
            natureConditions.push(
                { naturezaIds: { $in: selectedNatureIds } },
                { naturezaId: { $in: selectedNatureIds } }
            )
        }
        if (selectedNatureValues.includes('pendente')) {
            natureConditions.push({
                naturezaId: null,
                $or: [
                    { naturezaIds: { $exists: false } },
                    { naturezaIds: { $size: 0 } }
                ]
            })
        }
        match.$or = natureConditions
    }

    const pipeline = [{ $match: match }]
    if (dateField === 'fact') {
        pipeline.push(
            {
                $addFields: {
                    _mapDate: { $ifNull: ['$dataOcorrencia', {
                        $dateFromString: {
                            dateString: { $ifNull: ['$data', ''] },
                            format: '%d/%m/%Y',
                            onError: null,
                            onNull: null
                        }
                    }] }
                }
            },
            { $match: { _mapDate: { $gte: start, $lte: end } } }
        )
    } else {
        pipeline.push({ $addFields: { _mapDate: '$createdAt' } })
    }

    const coordinateNumber = field => ({
        $convert: { input: `$${field}`, to: 'double', onError: null, onNull: null }
    })
    const coordinateTypeAllowed = field => ({
        $in: [{ $type: `$${field}` }, ['string', 'int', 'long', 'double', 'decimal']]
    })
    const coordinateMissing = field => ({
        $or: [
            { $in: [{ $type: `$${field}` }, ['missing', 'null']] },
            {
                $eq: [
                    {
                        $cond: [
                            { $eq: [{ $type: `$${field}` }, 'string'] },
                            { $trim: { input: `$${field}` } },
                            null
                        ]
                    },
                    ''
                ]
            }
        ]
    })
    pipeline.push(
        {
            $addFields: {
                _mapLatitude: coordinateNumber('latitude'),
                _mapLongitude: coordinateNumber('longitude'),
                _mapLatitudeMissing: coordinateMissing('latitude'),
                _mapLongitudeMissing: coordinateMissing('longitude'),
                _mapLatitudeTypeValid: coordinateTypeAllowed('latitude'),
                _mapLongitudeTypeValid: coordinateTypeAllowed('longitude'),
                _mapNatureIds: {
                    $cond: [
                        { $gt: [{ $size: { $cond: [{ $isArray: '$naturezaIds' }, '$naturezaIds', []] } }, 0] },
                        '$naturezaIds',
                        { $cond: [{ $ne: [{ $ifNull: ['$naturezaId', null] }, null] }, ['$naturezaId'], [null]] }
                    ]
                }
            }
        },
        {
            $addFields: {
                _mapCoordinatesMissing: {
                    $and: ['$_mapLatitudeMissing', '$_mapLongitudeMissing']
                },
                _mapCoordinatesValid: {
                    $and: [
                        { $not: ['$_mapLatitudeMissing'] },
                        { $not: ['$_mapLongitudeMissing'] },
                        '$_mapLatitudeTypeValid',
                        '$_mapLongitudeTypeValid',
                        { $ne: ['$_mapLatitude', null] },
                        { $ne: ['$_mapLongitude', null] },
                        { $gte: ['$_mapLatitude', -90] },
                        { $lte: ['$_mapLatitude', 90] },
                        { $gte: ['$_mapLongitude', -180] },
                        { $lte: ['$_mapLongitude', 180] }
                    ]
                },
                _mapCoordinateStatus: {
                    $switch: {
                        branches: [
                            { case: { $and: ['$_mapLatitudeMissing', '$_mapLongitudeMissing'] }, then: 'missing' },
                            {
                                case: {
                                    $and: [
                                        { $not: ['$_mapLatitudeMissing'] },
                                        { $not: ['$_mapLongitudeMissing'] },
                                        '$_mapLatitudeTypeValid',
                                        '$_mapLongitudeTypeValid',
                                        { $ne: ['$_mapLatitude', null] },
                                        { $ne: ['$_mapLongitude', null] },
                                        { $gte: ['$_mapLatitude', -90] },
                                        { $lte: ['$_mapLatitude', 90] },
                                        { $gte: ['$_mapLongitude', -180] },
                                        { $lte: ['$_mapLongitude', 180] }
                                    ]
                                },
                                then: 'valid'
                            }
                        ],
                        default: 'invalid'
                    }
                }
            }
        },
        {
            $facet: {
                summary: [{
                    $group: {
                        _id: null,
                        totalReports: { $sum: 1 },
                        validCoordinates: { $sum: { $cond: ['$_mapCoordinatesValid', 1, 0] } },
                        missingCoordinates: { $sum: { $cond: ['$_mapCoordinatesMissing', 1, 0] } },
                        invalidCoordinates: {
                            $sum: {
                                $cond: [
                                    { $and: [{ $not: ['$_mapCoordinatesMissing'] }, { $not: ['$_mapCoordinatesValid'] }] },
                                    1,
                                    0
                                ]
                            }
                        }
                    }
                }],
                heat: [
                    { $match: { _mapCoordinatesValid: true } },
                    {
                        $group: {
                            _id: {
                                latitude: { $round: ['$_mapLatitude', 3] },
                                longitude: { $round: ['$_mapLongitude', 3] }
                            },
                            weight: { $sum: 1 }
                        }
                    },
                    { $sort: { weight: -1 } },
                    { $limit: 5001 },
                    { $project: { _id: 0, latitude: '$_id.latitude', longitude: '$_id.longitude', weight: 1 } }
                ],
                points: [
                    { $match: { _mapCoordinatesValid: true } },
                    { $sort: { _mapDate: -1, _id: -1 } },
                    { $skip: (pointPageNumber - 1) * pageLength },
                    { $limit: pageLength },
                    {
                        $project: {
                            _id: 1,
                            numero: 1,
                            data: 1,
                            createdAt: 1,
                            natureza: 1,
                            bairro: 1,
                            localidadeNome: 1,
                            municipio: 1,
                            latitude: '$_mapLatitude',
                            longitude: '$_mapLongitude'
                        }
                    }
                ],
                pointCount: [{ $match: { _mapCoordinatesValid: true } }, { $count: 'value' }],
                records: [
                    { $sort: { _mapDate: -1, _id: -1 } },
                    { $skip: (pageNumber - 1) * pageLength },
                    { $limit: pageLength },
                    {
                        $project: {
                            _id: 1,
                            numero: 1,
                            data: 1,
                            createdAt: 1,
                            natureza: 1,
                            bairro: 1,
                            localidadeNome: 1,
                            municipio: 1,
                            coordinateStatus: '$_mapCoordinateStatus'
                        }
                    }
                ],
                recordCount: [{ $count: 'value' }],
                neighborhoods: [
                    { $match: { _mapCoordinatesValid: true } },
                    { $match: { $expr: { $ne: [{ $ifNull: ['$localidadeNome', '$bairro'] }, ''] } } },
                    { $group: { _id: { $ifNull: ['$localidadeNome', '$bairro'] }, total: { $sum: 1 } } },
                    { $sort: { total: -1, _id: 1 } },
                    { $limit: 100 },
                    { $project: { _id: 0, bairro: '$_id', total: 1 } }
                ],
                neighborhoodCount: [
                    { $match: { _mapCoordinatesValid: true } },
                    { $match: { $expr: { $ne: [{ $ifNull: ['$localidadeNome', '$bairro'] }, ''] } } },
                    { $group: { _id: { $ifNull: ['$localidadeNome', '$bairro'] } } },
                    { $count: 'value' }
                ],
                timeline: [
                    {
                        $group: {
                            _id: groupBy === 'week'
                                ? {
                                    $dateToString: {
                                        format: '%Y-%m-%d',
                                        date: {
                                            $dateTrunc: {
                                                date: '$_mapDate',
                                                unit: 'week',
                                                startOfWeek: 'monday'
                                            }
                                        }
                                    }
                                }
                                : {
                                    $dateToString: {
                                        format: groupBy === 'day' ? '%Y-%m-%d' : '%Y-%m',
                                        date: '$_mapDate'
                                    }
                                },
                            total: { $sum: 1 }
                        }
                    },
                    { $sort: { _id: 1 } },
                    { $limit: 400 },
                    { $project: { _id: 0, periodo: '$_id', total: 1 } }
                ],
                natures: [
                    { $match: { _mapCoordinatesValid: true } },
                    { $unwind: '$_mapNatureIds' },
                    ...(selectedNatureValues.length ? [{
                        $match: { _mapNatureIds: { $in: selectedNatureFacetIds } }
                    }] : []),
                    {
                        $lookup: {
                            from: Natureza.collection.name,
                            localField: '_mapNatureIds',
                            foreignField: '_id',
                            as: '_mapNature'
                        }
                    },
                    {
                        $group: {
                            _id: '$_mapNatureIds',
                            nome: {
                                    $first: {
                                        $cond: [
                                            { $ne: ['$_mapNatureIds', null] },
                                            naturezaDisplayExpression('$_mapNature', '$natureza'),
                                            'Pendente de classificação'
                                        ]
                                    }
                            },
                            total: { $sum: 1 }
                        }
                    },
                    { $sort: { total: -1, nome: 1 } },
                    { $limit: 100 },
                    { $project: { _id: 0, naturezaId: '$_id', natureza: '$nome', total: 1 } }
                ]
            }
        }
    )

    try {
        const [result = {}] = await IncidentReport.aggregate(pipeline).allowDiskUse(true)
        const summary = result.summary?.[0] || {
            totalReports: 0,
            validCoordinates: 0,
            missingCoordinates: 0,
            invalidCoordinates: 0
        }
        const heat = result.heat || []
        const validCoordinates = summary.validCoordinates || 0
        return res.status(200).json({
            filters: {
                from: startDate,
                to: endDate,
                municipality: municipality.trim(),
                natureId: selectedNatureValues.length === 1 ? selectedNatureValues[0] : '',
                natureIds: selectedNatureValues,
                bairro: bairro || '',
                dateField
            },
            summary: {
                totalReports: summary.totalReports || 0,
                validCoordinates,
                missingCoordinates: summary.missingCoordinates || 0,
                invalidCoordinates: summary.invalidCoordinates || 0,
                geoCoveragePercent: summary.totalReports
                    ? Math.round((validCoordinates / summary.totalReports) * 1000) / 10
                    : 0
            },
            heatmap: {
                cells: heat.slice(0, 5000),
                truncated: heat.length > 5000
            },
            points: {
                items: result.points || [],
                page: pointPageNumber,
                pageSize: pageLength,
                total: result.pointCount?.[0]?.value || 0,
                pages: Math.ceil((result.pointCount?.[0]?.value || 0) / pageLength)
            },
            records: {
                items: result.records || [],
                page: pageNumber,
                pageSize: pageLength,
                total: result.recordCount?.[0]?.value || 0,
                pages: Math.ceil((result.recordCount?.[0]?.value || 0) / pageLength)
            },
            neighborhoods: result.neighborhoods || [],
            neighborhoodCount: result.neighborhoodCount?.[0]?.value || 0,
            timeline: result.timeline || [],
            natures: result.natures || [],
            natureCountingRule: 'Uma ocorrência com várias naturezas conta uma vez em cada natureza.'
        })
    } catch (error) {
        console.error('Erro ao consultar dados geográficos dos boletins:', error)
        return res.status(500).json({ message: 'Erro ao carregar dados geográficos.' })
    }
}

exports.incidentReportStatistics = async (req, res) => {
    const { from, to, municipality, nature, natureId, natureIds: natureIdsQuery, zone, localityType, localityId } = req.query
    if (zone && !['URBANA', 'RURAL', 'NAO_INFORMADA'].includes(zone)) return res.status(400).json({ message: 'Zona territorial inválida.' })

    if (localityType && !['BAIRRO', 'POVOADO', 'LOCALIDADE_RURAL', 'VILA', 'DISTRITO', 'ASSENTAMENTO', 'COMUNIDADE', 'OUTRO'].includes(localityType)) return res.status(400).json({ message: 'Tipo de localidade inválido.' })
    if (localityId && !mongoose.Types.ObjectId.isValid(localityId)) return res.status(400).json({ message: 'Identificador de localidade inválido.' })
    const startDate = from || `${new Date().getFullYear()}-01-01`
    const endDate = to || new Date().toISOString().slice(0, 10)

    if (!isValidIsoDate(startDate) || !isValidIsoDate(endDate) || startDate > endDate) {
        return res.status(400).json({ message: "Informe um período válido para as estatísticas." })
    }
    if (municipality && String(municipality).length > 120) {
        return res.status(400).json({ message: "Município inválido." })
    }
    if (nature && String(nature).length > 120) {
        return res.status(400).json({ message: "Natureza inválida." })
    }
    const selectedNatureValues = parseNatureFilterValues(natureId, natureIdsQuery)
    if (!isValidNatureFilterValues(selectedNatureValues)) {
        return res.status(400).json({ message: "Natureza inválida." })
    }

    const start = new Date(`${startDate}T00:00:00.000Z`)
    const end = new Date(`${endDate}T23:59:59.999Z`)
    const match = {}
    if (municipality) match.municipio = String(municipality).trim()
    if (zone && ['URBANA', 'RURAL', 'NAO_INFORMADA'].includes(zone)) match.zona = zone
    if (localityType && ['BAIRRO', 'POVOADO', 'LOCALIDADE_RURAL', 'VILA', 'DISTRITO', 'ASSENTAMENTO', 'COMUNIDADE', 'OUTRO'].includes(localityType)) match.localidadeTipo = localityType
    if (localityId && mongoose.Types.ObjectId.isValid(localityId)) match.localidadeId = new mongoose.Types.ObjectId(localityId)
    if (selectedNatureValues.length) {
        const selectedIds = selectedNatureValues
            .filter(value => value !== 'pendente')
            .map(value => new mongoose.Types.ObjectId(value))
        const natureConditions = []
        if (selectedIds.length) {
            natureConditions.push(
                { naturezaIds: { $in: selectedIds } },
                { naturezaId: { $in: selectedIds } }
            )
        }
        if (selectedNatureValues.includes('pendente')) {
            natureConditions.push({
                naturezaId: null,
                $or: [
                    { naturezaIds: { $exists: false } },
                    { naturezaIds: { $size: 0 } }
                ]
            })
        }
        match.$or = natureConditions
    }
    else if (nature) match.natureza = {
        $regex: `^${escapeRegex(String(nature).trim())}$`,
        $options: 'i'
    }

    try {
        const [result, municipalities, natures, localities] = await Promise.all([
            IncidentReport.aggregate([
                {
                    $match: {
                        ...match,
                        $and: [
                            ...(match.$and || []),
                            {
                                $or: [
                                    { dataOcorrencia: { $gte: start, $lte: end } },
                                    { dataOcorrencia: { $exists: false } }
                                ]
                            }
                        ]
                    }
                },
                {
                    $addFields: {
                        _parsedIncidentDate: {
                            $ifNull: ['$dataOcorrencia', {
                                $dateFromString: {
                                    dateString: { $ifNull: ['$data', ''] },
                                    format: '%d/%m/%Y',
                                    onError: null,
                                    onNull: null
                                }
                            }]
                        }
                    }
                },
                { $match: { _parsedIncidentDate: { $gte: start, $lte: end } } },
                {
                    $facet: {
                        reports: [{ $sort: { _parsedIncidentDate: -1, _id: -1 } }, { $limit: 10000 }],
                        total: [{ $count: 'value' }],
                        natures: [
                            {
                                $set: {
                                    _naturezaIdsParaEstatistica: {
                                        $cond: [
                                            { $gt: [{ $size: { $ifNull: ['$naturezaIds', []] } }, 0] },
                                            '$naturezaIds',
                                            {
                                                $cond: [
                                                    { $ne: [{ $ifNull: ['$naturezaId', null] }, null] },
                                                    ['$naturezaId'],
                                                    [null]
                                                ]
                                            }
                                        ]
                                    }
                                }
                            },
                            { $unwind: '$_naturezaIdsParaEstatistica' },
                            {
                                $lookup: {
                                    from: Natureza.collection.name,
                                    localField: '_naturezaIdsParaEstatistica',
                                    foreignField: '_id',
                                    as: '_naturezaCatalogo'
                                }
                            },
                            {
                                $group: {
                                    _id: { $ifNull: ['$_naturezaIdsParaEstatistica', null] },
                                    natureza: {
                                        $first: {
                                            $cond: [
                                                { $ne: [{ $ifNull: ['$_naturezaIdsParaEstatistica', null] }, null] },
                                                naturezaDisplayExpression('$_naturezaCatalogo', '$natureza'),
                                                'Pendente de classificação'
                                            ]
                                        }
                                    },
                                    total: { $sum: 1 }
                                }
                            },
                            { $sort: { total: -1, natureza: 1 } },
                            { $project: { _id: 0, naturezaId: '$_id', natureza: 1, total: 1 } }
                        ],
                        monthly: [
                            {
                                $group: {
                                    _id: { $dateToString: { format: '%Y-%m', date: '$_parsedIncidentDate' } },
                                    ocorrencias: { $sum: 1 }
                                }
                            },
                            { $sort: { _id: 1 } },
                            { $project: { _id: 0, mes: '$_id', ocorrencias: 1 } }
                        ],
                        involved: [
                            {
                                $group: {
                                    _id: null,
                                    total: { $sum: { $size: { $ifNull: ['$envolvidos', []] } } }
                                }
                            }
                        ],
                        conducoes: [
                            { $unwind: '$envolvidos' },
                            { $match: { 'envolvidos.conduzido': true } },
                            {
                                $set: {
                                    _cpfNormalizado: {
                                        $replaceAll: {
                                            input: {
                                                $replaceAll: {
                                                    input: { $ifNull: ['$envolvidos.cpf', ''] },
                                                    find: '.',
                                                    replacement: ''
                                                }
                                            },
                                            find: '-',
                                            replacement: ''
                                        }
                                    },
                                    _dataNascimento: {
                                        $dateFromString: {
                                            dateString: { $ifNull: ['$envolvidos.nascimento', ''] },
                                            format: '%d/%m/%Y',
                                            onError: null,
                                            onNull: null
                                        }
                                    }
                                }
                            },
                            {
                                $set: {
                                    _idade: {
                                        $cond: [
                                            { $ne: ['$_dataNascimento', null] },
                                            { $subtract: [
                                                { $subtract: [{ $year: new Date() }, { $year: '$_dataNascimento' }] },
                                                {
                                                    $cond: [
                                                        {
                                                            $gt: [
                                                                { $dateToString: { format: '%m%d', date: '$_dataNascimento' } },
                                                                { $dateToString: { format: '%m%d', date: new Date() } }
                                                            ]
                                                        },
                                                        1,
                                                        0
                                                    ]
                                                }
                                            ] },
                                            null
                                        ]
                                    },
                                    _pessoaKey: {
                                        $cond: [
                                            { $eq: [{ $strLenCP: '$_cpfNormalizado' }, 11] },
                                            '$_cpfNormalizado',
                                            { $toString: '$envolvidos._id' }
                                        ]
                                    }
                                }
                            },
                            {
                                $group: {
                                    _id: '$_pessoaKey',
                                    totalConducoes: { $sum: 1 },
                                    sexo: { $first: { $ifNull: ['$envolvidos.sexo', 'Não informado'] } },
                                    idade: { $first: '$_idade' },
                                    identificavel: {
                                        $first: { $eq: [{ $strLenCP: '$_cpfNormalizado' }, 11] }
                                    }
                                }
                            },
                            {
                                $set: {
                                    faixaEtaria: {
                                        $switch: {
                                            branches: [
                                                { case: { $eq: ['$idade', null] }, then: 'Não informada' },
                                                { case: { $lt: ['$idade', 18] }, then: '0-17' },
                                                { case: { $lt: ['$idade', 30] }, then: '18-29' },
                                                { case: { $lt: ['$idade', 45] }, then: '30-44' },
                                                { case: { $lt: ['$idade', 60] }, then: '45-59' }
                                            ],
                                            default: '60+'
                                        }
                                    }
                                }
                            },
                            {
                                $group: {
                                    _id: { sexo: '$sexo', faixaEtaria: '$faixaEtaria' },
                                    pessoas: { $sum: 1 },
                                    pessoasIdentificadas: {
                                        $sum: { $cond: ['$identificavel', 1, 0] }
                                    },
                                    registrosSemCpf: {
                                        $sum: { $cond: ['$identificavel', 0, 1] }
                                    },
                                    totalConducoes: { $sum: '$totalConducoes' },
                                    reincidentes: {
                                        $sum: {
                                            $cond: [
                                                { $and: ['$identificavel', { $gt: ['$totalConducoes', 1] }] },
                                                1,
                                                0
                                            ]
                                        }
                                    }
                                }
                            },
                            {
                                $group: {
                                    _id: null,
                                    total: { $sum: '$totalConducoes' },
                                    pessoasIdentificadas: { $sum: '$pessoasIdentificadas' },
                                    registrosSemCpf: { $sum: '$registrosSemCpf' },
                                    reincidentes: { $sum: '$reincidentes' },
                                    perfis: {
                                        $push: {
                                            sexo: '$_id.sexo',
                                            faixaEtaria: '$_id.faixaEtaria',
                                            pessoas: '$pessoas'
                                        }
                                    }
                                }
                            },
                            { $project: { _id: 0, total: 1, pessoasIdentificadas: 1, registrosSemCpf: 1, reincidentes: 1, perfis: 1 } }
                        ]
                    }
                }
            ]),
            IncidentReport.distinct('municipio'),
            Natureza.find().select('_id nome ativo').sort({ nome: 1 }).lean(),
            Localidade.find({ ativo: true, ...(municipality ? { municipio: String(municipality).trim() } : {}), ...(zone ? { zona } : {}), ...(localityType ? { tipo: localityType } : {}) }).select('_id nome municipio tipo zona').sort({ nome: 1 }).limit(500).lean()
        ])

        const statistics = result[0] || {}
        const total = statistics.total?.[0]?.value || 0
        const conducoesResumo = statistics.conducoes?.[0]
        const porSexo = new Map()
        const porFaixaEtaria = new Map()
        ;(conducoesResumo?.perfis || []).forEach(perfil => {
            porSexo.set(perfil.sexo, (porSexo.get(perfil.sexo) || 0) + perfil.pessoas)
            porFaixaEtaria.set(perfil.faixaEtaria, (porFaixaEtaria.get(perfil.faixaEtaria) || 0) + perfil.pessoas)
        })
        return res.status(200).json({
            filters: {
                from: startDate,
                to: endDate,
                municipality: municipality || '',
                nature: nature || '',
                natureId: selectedNatureValues.length === 1 ? selectedNatureValues[0] : '',
                natureIds: selectedNatureValues
            },
            total,
            truncated: total > (statistics.reports || []).length,
            reports: statistics.reports || [],
            indicators: {
                total,
                involvedCount: statistics.involved?.[0]?.total || 0,
                conducoes: {
                    total: conducoesResumo?.total || 0,
                    pessoasIdentificadas: conducoesResumo?.pessoasIdentificadas || 0,
                    registrosSemCpf: conducoesResumo?.registrosSemCpf || 0,
                    reincidentes: conducoesResumo?.reincidentes || 0,
                    porSexo: Array.from(porSexo, ([sexo, pessoas]) => ({ sexo, pessoas })),
                    porFaixaEtaria: Array.from(porFaixaEtaria, ([faixaEtaria, pessoas]) => ({ faixaEtaria, pessoas }))
                },
                natures: statistics.natures || [],
                pendingNatureCount: (statistics.natures || [])
                    .filter(item => !item.naturezaId)
                    .reduce((totalPendentes, item) => totalPendentes + item.total, 0),
                monthly: statistics.monthly || []
            },
            options: {
                municipalities: municipalities.filter(Boolean).sort((a, b) => a.localeCompare(b, 'pt-BR')),
                natures: natures.map(item => ({
                    id: String(item._id),
                    nome: item.nome,
                    ativo: item.ativo
                })),
                localities: localities.map(({ _id, nome, municipio, tipo, zona }) => ({ id: String(_id), nome, municipio, tipo, zona })),
                zones: ['URBANA', 'RURAL', 'NAO_INFORMADA'],
                localityTypes: ['BAIRRO', 'POVOADO', 'LOCALIDADE_RURAL', 'VILA', 'DISTRITO', 'ASSENTAMENTO', 'COMUNIDADE', 'OUTRO']
            }
        })
    } catch (err) {
        console.error('Erro ao calcular estatísticas dos boletins:', err)
        return res.status(500).json({ message: "Erro ao calcular estatísticas dos boletins." })
    }
}

function isValidIsoDate(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
    const [year, month, day] = value.split('-').map(Number)
    const date = new Date(year, month - 1, day)
    return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
}
