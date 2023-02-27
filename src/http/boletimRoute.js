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
    await boletimController.boletimByNumeroECidade(req, res)
    })

    app.post('/adm/salvarBoletim', async (req,res)=>{
        await boletimController.createBoletim(req,res)
    })

    app.post('/adm/boletim/create', async (req, res)=>{
        // TODO - salvar boletim de ocorrencia de acordo com o numero repassado
    })

    app.post('/adm/boletim/search', async (req, res)=>{
        // TODO - buscar boletim de ocorrencia de acordo com o numero repassado
    })

    app.post('/adm/boletim/update', async (req, res)=>{
        // TODO - atualizar boletim de ocorrencia de acordo com o numero repassado
    })

    app.post('/adm/boletim/delete', async (req, res)=>{
        // TODO - remover boletim de ocorrencia de acordo com o numero repassado
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