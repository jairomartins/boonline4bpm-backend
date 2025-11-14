require('dotenv').config()
const bcrypt = require('bcryptjs')
const User = require('../model/user')
const {gerarToken} = require('../lib/jwtconfig')
const {sendMailConfirm,sendMailRecoverPassword} =require('../lib/nodemailerconfig')


exports.register = async (req, res) => {
    try {
        // Desestruturação dos campos do request body
        let {
            userName,
            userEmail,
            userPassword,
            userContato,
            userMatriculaId,
            userGraduacao,
            userBarra
        } = req.body;

        // Normalizar email
        userEmail = userEmail.toLowerCase().trim();

        // Verifica se o usuário já existe
        const existingUser = await User.findOne({ userEmail });
        if (existingUser) {
            return res.status(400).json({ message: "Já existe um usuário cadastrado com este e-mail!" });
        }

        // Criptografar a senha
        const hashedPassword = await bcrypt.hash(userPassword, 10);

        // Criar usuário no banco de dados
        const newUser = await User.create({
            userName,
            userEmail,
            userPassword: hashedPassword,
            userContato,
            userMatriculaId,
            userGraduacao,
            userBarra
        });

        // Enviar e-mail de confirmação
        sendMailConfirm(userEmail, newUser._id);

        return res.status(201).json({ 
            message: `Usuário ${newUser.userName} registrado com sucesso! Confirme o cadastro no seu e-mail.` 
        });

    } catch (err) {
        console.error("Erro ao registrar usuário:", err);
        return res.status(500).json({ message: "Erro interno no servidor. Tente novamente mais tarde." });
    }
};

exports.login = async(req,res)=>{
    const {userEmail, userPassword} = req.body

    console.log('authController.login() - '+req.body.userPassword)
    try{
        const user = await User.findOne({userEmail})
        if (!user){
            return res.status(400).json({message:"Error : O usuario com este email ainda não está cadastrado!", user:null})
        }
        const isMatch = await bcrypt.compare(userPassword,user.userPassword)
        if(isMatch){
            const token = gerarToken({userEmail:userEmail, userMatriculaId: user.userMatriculaId})
            return res.json({status:"Login feito com sucesso!",authenticated:true, token: token, userID: user.userMatriculaId, userTipo: user.tipo})
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
    <form method="post" action=/users/recoverPassword/${req.params.userId}/>
      <label for="password">Digite a nova senha :</label>
      <input type="password" id="password" name="userPassword">
      <button type="submit">Confirmar alteração de senha</button>
    </form>
  `
    return res.send(form)
}
