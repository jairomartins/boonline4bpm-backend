const boletimController = require('../controllers/boletimController')
const authController = require('../controllers/authController')


// verifica o token no headers da requisição 
const {verificaToken} = require('../lib/jwtConfig')


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


    //Lista boletins que incluem o usuario logado como parte do efetivo empregado
    //Recebe o ID do usuario via GET 
    //listaMeusBos()
    app.get('/adm/listaMeusBos/:id', async (req,res)=>{
        await boletimController.listaMeusBos(req, res)
    })
    

    app.get('/adm/countBoletins/:id', async (req,res)=>{
        await boletimController.countBoletim(req, res)
    })

}

module.exports = route