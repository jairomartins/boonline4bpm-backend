const mongoose = require('../database/index')

const MaterialScheme = new mongoose.Schema({
    descricao:{
        type:String,
        required:true
    },
    quantidade:{
        type:String
    }
})

const Material = mongoose.model('Material',MaterialScheme)

module.exports = Material