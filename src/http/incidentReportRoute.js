const express = require('express')
const incidentReportController = require('../controllers/incidentReportController')

// TODO - VERIFICAR O TOKEN ANTES DE EXECUTAR FUNÇÃO 

const {verificaToken} = require('../lib/jwtconfig')


function incidentReportRoute (app){
    const router = express.Router()

    // create incident report route
    router.post('/create', async (req, res)=>{
        await incidentReportController.createOrUpdateIncidentReport(req, res)
    })

    //delete incident report by id route
    router.delete('/remove/:id', async(req, res)=>{
        await incidentReportController.removeIncidentReport(req, res)
    })
 
    //the route  all incident reports on system
    router.get('/',async (req ,res )=>{
        await incidentReportController.incidentReports( req, res)
    })

    //route to get incident report by ID
    router.get('/:incidentReportId',async(req, res) => {
        await incidentReportController.incidentReportByID(req, res)
    })

    //route to list incident reports by number and city
    router.get('/:city/:number', async(req, res) => {
        await incidentReportController.incidentReportByCityAndNumber(req, res)
    })

    //route to list incident reports by date
    router.get('/:dia/:mes/:ano', async (req,res)=>{
        await incidentReportController.incidentReportListByDate(req, res)
    })

    //route to get incident report by number
    router.get('/:number', async (req, res)=>{
        await incidentReportController.incidentReportByNumber(req,res)
    })

    app.use('/incidentReport', router)
}

module.exports = incidentReportRoute