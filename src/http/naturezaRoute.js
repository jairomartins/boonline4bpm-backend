const express = require('express')
const naturezaController = require('../controllers/naturezaController')
const { verificaToken } = require('../lib/jwtconfig')
const { requirePermission } = require('../utils/authorization')

function exigeIdentidade(req, res, next) {
    if (req.user && req.user.userId) return next()
    return res.status(401).json({ message: 'Faça login novamente para continuar.' })
}

function naturezaRoute(app) {
    const router = express.Router()
    router.use(verificaToken, exigeIdentidade)
    router.get('/', naturezaController.listar)
    router.get('/:id', naturezaController.consultar)
    router.post('/', requirePermission('naturezas.manage'), naturezaController.criar)
    router.put('/:id', requirePermission('naturezas.manage'), naturezaController.editar)
    router.patch('/:id/status', requirePermission('naturezas.manage'), naturezaController.alterarStatus)
    app.use('/naturezas', router)
}

module.exports = naturezaRoute
