const fs = require('node:fs')
const path = require('node:path')
const PDFDocument = require('pdfkit')
const QRCode = require('qrcode')
const { renderHistory } = require('./historyPdf')

const PAGE_WIDTH = 595.28
const PAGE_HEIGHT = 841.89
const LEFT = 48
const RIGHT = 48
const TOP = 118
const BOTTOM = 42
const CONTENT_WIDTH = PAGE_WIDTH - LEFT - RIGHT
const OFFICER_SIGNATURE_HEIGHT = 56
const OFFICER_SECTION_TITLE = 'EFETIVO EMPREGADO'
const DELIVERY_SIGNATURE_HEIGHT = 112
const QR_SIZE = 75
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
    arma_branca: ['Arma branca', 'dadosArmaBranca'],
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
    tipoArmaBranca: 'Tipo de arma branca',
    substancia: 'Substância',
    quantidade: 'Quantidade',
    unidade: 'Unidade',
    informacoesCarga: 'Faz parte de um carregamento',
    observacoes: 'Observações',
    tipoObjeto: 'Tipo de objeto/bem',
    descricao: 'Descrição do objeto',
    materialFabricacao: 'Material de fabricação',
    comprimentoAproximadoCm: 'Comprimento aproximado',
    caracteristicasDistintivas: 'Características distintivas',
    estadoConservacao: 'Estado de conservação',
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
        restrito: 'Restrito',
        integro: 'Íntegro',
        danificado: 'Danificado',
        outro: 'Outro'
    }
    if (key === 'comprimentoAproximadoCm') return `${value} cm`
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
        addPageWithHeader(doc)
    }
}

