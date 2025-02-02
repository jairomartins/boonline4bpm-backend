const mongoose = require('../database/db')

const UserSchema = new mongoose.Schema({
    
    userName:{
        type:String,
        required:true,
    },
    userEmail:{
        type:String,
        required:true,
        unique:true,
        lowercase:true
    },
    userPassword:{
        type:String,
        required:true
    },
    userContato:{
        type:String,
    },
    userMatriculaId:{
        type:String,
    },
    tipo:{
        type:String,
        default:"comum"
    },
    isAtivo:{
        type:String,
        default:false
    },
    userGraduacao:{
        type:String,
    },
    userNumero:{
        type:String,
    },
    userBarra:{
        type:String,
    },
},{
    timestamps:true
})

const User = mongoose.model('User',UserSchema)

module.exports = User