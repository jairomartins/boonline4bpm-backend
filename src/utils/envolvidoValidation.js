const coresRacas = ['Branca', 'Preta', 'Parda', 'Amarela', 'Indígena']
const sexos = ['Masculino', 'Feminino', 'Outro', 'Prefiro não dizer']
const estadosCivis = [
    'Solteiro(a)', 'Casado(a)', 'União estável', 'Separado(a)', 'Divorciado(a)', 'Viúvo(a)'
]
const escolaridades = [
    'Não alfabetizado',
    'Ensino fundamental incompleto',
    'Ensino fundamental cursando',
    'Ensino fundamental completo',
    'Ensino médio incompleto',
    'Ensino médio cursando',
    'Ensino médio completo',
    'Ensino superior incompleto',
    'Ensino superior cursando',
    'Ensino superior completo',
    'Pós-graduação'
]
const tiposEnvolvimento = [
    'Autor', 'Suspeito', 'Condutor', 'Vítima', 'Testemunha', 'Comunicante', 'Vítima Fatal', 'Outro'
]

function isValidCpf(value) {
    const cpf = String(value || '').replace(/\D/g, '')
    if (!/^\d{11}$/.test(cpf) || /^(\d)\1{10}$/.test(cpf)) return false
    const digits = cpf.split('').map(Number)
    for (let position = 9; position < 11; position += 1) {
        const sum = digits.slice(0, position)
            .reduce((total, digit, index) => total + digit * (position + 1 - index), 0)
        const remainder = (sum * 10) % 11
        if (digits[position] !== (remainder === 10 ? 0 : remainder)) return false
    }
    return true
}

function isValidDate(value) {
    if (typeof value !== 'string') return false
    let year
    let month
    let day
    let match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value)
    if (match) {
        day = Number(match[1])
        month = Number(match[2])
        year = Number(match[3])
    } else {
        match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
        if (!match) return false
        year = Number(match[1])
        month = Number(match[2])
        day = Number(match[3])
    }
    const date = new Date(year, month - 1, day)
    const hoje = new Date()
    hoje.setHours(23, 59, 59, 999)
    return date.getFullYear() === year &&
        date.getMonth() === month - 1 &&
        date.getDate() === day &&
        date <= hoje
}

const telefoneValido = value => {
    const texto = String(value || '').trim()
    const digitos = texto.replace(/\D/g, '')
    return /^[+0-9\s().-]+$/.test(texto) && digitos.length >= 7 && digitos.length <= 15
}

function validarEnvolvidos(envolvidos, existing = []) {
    if (envolvidos === undefined) return null
    if (!Array.isArray(envolvidos)) return 'A lista de envolvidos é inválida.'
    for (let index = 0; index < envolvidos.length; index += 1) {
        const item = envolvidos[index]
        const prefixo = `Envolvido ${index + 1}`
        if (!item || typeof item !== 'object' || Array.isArray(item)) {
            return `${prefixo}: cadastro inválido.`
        }
        const identificadores = [item.id, item._id].filter(Boolean).map(String)
        const anterior = existing.find(valor =>
            [valor.id, valor._id].filter(Boolean).some(id => identificadores.includes(String(id)))
        )
        const existente = Boolean(anterior)
        if (!existente && (typeof item.nome !== 'string' || !item.nome.trim())) {
            return `${prefixo}: informe o nome completo.`
        }
        if (item.nome !== undefined && (typeof item.nome !== 'string' || !item.nome.trim())) {
            return `${prefixo}: informe o nome completo.`
        }
        if (item.cpf && !isValidCpf(item.cpf)) {
            return `${prefixo}: informe um CPF válido ou deixe o campo em branco.`
        }
        if (item.nascimento && !isValidDate(item.nascimento)) {
            return `${prefixo}: informe uma data de nascimento válida e não futura.`
        }
        if (item.telefone && !telefoneValido(item.telefone)) {
            return `${prefixo}: informe um telefone válido.`
        }
        if (item.tipo && !tiposEnvolvimento.includes(item.tipo)) {
            return `${prefixo}: tipo de envolvimento inválido.`
        }
        if (item.sexo && !sexos.includes(item.sexo) &&
            !(existente && item.sexo === anterior.sexo)) {
            return `${prefixo}: sexo inválido.`
        }
        if (item.corRaca && !coresRacas.includes(item.corRaca) &&
            !(existente && item.corRaca === anterior.corRaca)) {
            return `${prefixo}: opção de cor ou raça inválida.`
        }
        if (item.estadoCivil && !estadosCivis.includes(item.estadoCivil) &&
            !(existente && item.estadoCivil === anterior.estadoCivil)) {
            return `${prefixo}: estado civil inválido.`
        }
        if (item.escolaridade && !escolaridades.includes(item.escolaridade) &&
            !(existente && item.escolaridade === anterior.escolaridade)) {
            return `${prefixo}: escolaridade inválida.`
        }
        if (item.uf !== undefined && item.uf !== null && typeof item.uf !== 'string') {
            return `${prefixo}: informe um estado/UF válido.`
        }
        if (item.conduzido !== undefined && typeof item.conduzido !== 'boolean') {
            return `${prefixo}: situação de condução inválida.`
        }
    }
    return null
}

function mesclarEnvolvidosExistentes(recebidos, existentes = []) {
    return recebidos.map(envolvido => {
        const anterior = existentes.find(item =>
            (envolvido.id && item.id === envolvido.id) ||
            (envolvido._id && String(item._id) === String(envolvido._id))
        )
        if (!anterior) return envolvido
        const anteriorObj = typeof anterior.toObject === 'function' ? anterior.toObject() : anterior
        const atualizacao = Object.fromEntries(
            Object.entries(envolvido).filter(([campo, valor]) =>
                !(typeof valor === 'string' && valor.trim() === '' &&
                    anteriorObj[campo] !== undefined && anteriorObj[campo] !== '')
            )
        )
        return { ...anteriorObj, ...atualizacao }
    })
}

module.exports = { isValidCpf, isValidDate, mesclarEnvolvidosExistentes, validarEnvolvidos }
