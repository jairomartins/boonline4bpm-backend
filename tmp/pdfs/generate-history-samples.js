const fs = require('node:fs')
const path = require('node:path')
const { gerarPdfBoletim } = require('../../src/utils/boletimPdf')

async function main() {
  const base = {
    numero: 'QA-HIST-2026',
    data: '28/10/2026',
    horario: '14:30',
    municipio: 'São Luís',
    endereco: 'Centro',
    envolvidos: [],
    materiaisApreendidos: [],
    efetivo: [],
  }
  const short = await gerarPdfBoletim({
    report: { ...base, historicohtml: '<p>João relatou a ação rápida na área central, com os fatos registrados em ordem cronológica.</p>' },
    validationUrl: 'https://validacao.example.test/short-history',
  })
  const longHistory = [
    '<p>Primeiro parágrafo: João registrou a ocorrência em São Luís, com referência à ação e à sequência dos fatos.</p>',
    ...Array.from({ length: 12 }, (_, index) => `<p>Parágrafo ${index + 2}: ${'A equipe preservou o local, ouviu testemunhas e registrou as informações apresentadas. '.repeat(22)}</p>`),
    '<p>Itens conferidos:</p><ul><li>Documento de identificação e endereço informado.</li><li>Descrição do veículo, cor e placa.</li><li>Observações: pontuação, acentuação e caracteres especiais — ç, ã e º.</li></ul>',
    '<p>Último parágrafo: conteúdo final preservado integralmente.</p>',
  ].join('')
  const long = await gerarPdfBoletim({
    report: { ...base, historicohtml: longHistory },
    validationUrl: 'https://validacao.example.test/long-history',
  })
  fs.writeFileSync(path.join(__dirname, 'historico-curto.pdf'), short)
  fs.writeFileSync(path.join(__dirname, 'historico-longo.pdf'), long)
  process.stdout.write(JSON.stringify({
    shortBytes: short.length,
    longBytes: long.length,
    longPages: (long.toString('latin1').match(/\/Type\s*\/Page\b/g) || []).length,
  }) + '\n')
}
main().catch(error => { console.error(error); process.exitCode = 1 })
