const fs = require('node:fs')
const path = require('node:path')
const PDFDocument = require('pdfkit')
const QRCode = require('qrcode')

const PAGE_WIDTH = 595.28
const PAGE_HEIGHT = 841.89
const LEFT = 48
const RIGHT = 48
const TOP = 118
const BOTTOM = 42
const CONTENT_WIDTH = PAGE_WIDTH - LEFT - RIGHT
const PMMA_LOGO = fs.readFileSync(path.join(__dirname, '../assets/logo_pmma.png'))
const BATTALION_LOGO = fs.readFileSync(path.join(__dirname, '../assets/logo_4bpm.png'))

const INVOLVED_FIELDS = [
    ['tipo', 'Tipo de envolvimento'],
    ['nome', 'Nome completo'],
    ['nomeSocial', 'Nome social'],
    ['alcunha', 'Alcunha'],
    ['corRaca', 'Cor ou raça'],
    ['sexo', 'Sexo'],
    ['nascimento', 'Data de nascimento'],
    ['orientacaoSexual', 'Orientação sexual'],
    ['naturalidade', 'Naturalidade'],
    ['profissao', 'Profissão'],
    ['estadoCivil', 'Estado civil'],
    ['escolaridade', 'Escolaridade'],
    ['nomeMae', 'Nome da mãe'],
    ['nomePai', 'Nome do pai'],
    ['cpf', 'CPF'],
    ['cnhPpd', 'CNH/PPD'],
    ['endereco', 'Logradouro / endereço'],
    ['numero', 'Número'],
    ['complemento', 'Complemento'],
    ['bairro', 'Bairro'],
    ['municipio', 'Município'],
    ['uf', 'Estado/UF ou província'],
    ['pontoReferencia', 'Ponto de referência'],
    ['telefone', 'Telefone'],
    ['obs', 'Observações']
]

const MATERIAL_CATEGORIES = {
    veiculo: ['Veículo', 'dadosVeiculo'],
    arma_fogo: ['Arma de fogo', 'dadosArma'],
    droga: ['Droga', 'dadosDroga'],
    outro_objeto: ['Outros objetos/bens', 'dadosObjeto']
}

const MATERIAL_LABELS = {
    pais: 'País',
    placa: 'Placa',
    uf: 'UF',
    renavam: 'RENAVAM',
    chassi: 'Chassi',
    municipioRegistro: 'Município de registro',
    situacaoRegistro: 'Situação de registro',
    especie: 'Espécie',
    tipoVeiculo: 'Tipo de veículo',
    marca: 'Marca',
    modelo: 'Modelo',
    categoria: 'Categoria',
    corPredominante: 'Cor predominante',
    anoFabricacao: 'Ano de fabricação',
    anoModelo: 'Ano-modelo',
    situacaoAdministrativa: 'Situação administrativa/criminal',
    proprietario: 'Proprietário',
    acabamento: 'Acabamento',
    quantidadeCanos: 'Quantidade de canos',
    fabricacao: 'Fabricação',
    tipoUso: 'Tipo de uso',
    calibreReal: 'Calibre real',
    numeroRegistro: 'Número SIGMA/SINARM',
    numeroSerie: 'Número de série',
    situacaoNumeroSerie: 'Situação do número de série',
    tipoDroga: 'Tipo de droga',
    substancia: 'Substância',
    quantidade: 'Quantidade',
    unidade: 'Unidade',
    informacoesCarga: 'Faz parte de um carregamento',
    observacoes: 'Observações',
    tipoObjeto: 'Tipo de objeto/bem',
    participacoes: 'Participação na ocorrência'
}

const PARTICIPATION_LABELS = {
    apreendido: 'Apreendido',
    encontrado: 'Encontrado',
    subtraido: 'Subtraído',
    apreendido_infracao_transito: 'Apreendido por infração de trânsito'
}

