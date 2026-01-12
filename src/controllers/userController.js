//controller de usuarios

// const { json } = require('body-parser')
const user = require('../model/user')
const bcrypt = require('bcryptjs')
const {sendMailUpdatePassword} =require('../lib/nodemailerconfig')

//list all users on db
exports.usersList = async (req, res)=>{
    try{
        const usersList = await user.find()
        res.send(JSON.stringify(usersList))
    }catch(err){
        res.status(500).send({message: "Server error"})
    }
}

//create user on db
exports.userCreate = async (req, res) =>{
    try{
        return user.create(req.body, function (err,user){
            if(err){
                return res.status(400).send({message: "Could not create user", err: err})
            }else{
                return res.status(200).send({message: "User created successfully, please check your email to activate your account!"})
            }
        })  
    }catch(err){
        return res.status(500).send({message: "Server error"})
    }
    
}

//delete user on db
exports.userDelete = async (req, res) =>{
    const {id} = req.params
    try{
        const result = await user.deleteOne(
            {_id : id},  
        )
        if (result.deletedCount ===1){
            return res.status(200).send({message:"User deleted successfully!"})
        }else{
            return res.status(404).send({message: "User not found"})
        }
    }catch(err){
        return res.status(500).send({message: "Server error"})
    }
}

//update user on db
exports.userUpdate = async (req, res) =>{
    try{
        const result  = await user.updateOne(
            {userMatriculaId : req.params.id},
            { $set :req.body},
        )
        return res.status(200).send({message: "Data updated successfully!"})
    }catch(err){
        return res.status(500).send({message: "Server error"})//, err})  
    }
    
}

//check if user exists by email
function verifyUser (email){
    return user.find({userEmail:email})
}

//find user by matricula id
exports.findUserByMatriculaId = async (req, res)=>{
    res.send(JSON.stringify( await user.find({userMatriculaId:req.params.id})))
}


//send email to update password
exports.userUpdatePasswordSendEmail = async (req, res) =>{
    const {email}  = req.params
    const usuario = verifyUser(email)

    if(usuario!=null){
        try {
            await sendMailUpdatePassword(email,usuario.id)
        } catch (error) {
            console.log(error)
        }
        
    }
    
}


exports.userUpdatePassword = async (req, res) =>{
    console.log('usercontrole userUpdatePasswor')
 
    const hashedPassword = await bcrypt.hash(req.body.userPassword,10)
    console.log(hashedPassword)
    try{
        const result  = await user.updateOne(
            {_id : req.params.userId},
            { $set :{userPassword:hashedPassword}},
        )
        return res.status(200).send({message: "Parabéns, senha alterada com sucesso!"})
    }catch(err){
        return res.status(500).send({message: "Erro no servidor", err})
    }
    
}