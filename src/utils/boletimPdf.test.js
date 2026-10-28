const test = require('node:test')
const assert = require('node:assert/strict')
const zlib = require('node:zlib')
const PDFDocument = require('pdfkit')
const { gerarPdfBoletim, formatDateTime } = require('./boletimPdf')

function allPageTextRuns(pdf) {
    const source = pdf.toString('latin1')
    const objects = new Map([...source.matchAll(/(\d+) 0 obj([\s\S]*?)endobj/g)]
        .map(([, id, body]) => [Number(id), body]))
    const pageTree = [...objects.values()].find(body => /\/Type\s*\/Pages\b/.test(body))
    const pageIds = [...(pageTree?.match(/\/Kids\s*\[([^\]]*)\]/)?.[1] || '')
        .matchAll(/(\d+)\s+0\s+R/g)].map(([, id]) => Number(id))
    const pages = pageIds.map(pageId => {
            const page = objects.get(pageId)
            const contentRef = page?.match(/\/Contents\s+(\d+)\s+0\s+R/)
            if (!contentRef) return []
            const object = objects.get(Number(contentRef[1]))
            const length = Number(object?.match(/\/Length\s+(\d+)/)?.[1])
            const streamStart = object?.indexOf('stream')
            if (!object || !Number.isFinite(length) || streamStart < 0) return []
            let dataStart = streamStart + 6
            if (object[dataStart] === '\r') dataStart += 1
            if (object[dataStart] === '\n') dataStart += 1
            const content = zlib.inflateSync(Buffer.from(
                object.slice(dataStart, dataStart + length),
                'latin1'
            )).toString('latin1')
            return [...content.matchAll(/BT([\s\S]*?)ET/g)].map(([, block]) => {
                const position = block.match(/1 0 0 1 ([\d.-]+) ([\d.-]+) Tm/)
                const text = [...block.matchAll(/<([0-9A-Fa-f]+)>/g)]
                    .map(([, hex]) => Buffer.from(hex, 'hex').toString('latin1'))
                    .join('')
                return {
                    x: position ? Number(position[1]) : null,
                    y: position ? Number(position[2]) : null,
                    text
                }
            })
        })
    if (!pages.length) throw new Error('PDF page text streams were not found')
    return pages
}

function pageContentStreams(pdf) {
    const source = pdf.toString('latin1')
    const streams = []
    let offset = 0
    while ((offset = source.indexOf('/Filter', offset)) !== -1) {
        const streamStart = source.indexOf('stream', offset)
        const streamEnd = source.indexOf('endstream', streamStart)
        if (streamStart < 0 || streamEnd < 0) break
        let dataStart = streamStart + 6
        if (source.charCodeAt(dataStart) === 13) dataStart += 1
        if (source.charCodeAt(dataStart) === 10) dataStart += 1
        let dataEnd = streamEnd
        if (source.charCodeAt(dataEnd - 1) === 10) dataEnd -= 1
        if (source.charCodeAt(dataEnd - 1) === 13) dataEnd -= 1
        try {
            const content = zlib.inflateSync(pdf.subarray(dataStart, dataEnd)).toString('latin1')
            if (content.includes(' cm') || content.includes(' re')) streams.push(content)
        } catch {
            // Image streams are compressed too; only page content streams are needed here.
        }
        offset = streamEnd + 9
    }
    return streams
}

function firstPageTextRuns(pdf) {
    return allPageTextRuns(pdf)[0]
}

async function generatePdfWithOfficers(efetivo) {
    return gerarPdfBoletim({
        report: {
            numero: '2',
            data: '28/10/2026',
            municipio: 'São Luís',
            envolvidos: [],
            materiaisApreendidos: [],
            efetivo
        },
        validationUrl: 'https://validacao.example.test/validar-boletim/oficiais'
    })
}

