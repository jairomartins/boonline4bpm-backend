const boletimController = require('../controllers/boletimController')

// TODO - VERIFICAR O TOKEN ANTES DE EXECUTAR FUNÇÃO 

const {verificaToken} = require('../lib/jwtconfig')


function route (app){
 
    app.get('/adm/boletim/list',async (req ,res )=>{
        await boletimController.BoletimList( req, res)
    })

    app.get('/adm/boletim/listByID/:IDBoletim',async(req, res) => {
        await boletimController.boletimByID(req, res)
    })

    app.get('/adm/boletim/list/:numeroBoletim/:cidade', async(req, res) => {
        await boletimController.boletimByNumeroAndCidade(req, res)
    })

    app.post('/adm/boletim/create', async (req, res)=>{
        await boletimController.createBoletim(req, res)
    })

    app.post('/adm/boletim/search/:numero', async (req, res)=>{
        // buscar boletim de ocorrencia de acordo com o numero repassado
        await boletimController.boletimByNumero(req,res)
    })

    app.post('/adm/boletim/update', async (req, res)=>{
        // atualizar boletim de ocorrencia de acordo com o numero repassado
        await boletimController.createBoletim(req,res)
    })

    app.post('/adm/boletim/delete/:id', async (req, res)=>{
        // TODO - remover boletim de ocorrencia de acordo com o numero repassado
        await boletimController.removeBoletimByID(req,res)
    })

    // lista boletins de um usuario pelo id do policial empregado no efetivo
    app.get('/adm/boletim/list/:id', async (req,res)=>{
        await boletimController.listaMeusBos(req, res)
    })
    
    app.get('/adm/boletim/count/', async (req,res)=>{
        await boletimController.countBoletim(req, res)
    })

    app.get('/adm/boletim/naturezaList/', async (req,res)=>{
        await boletimController.naturezaListBoletim(req, res)
    })

    app.get('/adm/boletim/naturezaRanking/', async (req,res)=>{
        await boletimController.naturezaRanking(req, res)
    })

    app.get('/adm/boletim/dia/:dia', async (req,res)=>{
        await boletimController.boletimListByDay(req, res)
    })

    app.get('/adm/boletim/naturezaRankingByYear/:ano', async (req,res)=>{
        await boletimController.naturezaRankingByYear(req, res)
    })

    app.get('/adm/boletim/naturezaRankingByMonth/:ano/:mes', async (req,res)=>{
        await boletimController.naturezaRankingByMonth(req, res)
    })



}

module.exports = route