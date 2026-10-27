const mongoose = require('../database/db')
const { normalizarNatureza } = require('../utils/natureza')

const NaturezaSchema = new mongoose.Schema({
    nome: { type: String, required: true, trim: true, maxlength: 500 },
    normalizado: { type: String, required: true, unique: true },
    categoria: { type: String, trim: true, maxlength: 100, default: '' },
    codigos: { type: [String], default: [] },
    descricao: { type: String, trim: true, maxlength: 1000, default: '' },
    aliases: { type: [String], default: [] },
    ativo: { type: Boolean, default: true, required: true }
}, { timestamps: true })

NaturezaSchema.pre('validate', function (next) {
    this.nome = typeof this.nome === 'string' ? this.nome.trim().replace(/\s+/g, ' ') : this.nome
    this.normalizado = normalizarNatureza(this.nome)
    next()
})

module.exports = mongoose.models.Natureza || mongoose.model('Natureza', NaturezaSchema)
