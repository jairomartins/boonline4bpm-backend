const test = require('node:test')
const assert = require('node:assert/strict')
const { validarMateriaisApreendidos } = require('./materialValidation')

test('aceita registros legados sem conversão e vários itens tipados no mesmo boletim', () => {
    assert.equal(validarMateriaisApreendidos([
        { descricao: 'Celular antigo', quantidade: '1' },
        { tipoItem: 'veiculo', dadosVeiculo: { situacaoRegistro: 'sem_registro', chassi: 'ABC123' } },
        { tipoItem: 'arma_fogo', dadosArma: { especie: 'Pistola', situacaoNumeroSerie: 'suprimido' } },
        { tipoItem: 'arma_branca', dadosArmaBranca: { tipoArmaBranca: 'Faca', quantidade: 1 } },
        { tipoItem: 'droga', dadosDroga: { tipoDroga: 'Ecstasy', unidade: 'comprimido', quantidade: 2 } },
        { tipoItem: 'outro_objeto', dadosObjeto: { tipoObjeto: 'Notebook', quantidade: 2, unidade: 'unidade' } }
    ]), null)
})

test('rejeita categoria e dados obrigatórios inválidos no servidor', () => {
    assert.match(validarMateriaisApreendidos([{ tipoItem: 'desconhecido' }]), /tipo de item inválido/)
    assert.match(validarMateriaisApreendidos([
        { tipoItem: 'veiculo', dadosVeiculo: { situacaoRegistro: 'sem_registro' } }
    ]), /chassi/)
    assert.match(validarMateriaisApreendidos([
        { tipoItem: 'veiculo', dadosVeiculo: { situacaoRegistro: 'registrado' } }
    ]), /placa, RENAVAM ou chassi/)
    assert.match(validarMateriaisApreendidos([
        { tipoItem: 'arma_fogo', dadosArma: { especie: 'Revólver', situacaoNumeroSerie: 'informado' } }
    ]), /número de série/)
    assert.match(validarMateriaisApreendidos([
        { tipoItem: 'droga', dadosDroga: { tipoDroga: 'Maconha', unidade: 'ml', quantidade: 1 } }
    ]), /unidade/)
    assert.match(validarMateriaisApreendidos([
        { tipoItem: 'droga', dadosDroga: { tipoDroga: 'Outra droga', substancia: 'X', unidade: 'kg', quantidade: 1 } }
    ]), /unidade/)
    assert.match(validarMateriaisApreendidos([
        { tipoItem: 'outro_objeto', dadosObjeto: { tipoObjeto: 'Celular', quantidade: 0, unidade: 'unidade' } }
    ]), /quantidade/)
    assert.match(validarMateriaisApreendidos([
        { tipoItem: 'arma_branca', dadosArmaBranca: { tipoArmaBranca: 'Espada', quantidade: 1.5 } }
    ]), /quantidade inteira positiva/)
    assert.match(validarMateriaisApreendidos([
        { tipoItem: 'arma_branca', dadosArmaBranca: { tipoArmaBranca: 'Objeto', quantidade: 1 } }
    ]), /tipo de arma branca/)
    assert.match(validarMateriaisApreendidos([
        { tipoItem: 'arma_branca', dadosArmaBranca: { tipoArmaBranca: 'Faca', quantidade: 1, estadoConservacao: 'novo' } }
    ]), /estado de conservação/)
    assert.match(validarMateriaisApreendidos([
        { tipoItem: 'arma_branca', dadosArmaBranca: { tipoArmaBranca: 'Faca', quantidade: 1, descricao: 'x'.repeat(501) } }
    ]), /no máximo 500 caracteres/)
})

test('valida participações múltiplas e uso restrito de valores conhecidos', () => {
    assert.equal(validarMateriaisApreendidos([{
        tipoItem: 'outro_objeto',
        dadosObjeto: {
            tipoObjeto: 'Bicicleta',
            quantidade: 1,
            unidade: 'unidade',
            participacoes: ['apreendido', 'encontrado']
        }
    }]), null)
    assert.match(validarMateriaisApreendidos([{
        tipoItem: 'outro_objeto',
        dadosObjeto: { tipoObjeto: 'Bicicleta', quantidade: 1, unidade: 'unidade', participacoes: ['inventado'] }
    }]), /participação/)
})
