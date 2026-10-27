const mongoose = require('../database/db')

const RoleSchema = new mongoose.Schema({
    key: { type: String, required: true, lowercase: true, trim: true },
    name: { type: String, required: true, trim: true },
    normalizedName: { type: String, required: true, unique: true, lowercase: true, trim: true },
    description: { type: String, default: '' },
    permissions: { type: [String], default: [] },
    active: { type: Boolean, default: true },
    system: { type: Boolean, default: false },
    createdBy: { type: String, default: null },
    updatedBy: { type: String, default: null }
}, { timestamps: true })

RoleSchema.index({ key: 1 }, { unique: true })
RoleSchema.index({ normalizedName: 1 }, { unique: true })

module.exports = mongoose.model('Role', RoleSchema)
