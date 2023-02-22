
const boletimController = require('../controllers/boletimController')
const authController = require('../controllers/authController')

const jwt = require('jsonwebtoken')
const SECRET_PASSWORD_TOKEN = process.env.SECRET_PASSWORD_TOKEN

// verifica o token no headers da requisição 
const verificaToken = (req, res, next)=>{

    const token = req.headers["x-access-token"]
    if(!token){
        
        res.json({error:"você precisa de um token"})
    }else{
        console.log("token valido")
        jwt.verify(token,SECRET_PASSWORD_TOKEN, (err,decoded)=>{
            if(err){
                console.log("erro no token  - boletimROuter - verificar token")
                res.json({auth:false, status:"falha ao autenticar o token"})
            }else{
                console.log("esta tudo ok no token ")
                
                   next()
    
            }
        })
    }
}


function route (app){

    app.get('/adm/boletim',authController.verificaToken,(req,res)=>{
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
    

}

module.exports = route