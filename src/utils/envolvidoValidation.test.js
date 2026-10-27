const test = require('node:test')
const assert = require('node:assert/strict')
const {
    isValidCpf,
    isValidDate,
    mesclarEnvolvidosExistentes,
    validarEnvolvidos
} = require('./envolvidoValidation')

test('valida CPF e data sem bloquear informações pessoais opcionais ausentes', () => {
    assert.equal(isValidCpf('529.982.247-25'), true)
    assert.equal(isValidCpf('529.982.247-24'), false)
    assert.equal(isValidDate('31/02/1990'), false)
    assert.equal(isValidDate('10/05/2099'), false)
    assert.equal(validarEnvolvidos([{ nome: 'Pessoa', cpf: '', nascimento: '', telefone: '' }]), null)
})

test('valida opções, formato de contato e qualificação da pessoa', () => {
    assert.match(validarEnvolvidos([{ nome: 'Pessoa', cpf: '529.982.247-24' }]), /CPF válido/)
    assert.match(validarEnvolvidos([{ nome: 'Pessoa', nascimento: '31/02/1990' }]), /data de nascimento/)
    assert.match(validarEnvolvidos([{ nome: 'Pessoa', telefone: '123' }]), /telefone válido/)
    assert.match(validarEnvolvidos([{ nome: 'Pessoa', telefone: 'abcdefg123' }]), /telefone válido/)
    assert.match(validarEnvolvidos([{ nome: 'Pessoa', corRaca: 'Opção inventada' }]), /cor ou raça/)
    assert.match(validarEnvolvidos([{ nome: 'Pessoa', uf: { nome: 'UF' } }]), /estado\/UF/)
    assert.match(validarEnvolvidos([{}]), /nome completo/)
})

test('aceita registros legados esparsos e campos adicionais não reconhecidos', () => {
    assert.equal(validarEnvolvidos([
        { id: 'legacy-1', nome: 'Pessoa antiga', endereco: 'Endereço completo antigo', campoAnterior: 'preservar' }
    ], [{ id: 'legacy-1', nome: 'Pessoa antiga' }]), null)
})

test('mescla edições parciais sem apagar propriedades ausentes ou valores existentes com strings vazias', () => {
    const atualizados = mesclarEnvolvidosExistentes([{
        id: 'person-1',
        nome: 'Nome atualizado',
        endereco: '',
        profissao: 'Professora'
    }], [{
        id: 'person-1',
        nome: 'Nome antigo',
        endereco: 'Rua antiga',
        nomePai: 'Pai',
        campoDesconhecido: 'Preservar'
    }])
    assert.deepEqual(atualizados[0], {
        id: 'person-1',
        nome: 'Nome atualizado',
        endereco: 'Rua antiga',
        nomePai: 'Pai',
        campoDesconhecido: 'Preservar',
        profissao: 'Professora'
    })
})
