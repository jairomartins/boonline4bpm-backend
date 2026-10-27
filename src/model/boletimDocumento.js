const mongoose = require('../database/db')

const BoletimDocumentoSchema = new mongoose.Schema({
    incidentReportId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Boletim',
        required: true,
        index: true
    },
    version: { type: Number, required: true },
    reportRevision: { type: Number, required: true },
    pdfLayoutVersion: { type: Number, required: true },
    tokenHash: { type: String, required: true, unique: true, select: false },
    status: {
        type: String,
        enum: ['valid', 'superseded', 'revoked'],
        default: 'valid',
        required: true
    },
    statusChangedAt: { type: Date },
    statusChangedBy: { type: String },
    issuedAt: { type: Date, required: true },
    issuedBy: { type: String, required: true },
    pdfHash: { type: String, required: true },
    pdf: { type: Buffer, required: true, select: false }
}, { timestamps: true })

BoletimDocumentoSchema.index({ incidentReportId: 1, version: 1 }, { unique: true })

module.exports = mongoose.models.BoletimDocumento ||
    mongoose.model('BoletimDocumento', BoletimDocumentoSchema)