test('gera PDF A4 com conteúdo, paginação e QR de validação incorporado', async () => {
    assert.equal(
        formatDateTime(new Date('2026-10-27T13:52:00Z')),
        '27/10/2026 às 10:52'
    )
    const pdf = await gerarPdfBoletim({
        report: {
            numero: '1',
            dataRegistro: '',
            createdAt: new Date('2026-10-27T15:24:00Z'),
            natureza: 'Roubo; Furto',
            data: '27/10/2026',
            horario: '10:30',
            municipio: 'São Luís',
            endereco: 'Rua de teste',
            envolvidos: [{ tipo: 'Vítima', nome: 'Pessoa de teste', cpf: '52998224725' }],
            materiaisApreendidos: [{
                tipoItem: 'veiculo',
                dadosVeiculo: { marca: 'Teste', placa: 'ABC1D23' }
            }, {
                tipoItem: 'arma_branca',
                dadosArmaBranca: {
                    tipoArmaBranca: 'Faca',
                    descricao: 'Cabo de madeira e lâmina metálica',
                    quantidade: 1,
                    materialFabricacao: 'Metal e madeira',
                    comprimentoAproximadoCm: 25,
                    caracteristicasDistintivas: 'Cabo marrom',
                    estadoConservacao: 'integro'
                }
            }, {
                descricao: 'Telefone antigo',
                quantidade: '1'
            }],
            efetivo: [{ nome: 'Policial de teste', graduacao: 'SD' }],
            historicohtml: `<p>${'Histórico integral da ocorrência. '.repeat(500)}</p>`
        },
        validationUrl: 'https://validacao.example.test/validar-boletim/abc123'
    })

    const content = pdf.toString('latin1')
    assert.match(content, /^%PDF-/)
    assert.match(content, /\/Type\s*\/Pages\b/)
    assert.ok((content.match(/\/Type\s*\/Page\b/g) || []).length > 2)
    assert.ok((content.match(/\/Subtype\s*\/Image\b/g) || []).length >= 3)
    assert.ok(content.endsWith('%%EOF\n'))

    const runs = firstPageTextRuns(pdf)
    const occurrence = runs.find(run => run.text === 'OCORRÊNCIA NÚMERO: 1')
    const registered = runs.find(run => run.text === 'Registrado em: 27/10/2026 às 12:24')
    const factTitle = runs.find(run => run.text === 'FATO COMUNICADO')
    const materialText = runs.map(run => run.text).join(' ')
    assert.ok(occurrence)
    assert.ok(registered)
    assert.ok(factTitle)
    assert.match(materialText, /Arma branca/)
    assert.match(materialText, /Tipo de arma branca/)
    assert.match(materialText, /Faca/)
    assert.match(materialText, /Cabo de madeira e lâmina metálica/)
    assert.match(materialText, /Comprimento aproximado/)
    assert.match(materialText, /25 cm/)
    assert.match(materialText, /Telefone antigo/)

    const metrics = new PDFDocument({ size: 'A4' })
    const pageCenter = 595.28 / 2
    metrics.font('Helvetica').fontSize(9)
    assert.ok(Math.abs(occurrence.x + metrics.widthOfString(occurrence.text) / 2 - pageCenter) < 0.1)
    assert.ok(Math.abs(registered.x + metrics.widthOfString(registered.text) / 2 - pageCenter) < 0.1)
    metrics.font('Helvetica-Bold').fontSize(10)
    assert.ok(Math.abs(factTitle.x + metrics.widthOfString(factTitle.text) / 2 - pageCenter) < 0.1)
    assert.ok(occurrence.y > registered.y)
    assert.ok(registered.y > factTitle.y)
})

test('justifica o histórico sem perder parágrafos, lista, acentos ou conteúdo longo', async () => {
    const baseReport = {
        numero: 'HIST-1',
        data: '28/10/2026',
        municipio: 'São Luís',
        envolvidos: [],
        materiaisApreendidos: [],
        efetivo: []
    }
    const shortPdf = await gerarPdfBoletim({
        report: {
            ...baseReport,
            historicohtml: '<p>João relatou: ação rápida na área central.</p>'
        },
        validationUrl: 'https://validacao.example.test/short-history'
    })
    const shortPages = allPageTextRuns(shortPdf)
    const shortText = shortPages.flat().map(run => run.text).join(' ')
    assert.equal(shortPages.length, 1)
    assert.match(shortText, /João relatou/)
    assert.match(shortText, /ação rápida/)

    const paragraphs = [
        '<p>Primeiro parágrafo: João registrou a ocorrência em São Luís, com referência à ação e à sequência dos fatos.</p>',
        ...Array.from({ length: 12 }, (_, index) =>
            `<p>Parágrafo ${index + 2}: ${'A equipe preservou o local, ouviu testemunhas e registrou as informações apresentadas. '.repeat(22)}</p>`),
        '<p>Itens conferidos:</p><ul><li>Documento de identificação e endereço informado.</li><li>Descrição do veículo, cor e placa.</li><li>Observações: pontuação, acentuação e caracteres especiais — ç, ã e º.</li></ul>',
        '<p>Último parágrafo: conteúdo final preservado integralmente.</p>'
    ]
    const longPdf = await gerarPdfBoletim({
        report: {
            ...baseReport,
            historicohtml: paragraphs.join('')
        },
        validationUrl: 'https://validacao.example.test/long-history'
    })
    const longPages = allPageTextRuns(longPdf)
    const longText = longPages.flat().map(run => run.text).join(' ')
    const pageCount = (longPdf.toString('latin1').match(/\/Type\s*\/Page\b/g) || []).length

    assert.ok(pageCount > 1, 'o histórico longo deve continuar em páginas adicionais')
    assert.equal(longPages.length, pageCount)
    assert.match(longText, /Primeiro parágrafo/)
    assert.match(longText, /Parágrafo\s*13/)
    assert.match(longText, /Itens.?conferidos/)
    assert.match(longText, /Documento/)
    assert.match(longText, /identificação/)
    assert.match(longText, /Descrição/)
    assert.match(longText, /veículo/)
    assert.match(longText, /ç/)
    assert.match(longText, /ã/)
    assert.match(longText, /º/)
    assert.match(longText, /Último parágrafo/)
    assert.match(longPdf.toString('latin1'), /\/Subtype\s*\/Image\b/)
})

