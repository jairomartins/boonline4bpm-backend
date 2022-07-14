const mongoose = require('../database/index')

exports.MaterialScheme = new mongoose.Schema({
    descricao:{
        type:String,
        required:true
    },
    quantidade:{
        type:String
    }
})

// const Material = mongoose.model('Material',MaterialScheme)

// module.exports = Material