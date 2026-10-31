const { normalizarNatureza } = require('./natureza')

const MODULES = ['firearms', 'cvli', 'traffic', 'seizedFirearms', 'seizedDrugs']
const WEEKDAYS = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado']
const SLOTS = Array.from({ length: 8 }, (_, i) => ({ start: i * 3, end: i * 3 + 2, label: `${String(i * 3).padStart(2, '0')}h–${String(i * 3 + 2).padStart(2, '0')}h59` }))

function normalizeText(value) {
    return normalizarNatureza(String(value || '')).replace(/[^a-z0-9]+/g, ' ').trim()
}

function classifyNature(name) {
    const text = normalizeText(name)
    if (!text) return []
    const isAttempt = /tentativa|tentado|tentada/.test(text)
    const categories = []
    if (/arma de fogo|porte ilegal.*arma|posse irregular.*arma|disparo de arma|comercio ilegal.*arma|trafico internacional.*arma/.test(text)) categories.push('firearms')
    if (!isAttempt && /homicidio doloso|feminicidio|latrocinio|lesao corporal seguida de morte/.test(text)) categories.push('cvli')
    if (/acidente de transito|colisao|atropelamento|capotamento|tombamento/.test(text)) categories.push('traffic')
    return categories
}

function classifyWeapon(value) {
    const text = normalizeText(value)
    if (!text) return 'Não informado'
    if (/simulacro|airsoft|paintball/.test(text)) return 'Simulacro (excluído)'
    if (/artesanal|caseira/.test(text)) return 'Arma artesanal'
    for (const [pattern, label] of [[/revolver/, 'Revólver'], [/pistola/, 'Pistola'], [/espingarda/, 'Espingarda'], [/carabina/, 'Carabina'], [/rifle/, 'Rifle'], [/fuzil/, 'Fuzil']]) {
        if (pattern.test(text)) return label
    }
    return 'Outros tipos'
}

function classifyDrug(value) {
    const text = normalizeText(value)
    if (!text) return 'Não informado'
    for (const [pattern, label] of [[/maconha|cannabis/, 'Maconha'], [/cocaina|coca/, 'Cocaína'], [/crack/, 'Crack'], [/haxixe/, 'Haxixe'], [/ecstasy|mdma/, 'Ecstasy/MDMA'], [/lsd/, 'LSD']]) {
        if (pattern.test(text)) return label
    }
    return 'Outras substâncias'
}

function parseQuantity(value) {
    if (typeof value === 'number' && Number.isFinite(value) && value >= 0) return value
    if (typeof value !== 'string' || !value.trim()) return null
    const parsed = Number(value.trim().replace(',', '.'))
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : null
}

function firearmQuantity(item) {
    if (item.quantidade === undefined || item.quantidade === null || item.quantidade === '') return 1
    const quantity = parseQuantity(item.quantidade)
    return quantity !== null && Number.isInteger(quantity) ? quantity : null
}

function normalizeDrugAmount(quantity, unit) {
    const amount = parseQuantity(quantity)
    const normalizedUnit = normalizeText(unit)
    if (amount === null || !normalizedUnit) return { amount: null, unit: normalizedUnit || 'Não informado', grams: null }
    if (['kg', 'quilo', 'quilograma', 'quilogramas'].includes(normalizedUnit)) return { amount, unit: 'kg', grams: amount * 1000 }
    if (['g', 'grama', 'gramas'].includes(normalizedUnit)) return { amount, unit: 'g', grams: amount }
    if (['mg', 'miligramas'].includes(normalizedUnit)) return { amount, unit: 'mg', grams: amount / 1000 }
    if (/comprimido|unidade|porcao|papelote|pedra|microponto|frasco|ml/.test(normalizedUnit)) return { amount, unit: unit.trim(), grams: null }
    return { amount, unit: unit.trim(), grams: null }
}

function parseOccurrenceDate(report) {
    if (report.dataOcorrencia instanceof Date && !Number.isNaN(report.dataOcorrencia.getTime())) {
        return new Date(Date.UTC(report.dataOcorrencia.getUTCFullYear(), report.dataOcorrencia.getUTCMonth(), report.dataOcorrencia.getUTCDate()))
    }
    const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(String(report.data || '').trim())
    if (!match) return null
    const [, dd, mm, yyyy] = match
    const date = new Date(Date.UTC(Number(yyyy), Number(mm) - 1, Number(dd)))
    return date.getUTCDate() === Number(dd) && date.getUTCMonth() === Number(mm) - 1 ? date : null
}

