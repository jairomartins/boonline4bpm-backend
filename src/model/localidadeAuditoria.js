const mongoose = require('../database/db')
const LocalidadeAuditoriaSchema = new mongoose.Schema({
    localidadeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Localidade', required: true, index: true },
    acao: { type: String, enum: ['ASSOCIAR_GRAFIA', 'CORRIGIR_ASSOCIACAO'], required: true },
    municipio: { type: String, required: true },
    grafia: String,
    boletimId: { type: mongoose.Schema.Types.ObjectId, ref: 'Boletim' },
    administradorId: { type: String, required: true },
    registrosAfetados: { type: Number, default: 0 },
}, { timestamps: true })
module.exports = mongoose.models.LocalidadeAuditoria || mongoose.model('LocalidadeAuditoria', LocalidadeAuditoriaSchema)
