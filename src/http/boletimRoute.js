const boletimController = require('../controllers/boletimController')
const authController = require('../controllers/authController')


// verifica o token no headers da requisição 
const {verificaToken} = require('../lib/jwtconfig')


function route (app){

    app.get('/adm/boletim',verificaToken,(req,res)=>{
        boletimController.createBoletim(req,res)
        res.send('tentei cara;/')
    })
    
    app.get('/adm/listarBoletins',async (req ,res )=>{
        await boletimController.BoletimList( req, res)
    })

    app.get('/adm/listaByID', async (req, res)=>{
        await boletimController.boletimByID(req, res)
    })

    app.get('/adm/listByID/:IDBoletim',verificaToken, async(req, res) => {
        await boletimController.boletimByID(req, res)
      })

    app.get('/adm/listByNumero/:NumeroBoletim',verificaToken , async(req, res) => {
    await boletimController.boletimByNumero(req, res)
    })

    app.get('/adm/listByNumeroECidade/:NumeroBoletim/:cidade',verificaToken , async(req, res) => {
    await boletimController.boletimByNumeroAndCidade(req, res)
    })

    app.post('/adm/salvarBoletim', async (req,res)=>{
        await boletimController.createBoletim(req,res)
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

    app.get('/adm/listaMeusBos/:id', async (req,res)=>{
        await boletimController.listaMeusBos(req, res)
    })
    


    app.get('/adm/countBoletins/', async (req,res)=>{
        await boletimController.countBoletim(req, res)
    })

    app.get('/adm/naturezaListBoletins/', async (req,res)=>{
        await boletimController.natuzeraListBoletim(req, res)
    })

}

module.exports = route