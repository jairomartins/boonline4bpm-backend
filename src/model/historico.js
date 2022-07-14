const mongoose = require("../database/index")

exports.HistoricoScheme = new mongoose.Schema({
    content:{
        type:String
    }
})