function addPageWithHeader(doc) {
    doc.addPage()
    addHeader(doc)
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

function officerIdentificationFields(officer) {
    return [
        ['Posto/Graduação', officer.graduacao],
        ['Nome', officer.nome],
        ['Matrícula/ID', officer.id],
        ['Número/Barra', officer.numeroBarra],
        ['Função', officer.funcao],
        ['Unidade', officer.unidade],
        ['VTR', officer.vtr]
    ].filter(([, value]) => value !== null && value !== undefined &&
        String(value).trim() !== '')
        .map(([label, value]) => `${label}: ${displayValue(value)}`)
}

function officerBlockHeight(doc, officer, index) {
    const padding = 8
    const width = CONTENT_WIDTH - padding * 2 - 10
    const fields = officerIdentificationFields(officer)
    doc.font('Helvetica-Bold').fontSize(9)
    const titleHeight = doc.heightOfString(`POLICIAL ${index + 1}`, { width })
    doc.font('Helvetica').fontSize(8.5)
    const fieldsHeight = fields.reduce((height, field) =>
        height + doc.heightOfString(field, { width, lineGap: 2 }) + 2, 0)
    return padding + titleHeight + 4 + fieldsHeight + 8 +
        OFFICER_SIGNATURE_HEIGHT + padding
}

function addOfficer(doc, officer, index) {
    const padding = 8
    const x = LEFT + padding
    const width = CONTENT_WIDTH - padding * 2
    const fields = officerIdentificationFields(officer)
    const blockHeight = officerBlockHeight(doc, officer, index)
    const top = doc.y
    const innerX = x + 5
    const innerWidth = width - 10

    doc.roundedRect(LEFT, top, CONTENT_WIDTH, blockHeight, 4)
        .strokeColor('#777777').lineWidth(0.6).stroke()
    doc.font('Helvetica-Bold').fontSize(9).fillColor('#000000')
        .text(`POLICIAL ${index + 1}`, innerX, top + padding, { width: innerWidth })

    let fieldY = top + padding +
        doc.heightOfString(`POLICIAL ${index + 1}`, { width: innerWidth, font: 'Helvetica-Bold', fontSize: 9 }) + 4
    doc.font('Helvetica').fontSize(8.5).fillColor('#000000')
    for (const field of fields) {
        const height = doc.heightOfString(field, { width: innerWidth, lineGap: 2 })
        doc.text(field, innerX, fieldY, { width: innerWidth, lineGap: 2 })
        fieldY += height + 2
    }

    const signatureTop = fieldY + 8
    doc.rect(innerX, signatureTop, innerWidth, OFFICER_SIGNATURE_HEIGHT)
        .strokeColor('#777777').lineWidth(0.6).stroke()
    doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#000000')
        .text('Assinatura do policial militar', innerX + 6, signatureTop + 7, {
            width: innerWidth - 12
        })
    const signatureLineY = signatureTop + 48
    doc.moveTo(innerX + 12, signatureLineY)
        .lineTo(innerX + innerWidth - 12, signatureLineY)
        .strokeColor('#000000').lineWidth(0.6).stroke()
    doc.y = top + blockHeight + 8
}

function addOfficerSection(doc, officers) {
    const firstOfficerHeight = officers.length
        ? officerBlockHeight(doc, officers[0], 0)
        : 0
    ensureSpace(doc, 35 + firstOfficerHeight)
    addSection(doc, OFFICER_SECTION_TITLE)

    officers.forEach((officer, index) => {
        const blockHeight = officerBlockHeight(doc, officer, index)
        if (doc.y + blockHeight > PAGE_HEIGHT - BOTTOM) {
            addPageWithHeader(doc)
            addSection(doc, OFFICER_SECTION_TITLE)
        }
        addOfficer(doc, officer, index)
    })
}

function addDeliverySection(doc, report) {
    const responsavel = report.responsavelEntrega &&
        typeof report.responsavelEntrega === 'object'
        ? report.responsavelEntrega
        : {}
    const nomeResponsavel = typeof report.responsavelEntrega === 'string'
        ? report.responsavelEntrega
        : responsavel.nome || report.responsavelEntregaNome
    const unidade = typeof report.unidadeEntrega === 'object'
        ? report.unidadeEntrega?.nome : report.unidadeEntrega
    const fields = [
        ['Unidade', unidade],
        ['Data', report.dataEntrega],
        ['Hora', report.horaEntrega],
        ['Matrícula', responsavel.matricula || responsavel.id ||
            report.matriculaResponsavelEntrega],
        ['Nome', nomeResponsavel]
    ]
    const textWidth = CONTENT_WIDTH - 20
    const rows = fields.map(([label, value]) => {
        const text = displayValue(value)
        const height = text
            ? Math.max(16, doc.heightOfString(`${label}: ${text}`, {
                width: textWidth,
                font: 'Helvetica',
                fontSize: 8.5,
                lineGap: 1
            }) + 4)
            : 16
        return { label, text, height }
    })
    const titleHeight = 35
    const gap = 10
    const cardPadding = 10
    const cardHeight = cardPadding * 2 +
        rows.reduce((height, row) => height + row.height, 0) + gap +
        DELIVERY_SIGNATURE_HEIGHT

    ensureSpace(doc, titleHeight + cardHeight + 8)
    addSection(doc, 'ASSINATURA DA UNIDADE DE ENTREGA')

    const top = doc.y
    doc.roundedRect(LEFT, top, CONTENT_WIDTH, cardHeight, 4)
        .strokeColor('#777777').lineWidth(0.6).stroke()
    let fieldY = top + cardPadding
    for (const { label, text, height } of rows) {
        const labelText = `${label}:`
        if (text) {
            doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#000000')
                .text(labelText, LEFT + cardPadding, fieldY, {
                    continued: true,
                    width: CONTENT_WIDTH - cardPadding * 2
                })
            doc.font('Helvetica').fontSize(8.5).fillColor('#000000')
                .text(` ${text}`, { width: CONTENT_WIDTH - cardPadding * 2, lineGap: 1 })
        } else {
            doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#000000')
                .text(labelText, LEFT + cardPadding, fieldY)
            const labelWidth = doc.widthOfString(labelText, { font: 'Helvetica-Bold', fontSize: 8.5 })
            const lineStart = Math.min(LEFT + cardPadding + labelWidth + 6, LEFT + CONTENT_WIDTH / 2)
            doc.moveTo(lineStart, fieldY + 10)
                .lineTo(LEFT + CONTENT_WIDTH - cardPadding, fieldY + 10)
                .strokeColor('#777777').lineWidth(0.4).stroke()
        }
        fieldY += height
    }

    const signatureTop = top + cardPadding +
        rows.reduce((height, row) => height + row.height, 0) + gap
    const signatureX = LEFT + cardPadding
    const signatureWidth = CONTENT_WIDTH - cardPadding * 2
    doc.rect(signatureX, signatureTop, signatureWidth, DELIVERY_SIGNATURE_HEIGHT)
        .strokeColor('#777777').lineWidth(0.6).stroke()
    doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#000000')
        .text('Assinatura do agente', signatureX + 6, signatureTop + 7, {
            width: signatureWidth - 12
        })
    const signatureLineY = signatureTop + DELIVERY_SIGNATURE_HEIGHT - 10
    doc.moveTo(signatureX + 12, signatureLineY)
        .lineTo(signatureX + signatureWidth - 12, signatureLineY)
        .strokeColor('#000000').lineWidth(0.6).stroke()
    doc.y = top + cardHeight + 8
}

function addPageIdentification(doc, report) {
    const range = doc.bufferedPageRange()
    if (range.count <= 1) return

    const lastPage = range.start + range.count - 1
    const currentY = doc.y
    const footerY = PAGE_HEIGHT - BOTTOM + 6
    const identifier = report.numero ? `BOLETIM Nº ${report.numero}` : 'BOLETIM'

    for (let pageIndex = range.start; pageIndex <= lastPage; pageIndex += 1) {
        doc.switchToPage(pageIndex)
        const bottomMargin = doc.page.margins.bottom
        doc.page.margins.bottom = 0
        doc.font('Helvetica').fontSize(8).fillColor('#000000')
            .text(identifier, LEFT, footerY, {
                width: CONTENT_WIDTH / 2,
                lineBreak: false
            })
            .text(`Página ${pageIndex - range.start + 1} de ${range.count}`,
                PAGE_WIDTH - RIGHT - CONTENT_WIDTH / 2, footerY, {
                    width: CONTENT_WIDTH / 2,
                    align: 'right',
                    lineBreak: false
                })
        doc.page.margins.bottom = bottomMargin
    }

    doc.switchToPage(lastPage)
    doc.y = currentY
}

async function gerarPdfBoletim({ report, validationUrl }) {
    const doc = new PDFDocument({
        size: 'A4',
        bufferPages: true,
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
    renderHistory(doc, report.historicohtml, CONTENT_WIDTH, LEFT)

    addOfficerSection(doc, Array.isArray(report.efetivo) ? report.efetivo : [])

    addDeliverySection(doc, report)

    const qr = await QRCode.toBuffer(validationUrl, {
        type: 'png',
        errorCorrectionLevel: 'H',
        margin: 2,
        width: 220
    })
    const qrCaptionHeight = 16
    if (doc.y + QR_SIZE + qrCaptionHeight + 8 > PAGE_HEIGHT - BOTTOM) {
        addPageWithHeader(doc)
    }
    const qrX = (PAGE_WIDTH - QR_SIZE) / 2
    const qrY = doc.y
    doc.image(qr, qrX, qrY, {
        width: QR_SIZE,
        height: QR_SIZE
    })
    doc.link(qrX, qrY, QR_SIZE, QR_SIZE, validationUrl)
    doc.font('Helvetica').fontSize(8).fillColor('#000000')
        .text('Versão digital do boletim', LEFT, qrY + QR_SIZE + 4, {
            width: CONTENT_WIDTH,
            align: 'center'
        })

    addPageIdentification(doc, report)
    doc.end()
    await completed
    return Buffer.concat(chunks)
}

module.exports = { gerarPdfBoletim, formatDateTime, plainText }
