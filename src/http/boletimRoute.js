
const boCont = require('../controllers/boletimController')

const jwt = require('jsonwebtoken')
const SECRET_PASSWORD_TOKEN = "JMARTINS_194"

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

    app.get('/adm/boletim',verificaToken,(req,res)=>{
        boCont.createBoletim(req,res)
        res.send('tentei cara;/')
    })
    
    app.get('/adm/listarBoletins',async (req ,res )=>{
        await boCont.BoletimList( req, res)
    })

    app.get('/adm/listaByID', async (req, res)=>{
        await boCont.boletimByID(req, res)
    })

    app.get('/adm/listByID/:IDBoletim',verificaToken, async(req, res) => {
        console.log("buscou por id >>")
        await boCont.boletimByID(req, res)
      })

    app.get('/adm/listByNumero/:NumeroBoletim',verificaToken , async(req, res) => {
    await boCont.boletimByNumero(req, res)
    })

    app.get('/adm/listByNumeroECidade/:NumeroBoletim/:cidade',verificaToken , async(req, res) => {
    await boCont.boletimByNumeroECidade(req, res)
    })

    app.post('/adm/salvarBoletim', async (req,res)=>{
        await boCont.createBoletim(req,res)
    })


    //Lista boletins que incluem o usuario logado como parte do efetivo empregado
    //Recebe o ID do usuario via GET 
    //listaMeusBos()
    app.get('/adm/listaMeusBos/:id', async (req,res)=>{
        await boCont.listaMeusBos(req, res)
    })
    

}

module.exports = route