function parseHour(value) {
    const match = /^(\d{1,2}):(\d{2})/.exec(String(value || '').trim())
    if (!match) return null
    const hour = Number(match[1]); const minute = Number(match[2])
    return hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59 ? hour : null
}

function shiftFor(hour) {
    if (hour < 6) return 'Madrugada'
    if (hour < 12) return 'Manhã'
    if (hour < 18) return 'Tarde'
    return 'Noite'
}

function emptyMap() { return new Map() }
function increment(map, key, amount = 1) { if (key !== undefined && key !== null && key !== '') map.set(key, (map.get(key) || 0) + amount) }
function sorted(map, keyName, countName = 'total') { return [...map].map(([key, total]) => ({ [keyName]: key, [countName]: total })).sort((a, b) => b[countName] - a[countName] || String(a[keyName]).localeCompare(String(b[keyName]), 'pt-BR')) }

function summarize(records, options = {}) {
    const module = options.module
    if (!MODULES.includes(module)) throw new Error('Módulo operacional inválido.')
    const filters = options.filters || {}
    const stats = {
        total: 0, occurrencesWithSeizure: 0, victims: null,
        monthly: emptyMap(), monthlyQuantity: emptyMap(), monthlyDrugAmounts: emptyMap(), weekdays: new Map(WEEKDAYS.map((day) => [day, 0])), hours: new Map(SLOTS.map((slot) => [slot.label, 0])),
        neighborhoods: emptyMap(), municipalities: emptyMap(), natures: emptyMap(), trafficTypes: emptyMap(), weaponTypes: emptyMap(), calibers: emptyMap(), drugs: emptyMap(), drugAmounts: emptyMap(),
        grid: Array.from({ length: 7 }, (_, weekday) => SLOTS.map((slot, slotIndex) => ({ weekday, slot: slotIndex, label: slot.label, total: 0, quantity: 0 }))),
        map: emptyMap(), missingCoordinates: 0, invalidCoordinates: 0, missingDateTime: 0, invalidDate: 0, invalidTime: 0,
        missingQuantity: 0, ambiguousMaterials: 0, unclassifiedNatureCount: 0,
    }
    const start = filters.from ? new Date(`${filters.from}T00:00:00Z`) : null
    const end = filters.to ? new Date(`${filters.to}T23:59:59.999Z`) : null
    const natureFilter = normalizeText(filters.nature || '')
    for (const report of records) {
        const date = parseOccurrenceDate(report)
        const hour = parseHour(report.horario)
        if (!date) { stats.invalidDate++; continue }
        if (start && date < start || end && date > end) continue
        if (filters.municipality && normalizeText(report.municipio) !== normalizeText(filters.municipality)) continue
        if (filters.neighborhood && normalizeText(report.localidadeNome || report.bairro) !== normalizeText(filters.neighborhood)) continue
        if (filters.zone && report.zona !== filters.zone) continue
        if (filters.localityType && report.localidadeTipo !== filters.localityType) continue
        if (filters.localityId && String(report.localidadeId || '') !== String(filters.localityId)) continue
        if (natureFilter && !normalizeText(report.naturezaNames?.join(' ')).includes(natureFilter)) continue
        if (hour === null) stats.invalidTime++
        if (filters.weekday !== undefined && filters.weekday !== '' && Number(filters.weekday) !== date.getUTCDay()) continue
        if (filters.shift && hour !== null && filters.shift !== shiftFor(hour)) continue
        const fromHour = filters.hourFrom === '' || filters.hourFrom === undefined ? null : Number(filters.hourFrom)
        const toHour = filters.hourTo === '' || filters.hourTo === undefined ? null : Number(filters.hourTo)
        if (hour !== null && (fromHour !== null && hour < fromHour || toHour !== null && hour > toHour)) continue

        const names = Array.isArray(report.naturezaNames) ? report.naturezaNames : []
        const categories = [...new Set(names.flatMap(classifyNature))];
        if (!categories.length) stats.unclassifiedNatureCount++
        let materials = Array.isArray(report.materiaisApreendidos) ? report.materiaisApreendidos : []
        stats.ambiguousMaterials += materials.filter((item) => !item.tipoItem && /arma|droga|entorpecente/.test(normalizeText(item.descricao))).length
        let firearmItems = materials.filter((item) => item.tipoItem === 'arma_fogo' || (!item.tipoItem && /arma de fogo/.test(normalizeText(item.descricao))))
        firearmItems = firearmItems.filter((item) => classifyWeapon(item.dadosArma?.especie || item.dadosArma?.modelo || item.descricao) !== 'Simulacro (excluído)')
        let drugItems = materials.filter((item) => item.tipoItem === 'droga')
        if (filters.weaponType) firearmItems = firearmItems.filter((item) => classifyWeapon(item.dadosArma?.especie || item.dadosArma?.modelo || item.descricao) === filters.weaponType)
        if (filters.drugType) drugItems = drugItems.filter((item) => classifyDrug(item.dadosDroga?.tipoDroga || item.dadosDroga?.substancia) === filters.drugType)
        if (filters.drugUnit) drugItems = drugItems.filter((item) => normalizeDrugAmount(item.dadosDroga?.quantidade, item.dadosDroga?.unidade).unit === filters.drugUnit)
        const included = module === 'firearms' ? categories.includes('firearms')
            : module === 'cvli' ? categories.includes('cvli')
                : module === 'traffic' ? categories.includes('traffic')
                    : module === 'seizedFirearms' ? firearmItems.length > 0
                        : drugItems.length > 0
        if (!included) continue
        stats.total++
        const dayName = WEEKDAYS[date.getUTCDay()]
        const month = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`
        increment(stats.monthly, month)
        increment(stats.weekdays, dayName)
        increment(stats.neighborhoods, report.localidadeNome || report.bairro || 'Não informado')
        increment(stats.municipalities, report.municipio || 'Não informado')
        for (const name of names) if (module === 'firearms' && categories.includes('firearms') || module === 'cvli' && categories.includes('cvli') || module === 'traffic' && categories.includes('traffic')) increment(stats.natures, name)
        if (module === 'traffic') {
            for (const name of names) {
                const normalized = normalizeText(name)
                if (/apenas danos materiais/.test(normalized)) increment(stats.trafficTypes, 'Sem vítimas (danos materiais)')
                else if (/acidente.*fatal|acidente.*com morte|vitima fatal/.test(normalized)) increment(stats.trafficTypes, 'Fatais explicitamente classificados')
                else if (/com pessoa ferida ou morta|com vitima|com feridos|atropelamento.*vitima/.test(normalized)) increment(stats.trafficTypes, 'Com vítimas (fatalidade não distinguida)')
            }
        }
        let seizedQuantity = 0
        if (hour === null) stats.missingDateTime++
        else {
            const slotIndex = Math.floor(hour / 3)
            const slot = SLOTS[slotIndex]
            increment(stats.hours, slot.label)
            stats.grid[date.getUTCDay()][slotIndex].total++
        }
        if (module === 'seizedFirearms') {
            let weapons = 0
            stats.occurrencesWithSeizure++
            for (const item of firearmItems) {
                const type = classifyWeapon(item.dadosArma?.especie || item.dadosArma?.modelo || item.descricao)
                // One typed subdocument represents one firearm only when it has no quantity field.
                const quantity = firearmQuantity(item)
                if (quantity === null) { stats.missingQuantity++; continue }
                weapons += quantity
                increment(stats.weaponTypes, type, quantity)
                increment(stats.calibers, item.dadosArma?.calibreReal || 'Não informado', quantity)
            }
            stats._materialWeight = (stats._materialWeight || 0) + weapons
            increment(stats.monthlyQuantity, month, weapons)
            seizedQuantity = weapons
        }
        if (module === 'seizedDrugs') {
            stats.occurrencesWithSeizure++
            for (const item of drugItems) {
                const data = item.dadosDroga || {}
                const type = classifyDrug(data.tipoDroga || data.substancia)
                const normalized = normalizeDrugAmount(data.quantidade, data.unidade)
                increment(stats.drugs, type)
                if (normalized.amount === null) stats.missingQuantity++
                else increment(stats.drugAmounts, `${type}|${normalized.unit}`, normalized.amount)
                if (normalized.grams !== null) stats._grams = (stats._grams || 0) + normalized.grams
                if (normalized.amount !== null) increment(stats.monthlyDrugAmounts, `${month}|${type}|${normalized.unit}`, normalized.amount)
                if (filters.drugUnit && normalized.unit === filters.drugUnit && normalized.amount !== null) seizedQuantity += normalized.amount
            }
        }
        if (hour !== null) stats.grid[date.getUTCDay()][Math.floor(hour / 3)].quantity += seizedQuantity
        const latitude = Number(String(report.latitude ?? '').replace(',', '.'))
        const longitude = Number(String(report.longitude ?? '').replace(',', '.'))
        if (!String(report.latitude ?? '').trim() || !String(report.longitude ?? '').trim()) stats.missingCoordinates++
        else if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) stats.invalidCoordinates++
        else {
            const key = `${latitude.toFixed(3)},${longitude.toFixed(3)}`
            const weight = filters.mapMetric === 'quantity' && module === 'seizedFirearms'
                ? firearmItems.reduce((sum, item) => sum + (firearmQuantity(item) || 0), 0)
                : filters.mapMetric === 'quantity' && module === 'seizedDrugs' && filters.drugUnit
                    ? drugItems.reduce((sum, item) => { const value = normalizeDrugAmount(item.dadosDroga?.quantidade, item.dadosDroga?.unidade); return sum + (value.unit === filters.drugUnit ? value.amount || 0 : 0) }, 0)
                    : 1
            increment(stats.map, key, weight)
        }
    }
    const max = Math.max(...stats.grid.flat().map((cell) => filters.mapMetric === 'quantity' ? cell.quantity : cell.total), 0)
    return {
        module, total: stats.total,
        occurrencesWithSeizure: stats.occurrencesWithSeizure,
        totalSeized: module === 'seizedFirearms' ? stats._materialWeight || 0 : undefined,
        victims: stats.victims,
        monthly: sorted(stats.monthly, 'month').map((row) => ({ ...row, quantity: stats.monthlyQuantity.get(row.month) || 0 })),
        monthlyDrugAmounts: sorted(stats.monthlyDrugAmounts, 'group', 'amount').map((row) => { const [month, type, unit] = row.group.split('|'); return { month, type, unit, amount: row.amount } }),
        weekdays: sorted(stats.weekdays, 'weekday'), hours: sorted(stats.hours, 'interval'),
        neighborhoods: sorted(stats.neighborhoods, 'neighborhood').slice(0, 10), neighborhoodCount: stats.neighborhoods.size, municipalities: sorted(stats.municipalities, 'municipality'), natures: sorted(stats.natures, 'nature'), trafficTypes: sorted(stats.trafficTypes, 'type'),
        weaponTypes: sorted(stats.weaponTypes, 'type'), calibers: sorted(stats.calibers, 'caliber'),
        drugs: sorted(stats.drugs, 'type', 'items'), drugAmounts: sorted(stats.drugAmounts, 'group', 'amount').map((row) => {
            const [type, unit] = row.group.split('|'); return { type, unit, amount: row.amount }
        }), totalGrams: module === 'seizedDrugs' ? stats._grams || 0 : undefined,
        temporalGrid: stats.grid.map((row) => row.map((cell) => { const value = filters.mapMetric === 'quantity' ? cell.quantity : cell.total; return { ...cell, total: value, occurrences: cell.total, quantity: cell.quantity, weekdayName: WEEKDAYS[cell.weekday], intensity: max ? value / max : 0 } })),
        mapPoints: [...stats.map].map(([key, weight]) => { const [latitude, longitude] = key.split(',').map(Number); return { latitude, longitude, weight } }).slice(0, 5000),
        quality: { missingCoordinates: stats.missingCoordinates, invalidCoordinates: stats.invalidCoordinates, invalidDate: stats.invalidDate, invalidTime: stats.invalidTime, missingDateTime: stats.missingDateTime, missingQuantity: stats.missingQuantity, ambiguousMaterials: stats.ambiguousMaterials, unclassifiedNatureCount: stats.unclassifiedNatureCount },
        timezone: 'America/Fortaleza', temporalTotal: stats.grid.flat().reduce((sum, cell) => sum + (filters.mapMetric === 'quantity' ? cell.quantity : cell.total), 0),
        categories: { weaponTypes: sorted(stats.weaponTypes, 'type'), drugTypes: sorted(stats.drugs, 'type', 'items') },
    }
}

module.exports = { MODULES, WEEKDAYS, SLOTS, classifyNature, classifyWeapon, classifyDrug, normalizeDrugAmount, parseOccurrenceDate, parseHour, summarize }
