
const authController = require('../controllers/authController')
const {verificaToken} = require('../lib/jwtConfig')

function route (app){

    app.post('/login', async (req,res)=>{
        authController.login(req, res);
    })

    app.post('/register', async (req, res)=>{
        authController.register(req, res);
    })

    app.get('/isUserAuth', async (req, res)=>{
        verificaToken(req,res)
    })

}

module.exports = route