const userController = require('../controllers/userController')

// verifica o token no headers da requisição 
const {verificaToken} = require('../lib/jwtconfig')

function userRoute(app){

    app.get('/users',async (req, res)=>{
        await userController.userList(req,res)
    })

    app.delete('/users/:id',async (req, res)=>{
        await userController.userDelete(req, res)
    })

    app.post('/users/:id',async (req, res)=>{
        await userController.userCreate(req, res)
    })

    app.put('/users/:id',async (req, res)=>{
        await userController.userUpdate(req, res)
    })

    app.get('/users/confirm/:id',async (req, res)=>{
        await userController.userActive(req, res)
    })

    app.get('/user/:id', async (req, res)=>{
        await userController.buscarUserByMatriculaId(req, res)
    })

    app.post('/recoverPassword/:userId',async (req, res)=>{
        console.log('user route /users/recoverPassword ')
        await userController.userUpdatePassword(req, res)
    })
    
}

module.exports = userRoute