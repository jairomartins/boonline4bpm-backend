const mongoose = require('../database/db')

const AdminAuditLogSchema = new mongoose.Schema({
    actorId: { type: String, required: true, index: true },
    action: { type: String, required: true, index: true },
    targetType: { type: String, required: true },
    targetId: { type: String, required: true },
    details: { type: mongoose.Schema.Types.Mixed, default: {} }
}, { timestamps: { createdAt: true, updatedAt: false } })

module.exports = mongoose.model('AdminAuditLog', AdminAuditLogSchema)
