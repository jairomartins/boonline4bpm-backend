require('dotenv').config()
const bcrypt = require('bcryptjs')
const User = require('../model/user')
const {gerarToken} = require('../lib/jwtconfig')
const {sendMailConfirm,sendMailRecoverPassword} =require('../lib/nodemailerconfig')


exports.register = async (req, res) =>{
    console.log('entrou no auth REGISTER ---')
    const user = await User.findOne({
        userEmail: req.body.userEmail
    })
    
    console.log(user!=null)
    if(user!=null){
        return res.status(400).send({message:"Já existe um usuario cadastrado com esse Email!"})
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
            tipo
        })

        sendMailConfirm(userEmail, user._id)
        return res.status(200).send({message:'Usuario '+user.userName+' registrado com sucesso confirme o cadastro no  seu email'})   
    }catch(err){
        console.log(err)
        return res.status(400).send({message:"Erro ao Registrar o usuário, verifique se os dados estão preenchidos corretamente !"})
    }

}

exports.login = async(req,res)=>{
    const {userEmail, userPassword} = req.body
    try{
        const user = await User.findOne({userEmail})
        if (!user){
            return res.status(400).json({message:"Error : O usuario com este email ainda não está cadastrado!", user:null})
        }
        const isMatch = await bcrypt.compare(userPassword,user.userPassword)
        if(isMatch){
            const token = gerarToken({userEmail:userEmail, userMatriculaId: user.userMatriculaId})
            return res.json({status:"Login feito com sucesso!",authenticated:true, token: token})
        }else{
            return res.status(400).json({message:"Error : A Senha está incorreta !"})
        }
    }catch(err){
        console.log(err)
        return res.status(400).json({message:"Error : Não foi possivel conectar ao servidor !",authenticated:false})
    }
}

exports.recoverPassword = async(req,res)=>{
    try {
        const user = await User.findOne({
            userEmail: req.body.userEmail
        }) 

        if (!user){
            return res.status(400).json({message:"Error : O usuario com este email ainda não está cadastrado!"})
        }else{
            await sendMailRecoverPassword(user)
            return res.status(200).json({message:"Sucesso : Verifique o link enviado para seu email"})
        }
    } catch (error) {
        console.log(error)
    }

}

exports.passwordFormUpdate = async(req,res)=>{

    const form = `
    <form method="post" action=/recoverPassword/${req.params.userId}/>
      <label for="password">Digite a nova senha :</label>
      <input type="password" id="password" name="userPassword">
      <button type="submit">Confirmar alteração de senha</button>
    </form>
  `
    return res.send(form)
}
