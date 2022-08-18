const userController = require('../controllers/userController')



const jwt = require('jsonwebtoken')
const SECRET_PASSWORD_TOKEN = "JMARTINS_194"


// verifica o token no headers da requisição 
const verificaToken = (req, res, next)=>{

    const token = req.headers["x-access-token"]
    console.log(token)
    if(!token){
        res.json({error:"você precisa de um token"})
    }else{
        jwt.verify(token,SECRET_PASSWORD_TOKEN, (err,decoded)=>{
            if(err){
                res.json({auth:false, status:"falha ao autenticar o token"})
            }else{
                if(req.body.userEmail==decoded.userEmail){
                   res.json( {auth:true})
                   next()
                }
            }
        })
    }
    next()
}
function userRoute(app){

    app.get('/users',verificaToken,async (req, res)=>{
        await userController.userList(req,res)
    })
}

module.exports = userRoute