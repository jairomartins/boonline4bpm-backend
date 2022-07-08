const { Router } = require('express')
const express = require('express')


const User = require('../model/user')

const route = express.Router()


route.post('/register', async(req,res)=>{
    try{
        console.log(req.body)
        const user = await User.create(req.body)
        return res.send({user})
    }catch(err){
            return res.status(400).send({error:'Registration failed'})
    }
})

module.exports = app => app.use('/auth',route)