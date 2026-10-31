function normalizarLocalidade(value) {
    return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/\s+/g, ' ').trim().toLocaleLowerCase('pt-BR')
}

const TIPOS_LOCALIDADE = ['BAIRRO', 'POVOADO', 'LOCALIDADE_RURAL', 'VILA', 'DISTRITO', 'ASSENTAMENTO', 'COMUNIDADE', 'OUTRO']
const ZONAS = ['URBANA', 'RURAL', 'NAO_INFORMADA']

module.exports = { normalizarLocalidade, TIPOS_LOCALIDADE, ZONAS }
