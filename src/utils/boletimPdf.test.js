const test = require('node:test')
const assert = require('node:assert/strict')
const zlib = require('node:zlib')
const PDFDocument = require('pdfkit')
const { gerarPdfBoletim, formatDateTime } = require('./boletimPdf')

function firstPageTextRuns(pdf) {
    const source = pdf.toString('latin1')
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
            if (content.includes('BT') && content.includes('Tm')) {
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
            }
        } catch {
            // Image streams are also Flate-compressed; continue until the page content stream.
        }
        offset = streamEnd + 9
    }
    throw new Error('PDF first-page text stream was not found')
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
    assert.ok(occurrence)
    assert.ok(registered)
    assert.ok(factTitle)

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
