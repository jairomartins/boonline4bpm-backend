const IncidentReport = require('../model/boletim')
const Natureza = require('../model/natureza')
const Localidade = require('../model/localidade')
const { MODULES, summarize } = require('../utils/operationalStatistics')

const validDate = (value) => {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
    const date = new Date(`${value}T00:00:00Z`)
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
}

async function operationalStatistics(req, res) {
    const { from, to, module, municipality, neighborhood, nature, weekday, hourFrom, hourTo, shift, weaponType, drugType, drugUnit, mapMetric = 'occurrences', zone, localityType, localityId } = req.query
    if (!MODULES.includes(String(module))) return res.status(400).json({ message: 'Módulo estatístico inválido.' })
    if (zone && !['URBANA', 'RURAL', 'NAO_INFORMADA'].includes(zone)) return res.status(400).json({ message: 'Zona territorial inválida.' })
    if (localityType && !['BAIRRO', 'POVOADO', 'LOCALIDADE_RURAL', 'VILA', 'DISTRITO', 'ASSENTAMENTO', 'COMUNIDADE', 'OUTRO'].includes(localityType)) return res.status(400).json({ message: 'Tipo de localidade inválido.' })
    if (localityId && !/^[0-9a-f]{24}$/i.test(localityId)) return res.status(400).json({ message: 'Identificador de localidade inválido.' })
    if (!validDate(from) || !validDate(to) || from > to) return res.status(400).json({ message: 'Informe um intervalo de datas válido.' })
    if (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`) > 366 * 86400000) return res.status(400).json({ message: 'O intervalo máximo é de 366 dias.' })
    for (const [label, value, limit] of [['Município', municipality, 120], ['Bairro', neighborhood, 120], ['Natureza', nature, 120], ['Turno', shift, 20], ['Tipo de arma', weaponType, 60], ['Tipo de droga', drugType, 60]]) {
        if (value !== undefined && (typeof value !== 'string' || value.length > limit)) return res.status(400).json({ message: `${label} inválido.` })
    }
    const parsedWeekday = weekday === undefined || weekday === '' ? undefined : Number(weekday)
    const parsedHourFrom = hourFrom === undefined || hourFrom === '' ? '' : Number(hourFrom)
    const parsedHourTo = hourTo === undefined || hourTo === '' ? '' : Number(hourTo)
    if (parsedWeekday !== undefined && (!Number.isInteger(parsedWeekday) || parsedWeekday < 0 || parsedWeekday > 6)) return res.status(400).json({ message: 'Dia da semana inválido.' })
    if (parsedHourFrom !== '' && (!Number.isInteger(parsedHourFrom) || parsedHourFrom < 0 || parsedHourFrom > 23)) return res.status(400).json({ message: 'Hora inicial inválida.' })
    if (parsedHourTo !== '' && (!Number.isInteger(parsedHourTo) || parsedHourTo < 0 || parsedHourTo > 23 || (parsedHourFrom !== '' && parsedHourTo < parsedHourFrom))) return res.status(400).json({ message: 'Hora final inválida.' })
    if (shift && !['Madrugada', 'Manhã', 'Tarde', 'Noite'].includes(shift)) return res.status(400).json({ message: 'Turno inválido.' })
    if (!['occurrences', 'quantity'].includes(mapMetric)) return res.status(400).json({ message: 'Métrica de mapa/matriz inválida.' })
    if (drugUnit !== undefined && (typeof drugUnit !== 'string' || drugUnit.length > 40)) return res.status(400).json({ message: 'Unidade da droga inválida.' })
    if (module === 'seizedDrugs' && mapMetric === 'quantity' && (!drugType || !drugUnit)) return res.status(400).json({ message: 'Selecione a substância e a unidade para analisar quantidades.' })

    const start = new Date(`${from}T00:00:00.000Z`)
    const end = new Date(`${to}T23:59:59.999Z`)
    const match = {}
    if (municipality) match.municipio = municipality.trim()
    if (neighborhood) match.$and = [{ $or: [{ bairro: neighborhood.trim() }, { localidadeNome: neighborhood.trim() }] }]
    if (zone) match.zona = zone
    if (localityType) match.localidadeTipo = localityType
    if (localityId) match.localidadeId = new (require('mongoose').Types.ObjectId)(localityId)
    // Keep the indexed current field path and include legacy string dates only when the field is absent.
    match.$or = [
        { dataOcorrencia: { $gte: start, $lte: end } },
        { dataOcorrencia: { $exists: false } },
        { dataOcorrencia: { $type: 'string' } },
    ]
    const pipeline = [
        { $match: match },
        { $set: {
            _statsDate: { $ifNull: [{ $convert: { input: '$dataOcorrencia', to: 'date', onError: null, onNull: null } }, { $dateFromString: { dateString: { $ifNull: ['$data', ''] }, format: '%d/%m/%Y', onError: null, onNull: null } }] },
            _statsNatureIds: { $cond: [{ $gt: [{ $size: { $cond: [{ $isArray: '$naturezaIds' }, '$naturezaIds', []] } }, 0] }, '$naturezaIds', { $cond: [{ $ne: [{ $ifNull: ['$naturezaId', null] }, null] }, ['$naturezaId'], []] }] },
        } },
        { $match: { $or: [{ _statsDate: { $gte: start, $lte: end } }, { _statsDate: null }] } },
        { $lookup: { from: Natureza.collection.name, localField: '_statsNatureIds', foreignField: '_id', as: '_statsNatures' } },
        { $project: {
            _id: 0, data: 1, dataOcorrencia: '$_statsDate', horario: 1,
            municipio: 1, bairro: { $ifNull: ['$localidadeNome', '$bairro'] }, localidadeId: 1, localidadeTipo: 1, zona: 1, latitude: 1, longitude: 1,
            natureza: 1, naturezaNames: { $map: { input: '$_statsNatures', as: 'n', in: '$$n.nome' } },
            materiaisApreendidos: { $map: {
                input: { $cond: [{ $isArray: '$materiaisApreendidos' }, '$materiaisApreendidos', []] },
                as: 'material',
                in: {
                    tipoItem: '$$material.tipoItem', quantidade: '$$material.quantidade', descricao: '$$material.descricao',
                    dadosArma: { especie: '$$material.dadosArma.especie', modelo: '$$material.dadosArma.modelo', calibreReal: '$$material.dadosArma.calibreReal' },
                    dadosDroga: { tipoDroga: '$$material.dadosDroga.tipoDroga', substancia: '$$material.dadosDroga.substancia', quantidade: '$$material.dadosDroga.quantidade', unidade: '$$material.dadosDroga.unidade' },
                },
            } },
        } },
    ]
    const filters = { from, to, municipality, neighborhood, nature, weekday: parsedWeekday, hourFrom: parsedHourFrom, hourTo: parsedHourTo, shift, weaponType, drugType, drugUnit, mapMetric, zone, localityType, localityId }
    try {
        const [records, municipalities, neighborhoods, natures, localities] = await Promise.all([
            IncidentReport.aggregate(pipeline).allowDiskUse(true),
            IncidentReport.distinct('municipio'),
            IncidentReport.distinct('bairro', municipality ? { municipio: municipality } : {}),
            Natureza.find({ ativo: true }).select('_id nome').sort({ nome: 1 }).lean(),
            Localidade.find({ ativo: true, ...(municipality ? { municipio: municipality } : {}), ...(zone ? { zona } : {}), ...(localityType ? { tipo: localityType } : {}) }).select('_id nome municipio tipo zona').sort({ nome: 1 }).limit(500).lean(),
        ])
        for (const record of records) {
            if (!record.naturezaNames?.length) record.naturezaNames = String(record.natureza || '').split(';').map((value) => value.trim()).filter(Boolean)
        }
        const result = summarize(records, { module, filters })
        const canViewMap = Boolean(req.access?.permissions?.includes('map.view'))
        if (!canViewMap) result.mapPoints = []
        return res.status(200).json({
            ...result,
            options: {
                municipalities: municipalities.filter(Boolean).sort((a, b) => a.localeCompare(b, 'pt-BR')),
                neighborhoods: neighborhoods.filter(Boolean).sort((a, b) => a.localeCompare(b, 'pt-BR')),
                natures: natures.map(({ _id, nome }) => ({ id: String(_id), nome })),
                localities: localities.map(({ _id, nome, municipio, tipo, zona }) => ({ id: String(_id), nome, municipio, tipo, zona })),
                zones: ['URBANA', 'RURAL', 'NAO_INFORMADA'],
            },
            permissions: { map: canViewMap },
        })
    } catch (error) {
        console.error('Erro ao calcular estatísticas operacionais:', error)
        return res.status(500).json({ message: 'Não foi possível calcular as estatísticas operacionais.' })
    }
}

module.exports = { operationalStatistics }
