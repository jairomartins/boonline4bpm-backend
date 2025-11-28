//Controller of Incident Reports

const multer = require('multer')
const path  = require('fs')

const { json } = require('body-parser')
const IncidentReport = require('../model/boletim')

// Return a list of Incident Reports sorted by most recent
exports.incidentReportList = async (req, res) => {
  try {
    const incidentReports = await IncidentReport.find().sort({ _id: -1 }); 
    return res.status(200).send(JSON.stringify(incidentReports));
  } catch (err) {
    return res.status(500).send({
      message: "We got a problem to fetch Incident Reports from database",
      error: err
    });
  }
};


//Search Incident Report by ID  
exports.incidentReportByID = async (req, res)=>{
    try{
        const incidentReport = await IncidentReport.find({_id: req.params.IDBoletim})
        return res.status(200).send(JSON.stringify(incidentReport))
    }catch(err){
        return res.status(500).send({message:"Incident Report not found", error:err}) 
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
        const result = await Boletim.deleteOne({ _id: req.params.id });
        return res.status(200).send(JSON.stringify(result))
    } catch (err) {
        return res.status(500).send({message:"Boletim não encontrado", error:err})     
    } 
}


// Registra ou Atualiza no banco de dados um boletim de ocorrência
// se o _id for repassado via json, atualiza o boletim existente
// se o _id não for repassado via json, cria um novo boletim
// 
// 
//
// controllers/boletimController.js
exports.createBoletim = async (req, res) => {
  try {
    const boletimData = req.body.boletim;

    // Se houver _id, atualiza o boletim existente
    if (boletimData._id) {
      const boletimAtualizado = await Boletim.findByIdAndUpdate(
        boletimData._id,
        { $set: boletimData }, 
        { new: true } // retorna o documento atualizado
      );

      if (!boletimAtualizado) {
        // Caso o _id seja inválido, cria um novo boletim
        const novoBoletim = await Boletim.create(boletimData);
        return res.status(200).send({
          message: "Boletim criado com sucesso!",
          boletim: novoBoletim,
        });
      }

      return res.status(200).send({
        message: "Boletim atualizado com sucesso!",
        boletim: boletimAtualizado,
      });
    } 
    // Se não houver _id, cria um boletim novo
    else {
      const novoBoletim = await Boletim.create(boletimData);
      return res.status(200).send({
        message: "Boletim criado com sucesso!",
        boletim: novoBoletim,
      });
    }
  } catch (err) {
    console.error(err);
    return res.status(500).send({
      message: "Não foi possível registrar o boletim, erro no servidor!",
      err: err,
    });
  }
};




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

exports.boletimListByDay = async (req, res) => {
    try {
        const { dia, mes, ano } = req.params;
        const data = `${dia}/${mes}/${ano}`;

        const result = await Boletim.find({ data })
            .sort({ municipio: 1, numero: 1 }); 
            // cidade A→Z e numero DESC

        return res.status(200).json(result);

    } catch (err) {
        return res.status(500).send({
            message: "Boletim não encontrado",
            error: err
        });
    }
};


exports.uploadPhotos = async(req , res)=>{


}


// find bo, by city and date
// return a bo, when match with date and city
exports.boletimByDateAndCity = async (req, res)=>{
    try{
        const result = await Boletim.find({data:`${req.params.day}/${req.params.month}/${req.params.year}`, municipio:`${req.params.city}`})
        return res.status(200).send(JSON.stringify(result))
    }catch{
        return res.status(500).send({message:"Erro a buscar boletim"})
    }
}