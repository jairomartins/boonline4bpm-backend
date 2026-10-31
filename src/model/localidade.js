const mongoose = require('../database/db')
const { normalizarLocalidade, TIPOS_LOCALIDADE, ZONAS } = require('../utils/localidade')

const LocalidadeSchema = new mongoose.Schema({
    nome: { type: String, required: true, trim: true, maxlength: 160 },
    nomeNormalizado: { type: String, required: true, index: true },
    municipio: { type: String, required: true, trim: true, maxlength: 120 },
    tipo: { type: String, enum: TIPOS_LOCALIDADE, required: true },
    zona: { type: String, enum: ZONAS, default: 'NAO_INFORMADA', required: true },
    aliases: { type: [String], default: [] },
    aliasesNormalizados: { type: [String], default: [] },
    ativo: { type: Boolean, default: true },
}, { timestamps: true })

LocalidadeSchema.pre('validate', function(next) {
    this.nomeNormalizado = normalizarLocalidade(this.nome)
    this.aliases = [...new Set((this.aliases || []).map(value => String(value).trim()).filter(Boolean))]
    this.aliasesNormalizados = [...new Set(this.aliases.map(normalizarLocalidade).filter(Boolean))]
    next()
})
LocalidadeSchema.index({ municipio: 1, nomeNormalizado: 1 }, { unique: true, name: 'uniq_localidade_municipio_nome' })
LocalidadeSchema.index({ municipio: 1, aliasesNormalizados: 1 }, { name: 'localidade_aliases_busca' })
module.exports = mongoose.models.Localidade || mongoose.model('Localidade', LocalidadeSchema)
