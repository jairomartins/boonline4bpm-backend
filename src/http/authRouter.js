
const authController = require('../controllers/authController')
const {verificaToken} = require('../lib/jwtconfig')

function route (app){

    app.post('/login', async (req,res)=>{
        authController.login(req, res);
    })

    app.post('/register', async (req, res)=>{
        console.log('entrou no auth route ---')
        authController.register(req, res);
    })

    app.post('/recuperarSenha', async (req, res)=>{
        console.log('entrou no auth route ---')
        authController.recoverPassword(req, res);
    })

    app.get('/isUserAuth', async (req, res)=>{
        verificaToken(req,res)
    })

    app.get('/passwordrecover/:userId', async (req, res)=>{
        authController.passwordFormUpdate(req, res)
    })

}

module.exports = route