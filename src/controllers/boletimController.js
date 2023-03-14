//controller do boletim

const { json } = require('body-parser')
const Boletim = require('../model/boletim')

// retorna uma lista com todos os boletins de ocorrências no banco de dados

exports.BoletimList = async (req, res)=>{
    try{
        const result = await Boletim.find()
        return res.status(200).send(JSON.stringify(result))
    }catch(err){
        return res.status(500).send({message:"Erro não foi possivel buscar a lista de boletins", error:err})
    }
    
}

//buscar boletim no banco de dados de acordo com id repassado via get 
//
//
//
exports.boletimByID = async (req, res)=>{
    try{
        const result = await Boletim.find({_id: req.params.IDBoletim})
        return res.status(200).send(JSON.stringify(result))
    }catch(err){
        return res.status(500).send({message:"Boletim não encontrado", error:err}) 
    }
}

exports.boletimByNumero = async (req, res)=>{
    console.log(req.body.numero)
    try{
        const result = await Boletim.findOne({numero: req.params.numero}).sort({'_id':-1})
        console.log(result)
        return res.status(200).send(JSON.stringify(result))
    }catch(err){
        return res.status(500).send({message:"Boletim não encontrado", error:err}) 
    }
}

exports.boletimByNumeroAndCidade = async (req, res)=>{
    console.log("Executando :boletimByNumeroAndCidade")
    try {
        const result = await Boletim.findOne({numero: req.params.numero, municipio: req.params.municipio}).sort({'_id':-1})
        console.log(result)
        res.status(200).send(JSON.stringify(result))
    } catch (err) {
        return res.status(500).send({message:"Boletim não encontrado", error:err})    
    }    
}

// remove do banco de dados o boletim que tem o _id igual a repassado via get 
// 
// 
//
exports.removeBoletimByID = async( req, res)=>{
    try {
        const result = await Boletim.remove({_id: req.params.IDBoletim})
        return res.status(200).send(JSON.stringify(result))
    } catch (err) {
        return res.status(500).send({message:"Boletim não encontrado", error:err})     
    } 
}


// Registra ou Atualiza no banco de dados um novo boletim de ocorrência
//
//
//
exports.createBoletim = async(req, res)=>{
    try{
        await Boletim.findOneAndUpdate(
            {numero: req.body.boletim.numero, data : req.body.boletim.data},//critério de pesquisa. verifica se ja existe o boletim no banco de dados
            {$set:req.body.boletim},
            { upsert: true, new: true },
        )
        
        res.status(200).send({message:"Boletim registrado com sucesso !"}) 
    }catch(err){
        return res.status(500).send({message:"Não foi possivel registrar o boletim, erro no servidor !", err:err})
    }
}


//Busca por Boletim que contem no efetivo ids igual do passado no params.id
exports.listaMeusBos = async (req, res)=>{
    console.log(req.params.id)
    try {
        const result = await Boletim.find({
            efetivo:{$elemMatch:{
                id:req.params.id
            }}
        })
        return res.status(200).send(result)     
    } catch (err) {
        return res.status(500).send({message:"Erro ao solicitar lista de boletins deste usuario"})
    }
}


//Consta quantos boletins existem cadastrados 
exports.countBoletim = async (req, res) =>{
    const quantidadeBoletins = await Boletim.count()
    console.log(quantidadeBoletins)
    return res.status(200).send(JSON.stringify(quantidadeBoletins))
}

exports.naturezaListBoletim = async (req, res) =>{
    const naturezaList = await Boletim.distinct("natureza")
    return res.status(200).send(JSON.stringify(naturezaList))
}


exports.naturezaRanking = async (req, res) =>{

    const rankingOcorrencia = await Boletim.aggregate([
    {
        $group : {
            _id: "$natureza",
            count: {$sum:1}
        }
    },

    {
        $sort:{count :-1}
    },

    ])

    return res.status(200).send(JSON.stringify(rankingOcorrencia))
}

exports.naturezaRankingByYear = async (req, res)=>{
    try{
        const ano = req.params.ano
        const rankingOcorrencia = await Boletim.aggregate([
            {
                $addFields: { // adicionar um novo campo "dataRegistroObj" com o objeto de data
                dataRegistroObj: {
                    $dateFromString: {
                    dateString: "$data",
                    format: "%d/%m/%Y"
                    }
                }
                }
            },
            {
                $match: { dataRegistroObj: { $gte: new Date(`${ano}-01-01`), $lte: new Date(`${ano}-12-31`)  } } 
            },
            {
                $group : {
                    _id: "$natureza",
                    count: {$sum:1}
                }
            },
        
            {
                $sort:{count :-1}
            },
        
            ])
        
            return res.status(200).send(JSON.stringify(rankingOcorrencia)) 
    }catch(err){
            console.log(err)
            return res.status(200).send({message:"Erro interno, não foi possível realizar a busca", err}) 
    }
}

exports.naturezaRankingByMonth = async (req, res)=>{
    try{
        const ano = req.params.ano
        const mes = req.params.mes
        const rankingOcorrencia = await Boletim.aggregate([
            {
                $addFields: { // adicionar um novo campo "dataRegistroObj" com o objeto de data
                dataRegistroObj: {
                    $dateFromString: {
                    dateString: "$data",
                    format: "%d/%m/%Y"
                    }
                }
                }
            },
            {
                $match: { dataRegistroObj: { $gte: new Date(`${ano}-${mes}-01`), $lte: new Date(`${ano}-${mes}-31`)  } } 
            },
            {
                $group : {
                    _id: "$natureza",
                    count: {$sum:1}
                }
            },
        
            {
                $sort:{count :-1}
            },
        
            ])
        
            return res.status(200).send(JSON.stringify(rankingOcorrencia)) 
    }catch(err){
            console.log(err)
            return res.status(200).send({message:"Erro interno, não foi possível realizar a busca", err}) 
    }
}

exports.boletimListByDay = async( req, res)=>{
    try {
        const result = await Boletim.find({data: req.params.data})
        return res.status(200).send(JSON.stringify(result))
    } catch (err) {
        return res.status(500).send({message:"Boletim não encontrado", error:err})     
    } 
}