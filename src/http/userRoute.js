const userController = require('../controllers/userController')



const jwt = require('jsonwebtoken')
const SECRET_PASSWORD_TOKEN = "JMARTINS_194"


// verifica o token no headers da requisição 
const {verificaToken} = require('../lib/jwtconfig')

function userRoute(app){

    app.get('/users',verificaToken,async (req, res)=>{
        await userController.userList(req,res)
    })

    app.delete('/users/:id',verificaToken,async (req, res)=>{
        //TODO-usado para excluir dados de um servidor
    })

    app.post('/users/:id',verificaToken,async (req, res)=>{
        //TODO-usado para enviar dados a um servidor para processamento.
    })

    app.put('/users/:id',verificaToken,async (req, res)=>{
        //TODO- PUT - usado para atualizar dados existentes em um servidor.
    })
    
    


}

module.exports = userRoute