const mongoose = require('../database/index')

const BoScheme = new mongoose.Schema({
    numero:{
        type:String,
        required:true,
        unique:true
    },
    horario:{
        type:String,
        required:true,
        unique:true
    },
    data:{
        type:String,
        required:true,
        unique:true
    },
    natureza:{
        type:String,
        required:true,

    },
    latitude:{
        type:String,
      
    },
    longitude:{
        type:String,       
    },
    endereco:{
        type:String,
        required:true,
     
    },
    numero:{
        type:String,
    },
    bairro:{
        type:String,
    },
    municipio:{
        type:String,
    },
    referencia:{
        type:String,
    },
    envolvidos:[],
    material:[],
    efetivo:[],
    historico:[]

})

const Boletim = mongoose.model('Boletim',BoScheme)

module.exports = Boletim