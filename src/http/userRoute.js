const userController = require('../controllers/userController')

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
function userRoute(app){

    app.get('/users',verificaToken,async (req, res)=>{
        await userController.userList(req,res)
    })
}

module.exports = userRoute