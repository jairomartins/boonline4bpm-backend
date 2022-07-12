const mongoose = require('../database/index')

const EfetivoSchema = new mongoose.Schema({
    vtr:{
        type:String
    },
    nome:{
        type:String
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

const Efetivo = mongoose.model('Efetivo',EfetivoSchema)

module.exports = Efetivo