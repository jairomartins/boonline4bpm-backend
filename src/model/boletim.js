const mongoose = require('../database/index')

const EnvolvidoSchema = new mongoose.Schema({
    tipo:String,
    nome:String,
    cpf:String,
    sexo:{
        type:String
    },
    nascimento:{
        type:String
    },
    endereco:{
        type:String
    },
    numero:{
        type:String
    },
    pontoReferencia:{
        type:String
    },
    bairro:{
        type:String
    },
    municipio:{
        type:String
    },
    telefone:{
        type:String
    },
    nomeMae:{
        type:String
    },
    obs:{
        type:String
    },
}
)

const MaterialSchema = new mongoose.Schema({
    descricao:{
        type:String,
        required:true
    },
    quantidade:{
        type:String
    }
}
)

// dados de cadastro de efetivo
const EfetivoSchema = new mongoose.Schema({
    vtr:{
        type:String
    },
    nome:{
        type:String,
        uppercase:true
    },
    graduacao:{
        type:String
    },
    numeroBarra:{
        type:String
    },
    id:{
        type:String
    },
})



const BoScheme = new mongoose.Schema({
    numero:String,
    natureza:String,
    envolvidos:[EnvolvidoSchema],
    materiaisApreendidos:[MaterialSchema],
    efetivo:[EfetivoSchema],
    historicohtml:String

})


const Boletim = mongoose.model('Boletim',BoScheme)

module.exports = Boletim