test('gera bloco individual de assinatura para um policial e omite identificação ausente', async () => {
    const pdf = await generatePdfWithOfficers([{
        graduacao: 'SD',
        nome: 'Policial Teste',
        id: '12345',
        numeroBarra: '001/20',
        vtr: '128',
        funcao: 'Comandante',
        unidade: '4º BPM'
    }])
    const pages = allPageTextRuns(pdf)
    const text = pages.flat().map(run => run.text).join(' ')

    assert.match(text, /POLICIAL 1/)
    assert.match(text, /Posto\/Graduação: SD/)
    assert.match(text, /Nome: Policial Teste/)
    assert.match(text, /Matrícula\/ID: 12345/)
    assert.match(text, /Número\/Barra: 001\/20/)
    assert.match(text, /VTR: 128/)
    assert.match(text, /Assinatura do policial militar/)
    assert.match(text, /Função: Comandante/)
    assert.match(text, /Unidade: 4º BPM/)
    assert.equal((text.match(/Assinatura do policial militar/g) || []).length, 1)
})

test('mantém três policiais individualizados e associados às respectivas assinaturas', async () => {
    const efetivo = [1, 2, 3].map(index => ({
        graduacao: 'CB',
        nome: `Policial ${index}`,
        id: `1000${index}`,
        vtr: '128'
    }))
    const pdf = await generatePdfWithOfficers(efetivo)
    const pages = allPageTextRuns(pdf)

    for (let index = 1; index <= efetivo.length; index += 1) {
        const page = pages.find(runs =>
            runs.some(run => run.text === `POLICIAL ${index}`) &&
            runs.some(run => run.text === `Nome: Policial ${index}`))
        assert.ok(page, `identificação do policial ${index} deve permanecer no PDF`)
        assert.ok(page.some(run => run.text === 'Assinatura do policial militar'),
            `assinatura do policial ${index} deve permanecer junto à identificação`)
    }
    assert.ok(pages.length >= 1 && pages.length <= 2)
    assert.equal(
        pages.flat().filter(run => run.text === 'Assinatura do policial militar').length,
        3
    )
})

test('distribui muitos policiais em páginas adicionais e repete o título da seção', async () => {
    const efetivo = Array.from({ length: 12 }, (_, index) => ({
        graduacao: 'SD',
        nome: `Integrante ${index + 1}`,
        id: `${20000 + index}`,
        numeroBarra: `${index + 1}/24`,
        vtr: '128'
    }))
    const pdf = await generatePdfWithOfficers(efetivo)
    const pages = allPageTextRuns(pdf)
    const pageCount = (pdf.toString('latin1').match(/\/Type\s*\/Page\b/g) || []).length

    assert.ok(pageCount > 1)
    assert.equal(pages.length, pageCount)
    assert.ok(pages.filter(runs =>
        runs.some(run => run.text === 'EFETIVO EMPREGADO')).length > 1)
    for (let index = 1; index <= pageCount; index += 1) {
        const pageText = pages[index - 1].map(run => run.text).join(' ')
        assert.match(pageText, /BOLETIM Nº 2/)
        assert.match(pageText, new RegExp(`Página ${index} de ${pageCount}`))
    }

    const text = pages.flat().map(run => run.text).join(' ')
    for (let index = 1; index <= efetivo.length; index += 1) {
        assert.match(text, new RegExp(`POLICIAL ${index}`))
        assert.match(text, new RegExp(`Integrante ${index}`))
    }
    assert.match(text, /EFETIVO EMPREGADO/)
    assert.equal((text.match(/Assinatura do policial militar/g) || []).length, efetivo.length)
    assert.match(pdf.toString('latin1'), /\/Subtype\s*\/Image\b/)
})

