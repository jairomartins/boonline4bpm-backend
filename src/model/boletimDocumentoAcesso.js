const mongoose = require('../database/db')

const BoletimDocumentoAcessoSchema = new mongoose.Schema({
    documentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'BoletimDocumento',
        required: true,
        index: true
    },
    incidentReportId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Boletim',
        required: true,
        index: true
    },
    action: { type: String, enum: ['downloaded'], required: true },
    actorId: { type: String, required: true }
}, { timestamps: { createdAt: true, updatedAt: false } })

module.exports = mongoose.models.BoletimDocumentoAcesso ||
    mongoose.model('BoletimDocumentoAcesso', BoletimDocumentoAcessoSchema)
