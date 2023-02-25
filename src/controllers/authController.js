require('dotenv').config()
const bcrypt = require('bcryptjs')
const User = require('../model/user')
const {gerarToken} = require('../lib/jwtConfig')

exports.register = async (req, res) =>{

    const user = await User.findOne({
        userEmail: req.body.userEmail
        })
    
    if(user){
        return res.status(400).send({status:"Já existe um usuario cadastrado com esse Email!"})
    }

    try{
        const {userName,userEmail,userPassword,userContato,userMatriculaId,tipo} = req.body
        const hashedPassword = await bcrypt.hash(userPassword,10)
        const user = await User.create({
            userName,
            userEmail,
            userPassword:hashedPassword,
            userContato,
            userMatriculaId,
            tipo})
        return res.status(200).send({status:'Usuario '+user.userName+' registrado com sucesso'})   
    }catch(err){
        console.log(err)
        return res.status(400).send({status:"Erro ao Registrar o usuário, verifique se os dados estão preenchidos corretamente !"})
    }

}


//faz o login de usuarios
exports.login = async(req,res)=>{
    const {userEmail, userPassword} = req.body
    try{
        const user = await User.findOne({userEmail})
        if (!user){
            return res.status(400).json({status:"Error : O usuario com este email ainda não está cadastrado!", user:null})
        }
        const isMatch = await bcrypt.compare(userPassword,user.userPassword)
        if(isMatch){
            const token = gerarToken({userEmail:userEmail})
            return res.json({status:"ok",authenticated:true, token: token})
        }else{
            return res.status(400).json({status:"Error : A Senha está incorreta !"})
        }
    }catch(err){
        console.log(err)
        return res.status(400).json({status:"Error : Não foi possivel conectar ao servidor !",authenticated:false})
    }
}
