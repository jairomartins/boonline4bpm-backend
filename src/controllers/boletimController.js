//controller do boletim

const { json } = require('body-parser')
const Boletim = require('../model/boletim')

// retorna uma lista com todos os boletins de ocorrências no banco de dados
//
//
//



exports.BoletimList = async (req, res)=>{
    const result = await Boletim.find()
    console.log(result)
    res.send(JSON.stringify(result))
}

//buscar boletim no banco de dados de acordo com id repassado via get 
//
//
//
exports.boletimByID = async (req, res)=>{
    const result = await Boletim.find({_id: req.params.IDBoletim})
    console.log(req.params)
    res.send(JSON.stringify(result))
}

exports.boletimByNumero = async (req, res)=>{
    const result = await Boletim.findOne({numero: req.params.NumeroBoletim}).sort({'_id':-1})
    console.log(req.params)
    console.log(JSON.stringify(result))
    res.send(JSON.stringify(result))
}

exports.boletimByNumeroECidade = async (req, res)=>{
    const result = await Boletim.findOne({numero: req.params.NumeroBoletim, municipio:req.params.cidade}).sort({'_id':-1})
    console.log(req.params)
    console.log(JSON.stringify(result))
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
        return res.status(401).send({error:'Registration failed'})
    }
}

//Busca por Boletim que contem no efetivo ids igual do passado no params.id
exports.listaMeusBos = async (req, res)=>{
    const result = await Boletim.find({
        efetivo:{$elemMatch:{
            id:req.params.id
        }}
    })
    console.log(result.numero)
    res.status(200).send(JSON.stringify(result))
}