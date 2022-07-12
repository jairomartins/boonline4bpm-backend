const userController = require('../controllers/userController')

const verificaToken = (req, res, next)=>{
    res.status(200).send("É necessário fazer login")
    // next()
}

function userRoute(app){

    app.get('/users',verificaToken,async (req, res)=>{
        await userController.userList(req,res)
    })
}

module.exports = userRoute