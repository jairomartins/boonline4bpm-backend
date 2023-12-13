//controller de usuarios

// const { json } = require('body-parser')
const user = require('../model/user')
const bcrypt = require('bcryptjs')
const {sendMailUpdatePassword} =require('../lib/nodemailerconfig')

exports.userList = async (req, res)=>{
    const result = await user.find()
    res.send(JSON.stringify(result))
}

exports.userCreate = async (req, res) =>{
    try{
        return user.create(req.body, function (err,user){
            if(err){
                return res.status(400).send({message: "Não foi possivel registrar o usuario ..."})
            }else{
                return res.status(200).send({message: "Usuario criado com sucesso verifique seu email para ativação da conta"})
            }
        })  
    }catch(err){
        return res.status(500).send({message: "Erro no servidor"})
    }
    
}

exports.userDelete = async (req, res) =>{
    try{
        const result = await user.deleteOne(
            {userMatriculaId : req.body.userMatriculaId},  
        )
        if (result.deletedCount ===1){
            return res.status(200).send({message:"Usuario excluido com sucesso"})
        }else{
            return res.status(404).send({message: "Usuario não encontrado"})
        }
    }catch(err){
        return res.status(500).send({message: "Erro no servidor"})
    }
}


exports.userUpdate = async (req, res) =>{
    try{
        const result  = await user.updateOne(
            {userMatriculaId : req.body.userMatriculaId},
            { $set :req.body},
        )
    }catch(err){
        return res.status(500).send({message: "Erro no servidor"})
    }
    
}

 

exports.userActive = async (req, res) =>{
    console.log(req.params)
    try{
        const result  = await user.updateOne(
            {_id: req.params.id},
            { $set :{isAtivo:true}},
        )

        return res.status(200).send({message: "Usuario ativado com sucesso, faça login!"})
    }catch(err){
        return res.status(500).send({message: "Erro no servidor"})
    }
    
}

function verificarUsuario (email){
    return user.find({userEmail:email})
}

exports.buscarUserByMatriculaId = async (req, res)=>{
    res.send(JSON.stringify( await user.find({userMatriculaId:req.params.id})))
}



exports.userUpdatePasswordSendEmail = async (req, res) =>{
    const {email}  = req.params
    const usuario = verificarUsuario(email)

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
        return res.status(500).send({message: "Erro no servidor"})
    }
    
}