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
        enum: ['veiculo', 'arma_fogo', 'arma_branca', 'droga', 'outro_objeto'],
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
    dadosArmaBranca: {
        tipoArmaBranca: String,
        descricao: String,
        quantidade: Number,
        marca: String,
        materialFabricacao: String,
        comprimentoAproximadoCm: Number,
        caracteristicasDistintivas: String,
        estadoConservacao: String,
        observacoes: String,
        participacoes: [String]
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
    clientRequestId: { type: String, required: false },
    lastClientMutationId: { type: String, required: false },
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
    dataOcorrencia: { type: Date, required: false },
    horario:String,
    latitude:String,
    longitude:String,
    endereco:String,
    numeroEndereco:String,
    bairro:String,
    municipio:String,
    localidadeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Localidade', required: false },
    localidadeNome: String,
    localidadeTipo: String,
    zona: { type: String, enum: ['URBANA', 'RURAL', 'NAO_INFORMADA'], required: false },
    referencia:String,
    envolvidos:[EnvolvidoSchema],
    materiaisApreendidos:[MaterialSchema],
    efetivo:[EfetivoSchema],
    historicohtml:String

}, { timestamps: true, autoIndex: process.env.NODE_ENV !== 'production' && process.env.MIGRATION_MODE !== 'true' })

BoScheme.index({ municipio: 1, createdAt: -1 })
BoScheme.index({ dataOcorrencia: 1 })
BoScheme.index({ municipio: 1, dataOcorrencia: 1 })
BoScheme.index({ municipio: 1, naturezaIds: 1 })
BoScheme.index({ municipio: 1, bairro: 1 })
BoScheme.index({ 'efetivo.id': 1, createdAt: -1 })
BoScheme.index({ 'efetivo.numeroBarra': 1, createdAt: -1 })
BoScheme.index(
    { creatorId: 1, clientRequestId: 1 },
    {
        unique: true,
        partialFilterExpression: { clientRequestId: { $type: 'string' } },
        name: 'creator_clientRequestId_unique'
    }
)

const Boletim = mongoose.model('Boletim',BoScheme)

module.exports = Boletim
