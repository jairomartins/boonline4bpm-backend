//controller do boletim

const { json } = require('body-parser')
const Boletim = require('../model/boletim')

// retorna uma lista com todos os boletins de ocorrências no banco de dados
//
//
//
exports.BoletimList = async ()=>{
    const result = await Boletim.find()
    res.send(JSON.stringify(result))
}

//buscar boletim no banco de dados de acordo com id repassado via get 
//
//
//
exports.boletimByID = async (req, res)=>{
    const result = await Boletim.find({_id: req.params.IDBoletim})
    res.send(JSON.stringify(result))
}

// remove do banco de dados o boletim que tem o _id igual a repassado via get 
// 
// 
//
exports.removeBoletimByID = async( req, res)=>{
    const result = await Boletim.remove({_id: req.params.IDBoletim})
    res.send(JSON.stringify(result))
}


// Registra no banco de dados um novo boletim de ocorrência
//
//
//
exports.createBoletim = async(req, res)=>{
    try{
        const newBoletim = await Boletim.create(req.body.boletim)
        return res.status(200).send(JSON.stringify(newBoletim))
    }catch(err){
        return res.status(400).send({error:'Registration failed'})
    }
}