const userController = require('../controllers/userController')

// verifica o token no headers da requisição 
const {verificaToken} = require('../lib/jwtconfig')

function userRoute(app){

    app.get('/users',verificaToken,async (req, res)=>{
        await userController.userList(req,res)
    })

    app.delete('/users/:id',verificaToken,async (req, res)=>{
        await userController.userDelete(req, res)
    })

    app.post('/users/:id',verificaToken,async (req, res)=>{
        await userController.userCreate(req, res)
    })

    app.put('/users/:id',verificaToken,async (req, res)=>{
        await userController.userUpdate(req, res)
    })

    app.get('/users/confirm/:id',async (req, res)=>{
        await userController.userActive(req, res)
    })
    
}

module.exports = userRoute