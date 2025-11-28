const boletimController = require('../controllers/boletimController')

// TODO - VERIFICAR O TOKEN ANTES DE EXECUTAR FUNÇÃO 

const {verificaToken} = require('../lib/jwtconfig')


function route (app){
 
    //the route to list all incident reports
    app.get('/adm/boletim/list',async (req ,res )=>{
        await boletimController.incidentReportList( req, res)
    })

    app.get('/adm/boletim/listByID/:IDBoletim', verificaToken,async(req, res) => {
        await boletimController.incidentReportByID(req, res)
    })

    app.get('/adm/boletim/list/:numero/:municipio', verificaToken,  async(req, res) => {
        await boletimController.boletimByNumeroAndCidade(req, res)
    })


    //rota para buscar o boletim de uma data especifica na cidade logada.
    app.get('/adm/boletim/list/:day/:month/:year/:city',   async(req, res) => {
        await boletimController.boletimByDateAndCity(req, res)
    })

    app.post('/adm/boletim/create', async (req, res)=>{
        await boletimController.createBoletim(req, res)
    })

    app.get('/adm/boletim/search/:numero', verificaToken, async (req, res)=>{
        // buscar boletim de ocorrencia de acordo com o numero repassado
        await boletimController.boletimByNumero(req,res)
    })

    app.post('/adm/boletim/update', verificaToken, async (req, res)=>{
        // atualizar boletim de ocorrencia de acordo com o numero repassado
        await boletimController.createBoletim(req,res)
    })

    app.post('/adm/boletim/delete/:id', verificaToken, async (req, res)=>{
        await boletimController.removeBoletimByID(req,res)
    })

    // lista boletins de um usuario pelo id do policial empregado no efetivo
    app.get('/adm/boletim/list/:id',async (req,res)=>{
        await boletimController.listaMeusBos(req, res)
    })
    

    //disponivel nivel mais alto - ainda nao implementado no front
    app.get('/adm/boletim/count/', async (req,res)=>{
        await boletimController.countBoletim(req, res)
    })

    app.get('/adm/boletim/naturezaList/', async (req,res)=>{
        await boletimController.naturezaListBoletim(req, res)
    })

    app.get('/adm/boletim/naturezaRanking/', async (req,res)=>{
        await boletimController.naturezaRanking(req, res)
    })

    app.get('/adm/boletim/dia/:dia/:mes/:ano', verificaToken, async (req,res)=>{
        await boletimController.boletimListByDay(req, res)
    })

    app.get('/adm/boletim/naturezaRankingByYear/:ano', async (req,res)=>{
        await boletimController.naturezaRankingByYear(req, res)
    })

    app.get('/adm/boletim/naturezaRankingByMonth/:ano/:mes', async (req,res)=>{
        await boletimController.naturezaRankingByMonth(req, res)
    })

    app.get('/adm/boletim/upload', async (req,res)=>{
        await boletimController.upload(req, res)
    })



}

module.exports = route