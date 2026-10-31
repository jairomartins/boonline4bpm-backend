const test = require('node:test')
const assert = require('node:assert/strict')
const { classifyNature, classifyWeapon, classifyDrug, normalizeDrugAmount, summarize, SLOTS } = require('./operationalStatistics')

test('classifica CVLI oficial sem incluir tentativa ou morte acidental', () => {
    assert.deepEqual(classifyNature('Homicídio doloso'), ['cvli'])
    assert.deepEqual(classifyNature('Feminicídio'), ['cvli'])
    assert.deepEqual(classifyNature('Tentativa de homicídio'), [])
    assert.deepEqual(classifyNature('Morte acidental'), [])
})

test('classifica ocorrências por arma e acidentes sem duplicar naturezas no total', () => {
    const result = summarize([{
        data: '29/10/2026', horario: '19:10', naturezaNames: ['Porte ilegal de arma de fogo', 'Disparo de arma de fogo'],
        bairro: 'Centro', municipio: 'Balsas', latitude: '-7.53', longitude: '-46.04', materiaisApreendidos: [],
    }], { module: 'firearms', filters: { from: '2026-10-01', to: '2026-10-31' } })
    assert.equal(result.total, 1)
    assert.equal(result.temporalTotal, 1)
    assert.equal(result.natures.reduce((sum, item) => sum + item.total, 0), 2)
    assert.equal(result.temporalGrid.flat().length, 56)
    assert.equal(SLOTS.length, 8)
})

test('conta armas por quantidade registrada e omite simulacros', () => {
    const result = summarize([{
        data: '29/10/2026', horario: '09:30', naturezaNames: [], municipio: 'Balsas', bairro: 'Centro',
        latitude: '', longitude: '', materiaisApreendidos: [
            { tipoItem: 'arma_fogo', quantidade: '2', dadosArma: { especie: 'Revólver', calibreReal: '.38' } },
            { tipoItem: 'arma_fogo', dadosArma: { especie: 'Pistola simulacro' } },
        ],
    }], { module: 'seizedFirearms', filters: { from: '2026-10-01', to: '2026-10-31' } })
    assert.equal(result.total, 1)
    assert.equal(result.occurrencesWithSeizure, 1)
    assert.equal(result.totalSeized, 2)
    assert.equal(result.weaponTypes[0].type, 'Revólver')
    assert.equal(result.monthly[0].quantity, 2)
    assert.equal(result.quality.missingCoordinates, 1)
})

test('não estima quantidade quando o campo da arma contém valor inválido', () => {
    const result = summarize([{
        data: '29/10/2026', horario: '09:30', naturezaNames: [],
        materiaisApreendidos: [{ tipoItem: 'arma_fogo', quantidade: '1,5', dadosArma: { especie: 'Pistola' } }],
    }], { module: 'seizedFirearms', filters: { from: '2026-10-01', to: '2026-10-31' } })
    assert.equal(result.occurrencesWithSeizure, 1)
    assert.equal(result.totalSeized, 0)
    assert.equal(result.quality.missingQuantity, 1)
})

test('normaliza apenas unidades de peso comparáveis e separa contagens', () => {
    assert.equal(normalizeDrugAmount('1,5', 'kg').grams, 1500)
    assert.equal(normalizeDrugAmount(500, 'mg').grams, 0.5)
    assert.equal(normalizeDrugAmount(120, 'comprimidos').grams, null)
    assert.equal(classifyDrug('Cannabis / Maconha'), 'Maconha')
    assert.equal(classifyWeapon('Fuzil'), 'Fuzil')
})

test('CVLI e acidentes contam boletins distintos e não inferem vítimas', () => {
    const records = [
        { data: '29/10/2026', horario: '12:00', naturezaNames: ['Homicídio - Doloso', 'Latrocínio'], materiaisApreendidos: [] },
        { data: '30/10/2026', horario: '15:30', naturezaNames: ['Acidente de trânsito (Com pessoa ferida ou morta)'], materiaisApreendidos: [] },
        { data: '31/10/2026', horario: '15:30', naturezaNames: ['Homicídio - Culposo'], materiaisApreendidos: [] },
    ]
    const cvli = summarize(records, { module: 'cvli', filters: { from: '2026-10-01', to: '2026-10-31' } })
    const traffic = summarize(records, { module: 'traffic', filters: { from: '2026-10-01', to: '2026-10-31' } })
    assert.equal(cvli.total, 1)
    assert.equal(cvli.victims, null)
    assert.equal(traffic.total, 1)
})

test('drogas mantêm unidades distintas, filtram substância e contabilizam massa sem inferências', () => {
    const result = summarize([{
        data: '29/10/2026', horario: '03:10', naturezaNames: [], municipio: 'Balsas', bairro: 'Centro',
        latitude: '-7.5', longitude: '-46.0', materiaisApreendidos: [
            { tipoItem: 'droga', dadosDroga: { tipoDroga: 'Maconha', quantidade: 1, unidade: 'kg' } },
            { tipoItem: 'droga', dadosDroga: { tipoDroga: 'Cocaína', quantidade: 500, unidade: 'mg' } },
            { tipoItem: 'droga', dadosDroga: { tipoDroga: 'Ecstasy', quantidade: 12, unidade: 'comprimidos' } },
        ],
    }], { module: 'seizedDrugs', filters: { from: '2026-10-01', to: '2026-10-31', mapMetric: 'quantity', drugType: 'Maconha', drugUnit: 'kg' } })
    assert.equal(result.total, 1)
    assert.equal(result.totalGrams, 1000)
    assert.equal(result.temporalTotal, 1)
    assert.equal(result.mapPoints[0].weight, 1)
    assert.deepEqual(result.drugAmounts, [{ type: 'Maconha', unit: 'kg', amount: 1 }])
    assert.deepEqual(result.monthlyDrugAmounts, [{ month: '2026-10', type: 'Maconha', unit: 'kg', amount: 1 }])
})

test('filtros temporais combinados e dados de qualidade são preservados', () => {
    const records = [
        { data: '29/10/2026', horario: '19:10', naturezaNames: ['Homicídio - Doloso'], municipio: 'Balsas', bairro: 'Centro', materiaisApreendidos: [] },
        { data: '29/10/2026', horario: '07:10', naturezaNames: ['Homicídio - Doloso'], municipio: 'Balsas', bairro: 'Centro', materiaisApreendidos: [] },
        { data: 'data inválida', horario: '', naturezaNames: [], municipio: 'Balsas', bairro: 'Centro', materiaisApreendidos: [] },
    ]
    const result = summarize(records, { module: 'cvli', filters: { from: '2026-10-01', to: '2026-10-31', municipality: 'Balsas', neighborhood: 'Centro', weekday: 4, shift: 'Noite' } })
    assert.equal(result.total, 1)
    assert.equal(result.quality.invalidDate, 1)
    assert.equal(result.temporalGrid.flat().length, 56)
})

test('mantém contagens consistentes em lote sintético de 10 mil boletins', () => {
    const row = { data: '29/10/2026', horario: '20:15', naturezaNames: ['Homicídio - Doloso'], municipio: 'Balsas', bairro: 'Centro', latitude: '-7.5', longitude: '-46.0', materiaisApreendidos: [] }
    const result = summarize(Array.from({ length: 10000 }, () => row), { module: 'cvli', filters: { from: '2026-10-01', to: '2026-10-31' } })
    assert.equal(result.total, 10000)
    assert.equal(result.temporalTotal, 10000)
    assert.equal(result.mapPoints[0].weight, 10000)
})
