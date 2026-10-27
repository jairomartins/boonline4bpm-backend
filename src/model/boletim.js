const mongoose = require('../database/db')

const EnvolvidoSchema = new mongoose.Schema({
    tipo:String,
    nome:String,
    nomeSocial:String,
    alcunha:String,
    cpf:String,
    cnhPpd:String,
    conduzido: { type: Boolean, default: false },
    corRaca:String,
    sexo:String,
    nascimento:String,
    orientacaoSexual:String,
    naturalidade:String,
    profissao:String,
    estadoCivil:String,
    escolaridade:String,
    endereco:String,
    numero:String,
    complemento:String,
    pontoReferencia:String,
    bairro:String,
    municipio:String,
    uf:String,
    telefone:String,
    nomeMae:String,
    nomePai:String,
    obs:String
}, { strict: false })

const MaterialSchema = new mongoose.Schema({
    tipoItem: {
        type: String,
        enum: ['veiculo', 'arma_fogo', 'droga', 'outro_objeto'],
        required: false
    },
    dadosVeiculo: {
        pais: String,
        placa: String,
        uf: String,
        renavam: String,
        chassi: String,
        municipioRegistro: String,
        situacaoRegistro: String,
        especie: String,
        tipoVeiculo: String,
        marca: String,
        modelo: String,
        categoria: String,
        corPredominante: String,
        anoFabricacao: String,
        anoModelo: String,
        situacaoAdministrativa: String,
        proprietario: String,
        participacoes: [String]
    },
    dadosArma: {
        especie: String,
        marca: String,
        modelo: String,
        acabamento: String,
        quantidadeCanos: String,
        fabricacao: String,
        tipoUso: String,
        calibreReal: String,
        numeroRegistro: String,
        numeroSerie: String,
        situacaoNumeroSerie: String,
        participacoes: [String],
        informacoesCarga: Boolean
    },
    dadosDroga: {
        tipoDroga: String,
        substancia: String,
        quantidade: Number,
        unidade: String,
        participacoes: [String],
        informacoesCarga: Boolean,
        observacoes: String
    },
    dadosObjeto: {
        tipoObjeto: String,
        quantidade: Number,
        unidade: String,
        participacoes: [String],
        observacoes: String
    },
    descricao:{
        type:String,
        required:false
    },
    quantidade:{
        type:String
    }
}, { strict: false }
)

// dados de cadastro de efetivo
const EfetivoSchema = new mongoose.Schema({
    vtr:{
        type:String
    },
    nome:{
        type:String,
        uppercase:true
    },
    graduacao:{
        type:String
    },
    numeroBarra:{
        type:String
    },
    id:{
        type:String
    },
})



const BoScheme = new mongoose.Schema({
    creatorId: String,
    documentRevision: { type: Number, default: 0 },
    documentVersionSequence: { type: Number, default: 0 },
    currentDocumentVersion: { type: Number, default: 0 },
    numero:String,
    natureza:String,
    naturezaId: { type: mongoose.Schema.Types.ObjectId, ref: 'Natureza', required: false, index: true },
    naturezaIds: { type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Natureza' }], default: [], index: true },
    naturezaOriginal: { type: String, required: false },
    naturezaCatalogoMigrada: { type: Boolean, required: false },
    data:String,
    horario:String,
    latitude:String,
    longitude:String,
    endereco:String,
    numeroEndereco:String,
    bairro:String,
    municipio:String,
    referencia:String,
    envolvidos:[EnvolvidoSchema],
    materiaisApreendidos:[MaterialSchema],
    efetivo:[EfetivoSchema],
    historicohtml:String

}, { timestamps: true })

BoScheme.index({ municipio: 1, createdAt: -1 })
BoScheme.index({ municipio: 1, naturezaIds: 1 })
BoScheme.index({ municipio: 1, bairro: 1 })

const Boletim = mongoose.model('Boletim',BoScheme)

module.exports = Boletim