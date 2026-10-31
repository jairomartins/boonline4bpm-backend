require('dotenv').config()
const { requireExplicitMongo } = require('./maintenanceDb')
if (require.main === module) requireExplicitMongo()
const mongoose = require('../database/db')
const User = require('../model/user')
const roleController = require('../controllers/roleController')

async function migrateRoles() {
    await roleController.seedInitialRoles()
    const activeLegacyAdministrators = await User.countDocuments({
        tipo: 'admin',
        isAtivo: { $nin: [false, 'false'] }
    })
    if (!activeLegacyAdministrators) {
        throw new Error('Migração interrompida: não há conta administrativa ativa legada para preservar.')
    }

    await User.updateMany(
        { roleKey: { $in: [null, ''] }, tipo: 'admin' },
        { $set: { roleKey: 'administrador' } }
    )
    await User.updateMany(
        { roleKey: { $in: [null, ''] }, tipo: { $ne: 'admin' } },
        { $set: { roleKey: 'basico' } }
    )
}

if (require.main === module) migrateRoles()
    .then(() => console.log('Roles iniciais cadastradas e perfis legados mapeados sem remover dados.'))
    .catch(error => {
        console.error('Migração de roles não concluída:', error)
        process.exitCode = 1
    })
    .finally(() => mongoose.disconnect())

module.exports = migrateRoles
