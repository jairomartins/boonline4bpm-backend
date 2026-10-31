const mongoose = require('../database/db')
const { normalizarNatureza } = require('../utils/natureza')

const NaturezaSchema = new mongoose.Schema({
    nome: { type: String, required: true, trim: true, maxlength: 500 },
    normalizado: { type: String, required: true, unique: true },
    ativo: { type: Boolean, default: true, required: true }
}, { timestamps: false, versionKey: false, autoIndex: false })

NaturezaSchema.pre('validate', function (next) {
    this.nome = typeof this.nome === 'string' ? this.nome.trim().replace(/\s+/g, ' ') : this.nome
    this.normalizado = normalizarNatureza(this.nome)
    next()
})

module.exports = mongoose.models.Natureza || mongoose.model('Natureza', NaturezaSchema)
