const express = require('express')
const { rateLimit } = require('express-rate-limit')
const incidentReportController = require('../controllers/incidentReportController')
const boletimDocumentoController = require('../controllers/boletimDocumentoController')
const operationalStatisticsController = require('../controllers/operationalStatisticsController')

const { verificaToken } = require('../lib/jwtconfig')
const { requirePermission, requireAnyPermission } = require('../utils/authorization')

const exigeAdmin = requirePermission('boletins.view.all')
const exigeIdentidade = (req, res, next) => {
    if (req.user && req.user.userId) return next()
    return res.status(401).json({ message: "Faça login novamente para continuar." })
}

function incidentReportRoute (app){
    const router = express.Router()
    const publicValidationLimit = rateLimit({
        windowMs: 60 * 1000,
        limit: 30,
        standardHeaders: true,
        legacyHeaders: false,
        handler: (_req, res) => res.status(429).json({
            message: 'Limite de consultas atingido. Tente novamente mais tarde.'
        })
    })
    const operationalStatisticsLimit = rateLimit({
        windowMs: 60 * 1000,
        limit: 60,
        standardHeaders: true,
        legacyHeaders: false,
        message: { message: 'Muitas consultas de estatísticas. Aguarde antes de tentar novamente.' }
    })

    router.get('/documents/validation/:token', publicValidationLimit, async (req, res) => {
        await boletimDocumentoController.validate(req, res)
    })

    router.get('/documents/validation/:token/pdf', verificaToken, exigeIdentidade, async (req, res) => {
        await boletimDocumentoController.download(req, res)
    })

    router.get('/documents/validation/:token/details', verificaToken, exigeIdentidade, async (req, res) => {
        await boletimDocumentoController.details(req, res)
    })

    router.post('/documents/validation/:token/revoke', verificaToken, exigeIdentidade, async (req, res) => {
        await boletimDocumentoController.revoke(req, res)
    })

    router.post('/:incidentReportId/documents', verificaToken, exigeIdentidade, requirePermission('boletins.print'), async (req, res) => {
        await boletimDocumentoController.emit(req, res)
    })

    // route to get all incident reports with domestic violence nature
    router.get('/domestic', verificaToken, exigeIdentidade, exigeAdmin, async (req, res) => {
    try {
        await incidentReportController.incidentReportsByViolenceDomestic(req, res);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Erro ao buscar ocorrências de violência doméstica" });
    }
    });

    // Create or update incident report.
    router.post('/create', verificaToken, exigeIdentidade, async (req, res)=>{
        await incidentReportController.createOrUpdateIncidentReport(req, res)
    })

    // Delete incident report by ID.
    router.delete('/remove/:id', verificaToken, exigeIdentidade, requireAnyPermission(['boletins.delete.own', 'boletins.delete']), async(req, res)=>{
        await incidentReportController.removeIncidentReport(req, res)
    })

    router.get('/search', verificaToken, exigeIdentidade, requireAnyPermission(['boletins.view.own', 'boletins.view.all']), async (req, res) => {
        await incidentReportController.searchIncidentReports(req, res)
    })

    router.get('/statistics', verificaToken, exigeIdentidade, requirePermission('statistics.view'), async (req, res) => {
        await incidentReportController.incidentReportStatistics(req, res)
    })

    router.get('/statistics/operational', verificaToken, exigeIdentidade, requirePermission('statistics.view'), operationalStatisticsLimit, async (req, res) => {
        await operationalStatisticsController.operationalStatistics(req, res)
    })

    router.get('/statistics/geographic/options', verificaToken, exigeIdentidade, requirePermission('map.view'), async (req, res) => {
        await incidentReportController.incidentReportGeographicOptions(req, res)
    })

    router.get('/statistics/geographic', verificaToken, exigeIdentidade, requirePermission('map.view'), async (req, res) => {
        await incidentReportController.incidentReportGeographic(req, res)
    })

    router.get('/involved/cpf/:cpf', verificaToken, exigeIdentidade, requireAnyPermission(['boletins.view.own', 'boletins.view.all']), async (req, res) => {
        await incidentReportController.buscarEnvolvidoPorCpf(req, res)
    })

    //the route  all incident reports on system
    router.get('/', verificaToken, exigeIdentidade, exigeAdmin, async (req ,res )=>{
        await incidentReportController.incidentReports( req, res)
    })

    router.get('/date/:day/:month/:year', verificaToken, exigeIdentidade, exigeAdmin, async (req, res) => {
        await incidentReportController.incidentReportListByDate(req, res)
    })

    router.get('/city/:city/:number', verificaToken, exigeIdentidade, exigeAdmin, async (req, res) => {
        await incidentReportController.incidentReportByCityAndNumber(req, res)
    })

    router.get('/number/:number', verificaToken, exigeIdentidade, exigeAdmin, async (req, res) => {
        await incidentReportController.incidentReportByNumber(req, res)
    })

    //route to get incident report by ID
    router.get('/:incidentReportId', verificaToken, exigeIdentidade, requireAnyPermission(['boletins.view.own', 'boletins.view.all']), async(req, res) => {
        await incidentReportController.incidentReportByID(req, res)
    })

    //route to list incident reports by number and city
    router.get('/:city/:number', verificaToken, exigeIdentidade, exigeAdmin, async(req, res) => {
        await incidentReportController.incidentReportByCityAndNumber(req, res)
    })

    //route to list incident reports by date
    router.get('/:day/:month/:year', verificaToken, exigeIdentidade, exigeAdmin, async (req,res)=>{
        await incidentReportController.incidentReportListByDate(req, res)
    })

    app.use('/incidentReport', router)
}

module.exports = incidentReportRoute