test('exibe bloco da unidade de entrega com dados fornecidos e área manuscrita ampla', async () => {
    const pdf = await gerarPdfBoletim({
        report: {
            numero: '3',
            data: '28/10/2026',
            envolvidos: [],
            materiaisApreendidos: [],
            efetivo: [],
            unidadeEntrega: '4º BPM',
            responsavelEntrega: {
                nome: 'Policial Responsável',
                matricula: '56789'
            },
            dataEntrega: '28/10/2026',
            horaEntrega: '14:30'
        },
        validationUrl: 'https://validacao.example.test/boletim/3'
    })
    const pages = allPageTextRuns(pdf)
    const text = pages.flat().map(run => run.text).join(' ')
    const content = pdf.toString('latin1')

    assert.match(text, /ASSINATURA DA UNIDADE DE ENTREGA/)
    assert.match(text, /Unidade:\s+4º BPM/)
    assert.match(text, /Data:\s+28\/10\/2026/)
    assert.match(text, /Hora:\s+14:30/)
    assert.match(text, /Matrícula:\s+56789/)
    assert.match(text, /Nome:\s+Policial Responsável/)
    assert.match(text, /Assinatura do agente/)
    assert.match(content, /\/Subtype\s*\/Image\b/)
    assert.match(content, /validacao\.example\.test\/boletim\/3/)
    assert.match(content, /\/Type\s*\/Page\b/)
    assert.match(content, /\/MediaBox\s*\[0\s+0\s+595\.28\s+841\.89\]/)
    assert.ok(pageContentStreams(pdf).some(stream => /479\.28\s+112\s+re/.test(stream)))
})

test('reduz pela metade a altura da área de assinatura dos policiais', async () => {
    const pdf = await generatePdfWithOfficers([{
        graduacao: 'SD',
        nome: 'Policial de teste',
        id: '12345'
    }])

    assert.ok(pageContentStreams(pdf).some(stream => /473\.28\s+56\s+re/.test(stream)))
    assert.doesNotMatch(pageContentStreams(pdf).join('\n'), /473\.28\s+112\s+re/)
})

test('preserva boletins antigos sem dados de entrega e exibe QR reduzido com legenda', async () => {
    const pdf = await gerarPdfBoletim({
        report: {
            numero: '4',
            envolvidos: [],
            materiaisApreendidos: [],
            efetivo: []
        },
        validationUrl: 'https://validacao.example.test/legacy/4'
    })
    const text = allPageTextRuns(pdf).flat().map(run => run.text).join(' ')
    const streams = pageContentStreams(pdf).join('\n')
    const content = pdf.toString('latin1')

    assert.match(text, /ASSINATURA DA UNIDADE DE ENTREGA/)
    assert.match(text, /Unidade:/)
    assert.match(text, /Data:/)
    assert.match(text, /Hora:/)
    assert.match(text, /Matrícula:/)
    assert.match(text, /Nome:/)
    assert.match(text, /Assinatura do agente/)
    assert.match(text, /Versão digital do boletim/)
    assert.doesNotMatch(text, /Página \d+ de \d+/)
    assert.doesNotMatch(text, /Nome:\s+[A-Z][a-z]+ [A-Z]/)
    assert.match(streams, /75\s+0\s+0\s+-75\s+[\d.]+\s+[\d.]+\s+cm/)
    assert.doesNotMatch(streams, /150\s+0\s+0\s+-150\s+[\d.]+\s+[\d.]+\s+cm/)
    assert.match(content, /legacy\/4/)
    assert.match(content, /\/Subtype\s*\/Image\b/)
    assert.match(content, /\/MediaBox\s*\[0\s+0\s+595\.28\s+841\.89\]/)
})

test('mantém o bloco completo de entrega em página própria se a página estiver ocupada', async () => {
    const pdf = await gerarPdfBoletim({
        report: {
            numero: '5',
            envolvidos: [],
            materiaisApreendidos: [],
            efetivo: Array.from({ length: 12 }, (_, index) => ({
                nome: `Policial ${index + 1}`,
                graduacao: 'SD',
                id: `${30000 + index}`
            })),
            unidadeEntrega: '4º BPM',
            responsavelEntrega: 'Responsável informado',
            dataEntrega: '28/10/2026'
        },
        validationUrl: 'https://validacao.example.test/boletim/5'
    })
    const pages = allPageTextRuns(pdf)
    const deliveryPage = pages.find(runs =>
        runs.some(run => run.text === 'ASSINATURA DA UNIDADE DE ENTREGA'))

    assert.ok(deliveryPage)
    assert.ok(deliveryPage.some(run =>
        run.text === 'Assinatura do agente'))
    assert.ok(deliveryPage.some(run =>
        run.text.includes('Responsável informado')))
})
