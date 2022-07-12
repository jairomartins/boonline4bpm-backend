const mongoose = require('../database/index')

const EnvolvidoSchema = new mongoose.Schema({
    tipoEnvolvido:{
        Type:String
    },
    nome:{
        Type:String
    },
    cpf:{
        Type:String
    },
    sexo:{
        Type:String
    },
    nascimento:{
        Type:String
    },
    endereco:{
        Type:String
    },
    numero:{
        Type:String
    },
    pontoReferencia:{
        Type:String
    },
    bairro:{
        Type:String
    },
    municipio:{
        Type:String
    },
    telefone:{
        Type:String
    },
    nomeMae:{
        Type:String
    },
    obs:{
        Type:String
    }

})

const Envolvido = mongoose.model('Envolvido',EnvolvidoSchema)

module.exports = Envolvido