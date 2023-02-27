//controller de usuarios

const { json } = require('body-parser')
const user = require('../model/user')

exports.userList = async (req, res)=>{
    const result = await user.find()
    res.send(JSON.stringify(result))
}

exports.userCreate = async (req, res) =>{
    try{
        return user.create(req.bod, function (err,user){
            if(err){
                return res.status(400).send({message: "Não foi possivel registrar o usuario"})
            }else{
                return res.status(200).send({message: "Usuario criado com sucesso"})
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




