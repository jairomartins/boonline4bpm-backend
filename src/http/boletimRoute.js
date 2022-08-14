
const boCont = require('../controllers/boletimController')

const jwt = require('jsonwebtoken')
const SECRET_PASSWORD_TOKEN = "JMARTINS_194"

// verifica o token no headers da requisição 
const verificaToken = (req, res, next)=>{

    const token = req.headers["x-access-token"]
    console.log(token)
    if(!token){
        res.json({error:"você precisa de um token"})
    }else{
        jwt.verify(token,"JMARTINS_194", (err,decoded)=>{
            if(err){
                res.json({auth:false, status:"falha ao autenticar o token"})
            }else{
                if(req.body.userEmail==decoded.userEmail){
                   res.json( {auth:true})
                }
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
        await boCont.boletimByID(req, res)
      })

      app.get('/adm/listByNumero/:NumeroBoletim',verificaToken, async(req, res) => {
        await boCont.boletimByNumero(req, res)
      })

    app.post('/adm/salvarBoletim', async (req,res)=>{
        await boCont.createBoletim(req,res)
    })


    app.get('/adm/listaMeusBos/:id', async (req,res)=>{
        await boCont.listaMeusBos(req, res)
    })
    

}

module.exports = route