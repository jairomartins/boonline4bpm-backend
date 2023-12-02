const boletimController = require('../controllers/boletimController')

// TODO - VERIFICAR O TOKEN ANTES DE EXECUTAR FUNÇÃO 

const {verificaToken} = require('../lib/jwtconfig')


function route (app){
 
    app.get('/adm/boletim/list',async (req ,res )=>{
        await boletimController.BoletimList( req, res)
    })

    app.get('/adm/boletim/listByID/:IDBoletim', verificaToken,async(req, res) => {
        await boletimController.boletimByID(req, res)
    })

    app.get('/adm/boletim/list/:numero/:municipio', verificaToken,  async(req, res) => {
        await boletimController.boletimByNumeroAndCidade(req, res)
    })

    app.post('/adm/boletim/create', verificaToken, async (req, res)=>{
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
    app.get('/adm/boletim/list/:id',verificaToken ,async (req,res)=>{
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

    app.get('/adm/boletim/dia/:dia/:mes/:ano', async (req,res)=>{
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