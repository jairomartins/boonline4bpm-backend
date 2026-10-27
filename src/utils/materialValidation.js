const tiposItem = ['veiculo', 'arma_fogo', 'droga', 'outro_objeto']
const participacoes = ['apreendido', 'encontrado', 'subtraido', 'apreendido_infracao_transito']
const unidadesOutraDroga = ['g', 'ml', 'frasco', 'unidade', 'comprimido']
const unidadesPadraoDroga = {
    Anfetamina: 'g',
    Cocaína: 'g',
    Crack: 'g',
    Ecstasy: 'comprimido',
    Haxixe: 'g',
    'Lança-perfume': 'frasco',
    LSD: 'microponto',
    Maconha: 'g',
    Oxi: 'g',
    'Pasta base': 'g',
    'Pé de maconha': 'unidade'
}

const temTexto = value => typeof value === 'string' && value.trim().length > 0
const quantidadeValida = value => Number.isFinite(Number(value)) && Number(value) > 0
const validarParticipacoes = (values, tipoItem) => {
    const permitidas = tipoItem === 'veiculo'
        ? participacoes
        : participacoes.filter(value => value !== 'apreendido_infracao_transito')
    return values === undefined || (Array.isArray(values) && values.every(value => permitidas.includes(value)))
}

function validarItem(item, index) {
    const prefixo = `Item ${index + 1}`
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
        return `${prefixo}: dados inválidos.`
    }

    // Boletins antigos continuam válidos e não precisam de conversão.
    if (item.tipoItem === undefined || item.tipoItem === null) return null
    if (!tiposItem.includes(item.tipoItem)) return `${prefixo}: tipo de item inválido.`

    const dados = item[
        item.tipoItem === 'veiculo' ? 'dadosVeiculo' :
        item.tipoItem === 'arma_fogo' ? 'dadosArma' :
        item.tipoItem === 'droga' ? 'dadosDroga' : 'dadosObjeto'
    ]
    if (!dados || typeof dados !== 'object' || Array.isArray(dados)) {
        return `${prefixo}: informe os dados da categoria selecionada.`
    }
    if (!validarParticipacoes(dados.participacoes, item.tipoItem)) {
        return `${prefixo}: participação na ocorrência inválida.`
    }
    const camposDeOutraCategoria = ['dadosVeiculo', 'dadosArma', 'dadosDroga', 'dadosObjeto']
        .filter(campo => campo !== (
            item.tipoItem === 'veiculo' ? 'dadosVeiculo' :
            item.tipoItem === 'arma_fogo' ? 'dadosArma' :
            item.tipoItem === 'droga' ? 'dadosDroga' : 'dadosObjeto'
        ))
    if (camposDeOutraCategoria.some(campo =>
        item[campo] && Object.values(item[campo]).some(value =>
            value !== '' && value !== null && value !== undefined &&
            (!Array.isArray(value) || value.length > 0)))) {
        return `${prefixo}: existem dados de outra categoria neste item.`
    }

    if (item.tipoItem === 'veiculo') {
        const opcoes = {
            uf: [
                'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS',
                'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC',
                'SP', 'SE', 'TO'
            ],
            especie: ['Passageiro', 'Carga', 'Misto', 'Coleção', 'Competição', 'Tração', 'Especial'],
            tipoVeiculo: [
                'Automóvel', 'Bicicleta', 'Ciclomotor', 'Motocicleta', 'Trator', 'Elétrico',
                'Caminhão', 'Caminhonete', 'Camioneta', 'Ônibus', 'Outro'
            ],
            categoria: ['Particular', 'Aluguel', 'Oficial', 'Aprendizagem', 'Representação diplomática'],
            situacaoAdministrativa: [
                'Sem restrições', 'Registro de roubo/furto', 'Busca e apreensão', 'Outra'
            ]
        }
        if (Object.entries(opcoes).some(([campo, valores]) =>
            temTexto(dados[campo]) && !valores.includes(dados[campo]))) {
            return `${prefixo}: uma das opções do veículo é inválida.`
        }
        if (dados.situacaoRegistro && !['registrado', 'sem_registro'].includes(dados.situacaoRegistro)) {
            return `${prefixo}: situação de registro do veículo inválida.`
        }
        if (!dados.situacaoRegistro) {
            return `${prefixo}: informe a situação de registro do veículo.`
        }
        if (dados.situacaoRegistro === 'sem_registro' && !temTexto(dados.chassi)) {
            return `${prefixo}: informe o chassi para veículo sem registro.`
        }
        if (dados.situacaoRegistro === 'registrado' &&
            !temTexto(dados.placa) && !temTexto(dados.renavam) && !temTexto(dados.chassi)) {
            return `${prefixo}: informe placa, RENAVAM ou chassi para identificar o veículo.`
        }
        return null
    }

    if (item.tipoItem === 'arma_fogo') {
        if (!temTexto(dados.especie)) return `${prefixo}: informe a espécie da arma.`
        if (!['suprimido', 'informado', undefined, ''].includes(dados.situacaoNumeroSerie)) {
            return `${prefixo}: situação do número de série inválida.`
        }
        if (dados.situacaoNumeroSerie !== 'suprimido' && !temTexto(dados.numeroSerie)) {
            return `${prefixo}: informe o número de série ou indique que foi suprimido.`
        }
        if (dados.tipoUso && !['permitido', 'restrito'].includes(dados.tipoUso)) {
            return `${prefixo}: tipo de uso da arma inválido.`
        }
        if (dados.quantidadeCanos !== undefined && dados.quantidadeCanos !== '' &&
            (!Number.isInteger(Number(dados.quantidadeCanos)) || Number(dados.quantidadeCanos) < 1)) {
            return `${prefixo}: quantidade de canos inválida.`
        }
        if (dados.informacoesCarga !== undefined && typeof dados.informacoesCarga !== 'boolean') {
            return `${prefixo}: informação sobre carregamento inválida.`
        }
        return null
    }

    if (item.tipoItem === 'droga') {
        if (!Object.prototype.hasOwnProperty.call(unidadesPadraoDroga, dados.tipoDroga) &&
            dados.tipoDroga !== 'Outra droga') {
            return `${prefixo}: tipo de droga inválido.`
        }
        if (dados.tipoDroga === 'Outra droga') {
            if (!temTexto(dados.substancia)) return `${prefixo}: informe qual é a outra droga.`
            if (!unidadesOutraDroga.includes(dados.unidade)) {
                return `${prefixo}: unidade inválida para outra droga.`
            }
        } else if (dados.unidade !== unidadesPadraoDroga[dados.tipoDroga]) {
            return `${prefixo}: a unidade não corresponde ao tipo de droga selecionado.`
        }
        if (!quantidadeValida(dados.quantidade)) return `${prefixo}: informe uma quantidade maior que zero.`
        if (dados.informacoesCarga !== undefined && typeof dados.informacoesCarga !== 'boolean') {
            return `${prefixo}: informação sobre carregamento inválida.`
        }
        return null
    }

    if (!temTexto(dados.tipoObjeto)) return `${prefixo}: informe o tipo de objeto/bem.`
    if (!quantidadeValida(dados.quantidade)) return `${prefixo}: informe uma quantidade maior que zero.`
    if (!temTexto(dados.unidade)) return `${prefixo}: informe a unidade de medida.`
    return null
}

function validarMateriaisApreendidos(materiais) {
    if (materiais === undefined) return null
    if (!Array.isArray(materiais)) return 'A lista de itens apreendidos é inválida.'
    for (let index = 0; index < materiais.length; index += 1) {
        const erro = validarItem(materiais[index], index)
        if (erro) return erro
    }
    return null
}

module.exports = { validarMateriaisApreendidos }
