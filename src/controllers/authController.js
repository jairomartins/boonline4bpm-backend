const { Router } = require('express')
const express = require('express')


const User = require('../model/user')

const route = express.Router()


route.post('/register', async(req,res)=>{
    
    try{
        const user = await User.create(req.body)
        return res.status(200)
    }catch(err){
        return res.status(400).send({error:'Registration failed'})
    }
})

route.post('/login', async(req,res)=>{
    try{
        const user = await User.findOne({
            userEmail:req.body.userEmail,
            userPassword:req.body.userPassword
        })
        if(user){
            return res.json({status:"ok", user:true})
        }else{
            return res.json({status:"error", user:false})
        }
    }catch(err){
        return res.json({status:"error", user:false})
    }
})


module.exports = app => app.use('/auth',route)