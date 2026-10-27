const express = require('express')
const roleController = require('../controllers/roleController')
const { verificaToken } = require('../lib/jwtconfig')
const { requirePermission } = require('../utils/authorization')

function roleRoute(app) {
    const router = express.Router()
    router.use(verificaToken)

    router.get('/me', async (req, res) => roleController.currentAccess(req, res))
    router.get('/roles', requirePermission('roles.view'), async (req, res) => roleController.listRoles(req, res))
    router.post('/roles', requirePermission('roles.manage'), async (req, res) => roleController.createRole(req, res))
    router.put('/roles/:id', requirePermission('roles.manage'), async (req, res) => roleController.updateRole(req, res))
    router.patch('/users/:id/role', requirePermission('users.manage'), async (req, res) => roleController.assignUserRole(req, res))
    router.patch('/users/:id/status', requirePermission('users.manage'), async (req, res) => roleController.setUserStatus(req, res))

    app.use('/access', router)
}

module.exports = roleRoute
