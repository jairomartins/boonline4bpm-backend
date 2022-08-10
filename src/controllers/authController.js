const { Router } = require('express')
const express = require('express')

const SECRET_PASSWORD_TOKEN = "JMARTINS_194"

const User = require('../model/user')

const route = express.Router()

const jwt = require('jsonwebtoken')

//registrar novo usuario no banco de dados
route.post('/register', async(req,res)=>{
    
    const user = await User.findOne({
        userEmail: req.body.userEmail
        })
    
    if(user){
        return res.status(400).send({status:"Já existe um usuario cadastrado com esse Email!"})
    }
    try{
        const user = await User.create(req.body)
        return res.status(200).send({status:"Usuario registrado com sucesso"})
        
    }catch(err){
        console.log(err)
        return res.status(400).send({status:"Erro ao Registrar o usuário, verifique se os dados estão preenchidos corretamente !"})
    }
})


//faz o login de usuarios
route.post('/login', async(req,res)=>{
  
    console.log(req.body)
    try{
        const user = await User.findOne({
            userEmail: req.body.userEmail,
            userPassword: req.body.userPassword
        })
        console.log(req.body)

        if(user){
            user.userPassword = undefined

            const token = jwt.sign({userEmail:user.userEmail}, SECRET_PASSWORD_TOKEN,{expiresIn:60*1000})

            return res.json({status:"ok",authenticated:true, user:user, token: token})
        }else{
            return res.status(400).json({status:"Error : Email e/ou senhas está(ão) errado(s) !", user:null})
        }
    }catch(err){
        console.log(err)
        return res.status(400).json({status:"Error : Não foi possivel conectar ao servidor !",authenticated:false, user:null})
    }
})


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

route.get('/isUserAuth',verificaToken,(req, res)=>{
   
    res.json({status:"authenticado"})
})


module.exports = app => app.use('/auth',route)