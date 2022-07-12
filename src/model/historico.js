const mongoose = require("../database/index")

const HistoricoScheme = new mongoose.Schema({
    content:{
        type:String
    }
})