function plainText(value) {
    return String(value || '')
        .replace(/<\s*br\s*\/?>/gi, '\n')
        .replace(/<\/\s*(p|div|li|h[1-6])\s*>/gi, '\n')
        .replace(/<[^>]*>/g, ' ')
        .replace(/&nbsp;/gi, ' ')
        .replace(/&amp;/gi, '&')
        .replace(/&lt;/gi, '<')
        .replace(/&gt;/gi, '>')
        .replace(/&quot;/gi, '"')
        .replace(/&#39;|&apos;/gi, "'")
        .replace(/[ \t]+\n/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim()
}

function displayValue(value, key) {
    if (value === undefined || value === null || value === '') return ''
    if (typeof value === 'boolean') return value ? 'Sim' : 'Não'
    if (Array.isArray(value)) {
        return value.map(item => key === 'participacoes'
            ? PARTICIPATION_LABELS[item] || item
            : displayValue(item)).filter(Boolean).join(key === 'participacoes' ? ', ' : '; ')
    }
    if (typeof value === 'object') return ''
    const labels = {
        sem_registro: 'Sem registro',
        registrado: 'Registrado',
        suprimido: 'Suprimido',
        nao_informado: 'Não informado',
        permitido: 'Permitido',
        restrito: 'Restrito'
    }
    return labels[value] || String(value)
}

function formatDateTime(value) {
    if (!value) return ''
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return String(value)
    const options = { timeZone: 'America/Fortaleza' }
    const datePart = new Intl.DateTimeFormat('pt-BR', {
        ...options,
        dateStyle: 'short'
    }).format(date)
    const timePart = new Intl.DateTimeFormat('pt-BR', {
        ...options,
        timeStyle: 'short'
    }).format(date)
    return `${datePart} às ${timePart}`
}

function addHeader(doc) {
    const logoSize = 58
    const logoY = 26
    doc.image(PMMA_LOGO, LEFT, logoY, { width: logoSize, height: logoSize })
    doc.image(BATTALION_LOGO, PAGE_WIDTH - RIGHT - logoSize, logoY, {
        width: logoSize,
        height: logoSize
    })
    doc.fillColor('#000000').font('Helvetica-Bold').fontSize(8.5)
        .text([
            'ESTADO DO MARANHÃO',
            'SECRETARIA DE ESTADO DA SEGURANÇA PÚBLICA',
            'POLÍCIA MILITAR DO MARANHÃO',
            'COMANDO DO POLICIAMENTO DE ÁREA DO INTERIOR – CPAI-6',
            '4º BATALHÃO DE POLÍCIA MILITAR'
        ].join('\n'), LEFT + logoSize + 8, 29, {
            width: CONTENT_WIDTH - (logoSize + 8) * 2,
            align: 'center',
            lineGap: 2
        })
    doc.moveTo(LEFT, 96).lineTo(PAGE_WIDTH - RIGHT, 96)
        .strokeColor('#777777').lineWidth(0.6).stroke()
    doc.y = TOP
}

function ensureSpace(doc, height) {
    if (doc.y + height > PAGE_HEIGHT - BOTTOM) {
        doc.addPage()
        doc.y = 42
    }
}

function addSection(doc, title) {
    ensureSpace(doc, 30)
    doc.moveDown(0.5)
    doc.font('Helvetica-Bold').fontSize(10).fillColor('#000000')
        .text(title, LEFT, doc.y, { width: CONTENT_WIDTH, align: 'center' })
    doc.moveDown(0.35)
    doc.moveTo(LEFT, doc.y).lineTo(PAGE_WIDTH - RIGHT, doc.y)
        .strokeColor('#777777').lineWidth(0.5).stroke()
    doc.moveDown(0.3)
}

function addOccurrenceIdentification(doc, report) {
    const textOptions = { width: CONTENT_WIDTH, align: 'center' }
    doc.font('Helvetica').fontSize(9).fillColor('#000000')
        .text(`OCORRÊNCIA NÚMERO: ${report.numero || ''}`, LEFT, doc.y, textOptions)
        .moveDown(0.35)
        .text(`Registrado em: ${formatDateTime(report.createdAt)}`, LEFT, doc.y, textOptions)
    doc.moveDown(1.2)
    addSection(doc, 'FATO COMUNICADO')
}

function addGridRow(doc, fields, columns) {
    const filtered = fields
        .map(([label, value]) => [label, displayValue(value)])
        .filter(([, value]) => value)
    if (!filtered.length) return

    const gutter = 12
    const columnWidth = (CONTENT_WIDTH - gutter * (columns - 1)) / columns
    for (let index = 0; index < filtered.length; index += columns) {
        const row = filtered.slice(index, index + columns)
        doc.font('Helvetica').fontSize(8.5)
        const rowHeight = row.reduce((maxHeight, [label, value]) => {
            const height = doc.heightOfString(`${label}: ${value}`, {
                width: columnWidth,
                lineGap: 1
            })
            return Math.max(maxHeight, height)
        }, 0)
        ensureSpace(doc, rowHeight + 4)
        const y = doc.y
        row.forEach(([label, value], column) => {
            const x = LEFT + column * (columnWidth + gutter)
            doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#000000')
                .text(`${label}: `, x, y, { continued: true, width: columnWidth })
            doc.font('Helvetica').fontSize(8.5)
                .text(value, { width: columnWidth, lineGap: 1 })
        })
        doc.y = y + rowHeight + 4
    }
}

function addWideField(doc, label, value) {
    const text = displayValue(value)
    if (!text) return
    const line = label ? `${label}: ${text}` : text
    const height = doc.heightOfString(line, {
        width: CONTENT_WIDTH,
        lineGap: 2
    })
    ensureSpace(doc, height + 3)
    const y = doc.y
    if (label) {
        doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#000000')
            .text(`${label}: `, LEFT, y, { continued: true })
        doc.font('Helvetica').fontSize(8.5)
            .text(text, { width: CONTENT_WIDTH, lineGap: 2 })
    } else {
        doc.font('Helvetica').fontSize(8.5).fillColor('#000000')
            .text(text, LEFT, y, { width: CONTENT_WIDTH, lineGap: 2 })
    }
    doc.moveDown(0.2)
}

function addPerson(doc, person) {
    const fields = INVOLVED_FIELDS
        .filter(([key]) => person[key] !== null && person[key] !== undefined &&
            String(person[key]).trim() !== '')
        .map(([key, label]) => [label, person[key]])
    if (person.conduzido) fields.push(['Conduzido', 'Sim'])
    for (let index = 0; index < fields.length; index += 3) {
        addGridRow(doc, fields.slice(index, index + 3), 3)
    }
}

function addMaterial(doc, material) {
    const category = MATERIAL_CATEGORIES[material.tipoItem]
    if (!category) {
        addGridRow(doc, [
            ['Descrição', material.descricao],
            ['Quantidade', material.quantidade]
        ], 2)
        return
    }

    addWideField(doc, 'Categoria', category[0])
    const details = material[category[1]] || {}
    for (const [key, value] of Object.entries(details)) {
        if (value === '' || value === null || value === undefined ||
            (Array.isArray(value) && value.length === 0)) continue
        addWideField(doc, MATERIAL_LABELS[key] || key, displayValue(value, key))
    }
}

function addOfficer(doc, officer) {
    const fields = [
        ['VTR', officer.vtr],
        [`${officer.graduacao || ''} N°`, officer.numeroBarra],
        ['Nome', officer.nome],
        ['ID', officer.id],
        ['Assinatura', '___________________________']
    ]
    const value = fields.map(([label, field]) =>
        `${label}: ${displayValue(field)}`
    ).join('   ')
    addWideField(doc, '', value)
}

async function gerarPdfBoletim({ report, validationUrl }) {
    const doc = new PDFDocument({
        size: 'A4',
        margins: { top: TOP, bottom: BOTTOM, left: LEFT, right: RIGHT },
        info: {
            Title: `BO_${report.numero || 'boletim'}_${report.data || ''}`,
            Author: 'BO Online - 4º Batalhão de Polícia Militar'
        }
    })
    const chunks = []
    doc.on('data', chunk => chunks.push(chunk))
    const completed = new Promise((resolve, reject) => {
        doc.on('end', resolve)
        doc.on('error', reject)
    })

    addHeader(doc)
    addOccurrenceIdentification(doc, report)
    addGridRow(doc, [
        ['Natureza da Ocorrência', report.natureza],
        ['Data do Fato', report.data],
        ['Horário do Fato', report.horario]
    ], 3)
    addGridRow(doc, [
        ['Local', [report.endereco, report.numeroEndereco].filter(Boolean).join(' ')],
        ['Bairro', report.bairro],
        ['Município', report.municipio]
    ], 3)
    addGridRow(doc, [
        ['Ponto de Referência', report.referencia],
        ['Coordenadas', [report.latitude, report.longitude].filter(Boolean).join(' ')],
        ['', '']
    ], 3)

    addSection(doc, 'ENVOLVIDO(S)')
    for (const person of Array.isArray(report.envolvidos) ? report.envolvidos : []) {
        addPerson(doc, person)
        doc.moveDown(0.4)
    }

    addSection(doc, 'ARMAS E OBJETOS APREENDIDOS')
    for (const material of Array.isArray(report.materiaisApreendidos)
        ? report.materiaisApreendidos
        : []) {
        addMaterial(doc, material)
        doc.moveDown(0.3)
    }

    addSection(doc, 'HISTÓRICO')
    const history = plainText(report.historicohtml)
    if (history) {
        doc.font('Helvetica').fontSize(8.5).fillColor('#000000')
            .text(history, { width: CONTENT_WIDTH, lineGap: 2 })
    }

    addSection(doc, 'EFETIVO EMPREGADO')
    for (const officer of Array.isArray(report.efetivo) ? report.efetivo : []) {
        addOfficer(doc, officer)
    }

    addSection(doc, 'UNIDADE DE ENTREGA')
    addWideField(doc, '', 'Unidade ___________________________    Data _______/________/_______    Hora _________:_________')
    addWideField(doc, '', 'Matrícula ___________________________    Nome ______________________________    Assinatura ___________________________')

    const qr = await QRCode.toBuffer(validationUrl, {
        type: 'png',
        errorCorrectionLevel: 'H',
        margin: 2,
        width: 220
    })
    const qrSize = 150
    if (doc.y + qrSize > PAGE_HEIGHT - BOTTOM) {
        doc.addPage()
        doc.y = 42
    }
    doc.image(qr, (PAGE_WIDTH - qrSize) / 2, doc.y, {
        width: qrSize,
        height: qrSize
    })
    doc.link((PAGE_WIDTH - qrSize) / 2, doc.y, qrSize, qrSize, validationUrl)

    doc.end()
    await completed
    return Buffer.concat(chunks)
}

module.exports = { gerarPdfBoletim, formatDateTime, plainText }
