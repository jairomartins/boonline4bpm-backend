const express = require('express')
const controller = require('../controllers/localidadeController')
const { verificaToken } = require('../lib/jwtconfig')
const { requireAnyPermission, requirePermission } = require('../utils/authorization')

function localidadeRoute(app) {
    const router = express.Router()
    router.use(verificaToken, (req, res, next) => req.user?.userId ? next() : res.status(401).json({ message: 'Faça login novamente.' }))
    router.get('/sugestoes-duplicidade', requirePermission('localidades.manage'), controller.sugestoesDuplicidade)
    router.post('/reconciliar', requirePermission('localidades.manage'), controller.associarHistorico)
    router.get('/:id/boletins', requirePermission('localidades.manage'), controller.boletins)
    router.get('/:id/auditoria', requirePermission('localidades.manage'), controller.auditoria)
    router.post('/registrar-no-boletim', requireAnyPermission(['boletins.create', 'boletins.edit.own', 'boletins.edit.all']), controller.registrarPeloBoletim)
    router.get('/:id', controller.consultar)
    router.get('/', controller.listar)
    router.post('/', requirePermission('localidades.manage'), controller.criar)
    router.put('/:id', requirePermission('localidades.manage'), controller.editar)
    router.patch('/:id/status', requirePermission('localidades.manage'), controller.status)
    app.use('/localidades', router)
}
module.exports = localidadeRoute
