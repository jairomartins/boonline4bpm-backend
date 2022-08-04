const { Router } = require('express')
const express = require('express')

const cpt = require('../lib/crpyto')

const User = require('../model/user')

const route = express.Router()

const jwt = require('jsonwebtoken')

//registrar novo usuario no banco de dados
route.post('/register', async(req,res)=>{
   
  
    try{
        const user = await User.create(req.body)
        return res.status(200).send({message:"Usuario registrado"})
        
    }catch(err){
        return res.status(400).send({error:'Erro ao cadastrar novo usuário'})
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
        console.log(user.userName)
        // console.log(req.body)
        if(user){
            return res.json({status:"ok", user:true})
        }else{
            return res.json({status:"error", user:false})
        }
    }catch(err){
        return res.json({status:"error-1", user:false})
    }
})


// verifica o token no headers da requisição 
const verificaToken = (req, res, next)=>{

    const token = req.headers["x-access-token"]

    if(!token){
        res.json({error:"você precisa de um token"})
    }else{
        jwt.verify(token,"jwtSecret", (err,decoded)=>{
            if(err){
                res.json({auth:false, menssagem:"falha ao autenticar o token"})
            }else{
                req.userId = decoded.id
                next()
            }
        })
    }
}

route.get('/isUserAuth',verificaToken,(req, res)=>{
    console.log('----')
})


module.exports = app => app.use('/auth',route)