require('dotenv').config()
const bcrypt = require('bcryptjs')
const crypto = require('crypto')
const User = require('../model/user')
const { getEffectiveAccess, isAccountActive } = require('../utils/authorization')
const {
    gerarToken,
    gerarTokenRecuperacao,
    verificarTokenRecuperacao,
    gerarTokenConfirmacao,
    verificarTokenConfirmacao
} = require('../lib/jwtconfig')
const {sendMailConfirm,sendMailRecoverPassword} =require('../lib/nodemailerconfig')


exports.register = async (req, res) => {
    try {
        if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
            return res.status(400).json({ message: "Informe os dados do usuário." });
        }
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
        if (typeof userName !== 'string' || !userName.trim() ||
            typeof userEmail !== 'string' || !userEmail.trim() ||
            typeof userPassword !== 'string' || !userPassword) {
            return res.status(400).json({ message: "Nome, e-mail e senha são obrigatórios." });
        }
        userEmail = userEmail.toLowerCase().trim();

        // Verifica se o usuário já existe
        const existingUserQuery = User.findOne({ userEmail })
        const existingUser = existingUserQuery && typeof existingUserQuery.lean === 'function'
            ? await existingUserQuery.lean()
            : await existingUserQuery
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
            userBarra,
            roleKey: 'basico',
            tipo: 'comum',
            isAtivo: false,
            accessPending: true
        });

        const confirmationToken = gerarTokenConfirmacao(newUser._id)
        const emailConfirmationTokenHash = crypto.createHash('sha256').update(confirmationToken).digest('hex')
        await User.updateOne({ _id: newUser._id }, { $set: { emailConfirmationTokenHash } })
        await sendMailConfirm(userEmail, confirmationToken)

        return res.status(201).json({ 
            message: `Solicitação de cadastro recebida para ${newUser.userName}. Confirme seu e-mail; um administrador liberará o acesso à sua conta.`
        });

    } catch (err) {
        console.error("Erro ao registrar usuário:", err);
        if (err.code === 11000 || err.name === 'ValidationError') {
            return res.status(400).json({ message: "Dados inválidos ou e-mail já cadastrado." });
        }
        return res.status(500).json({ message: "Erro interno no servidor. Tente novamente mais tarde." });
    }
};

exports.login = async(req,res)=>{
    const { userEmail, userPassword } = req.body || {}
    if (typeof userEmail !== 'string' || typeof userPassword !== 'string') {
        return res.status(400).json({ message: "E-mail e senha são obrigatórios.", authenticated: false })
    }
    try{
        const normalizedEmail = userEmail.toLowerCase().trim()
        const userQuery = User.findOne({ userEmail: normalizedEmail })
        const user = userQuery && typeof userQuery.lean === 'function'
            ? await userQuery.lean()
            : await userQuery
        if (!user){
            console.warn('Falha no login: usuário não encontrado no banco configurado.')
            return res.status(401).json({message:"E-mail ou senha inválidos.", authenticated:false})
        }
        if (user.emailConfirmationTokenHash) {
            return res.status(403).json({ message: "Confirme seu e-mail antes de entrar.", authenticated: false })
        }
        if (!isAccountActive(user)) {
            if (user.accessPending) {
                return res.status(403).json({ message: "Seu e-mail foi confirmado e sua solicitação aguarda liberação de um administrador.", authenticated: false })
            }
            return res.status(403).json({ message: "Sua conta está desativada. Solicite a reativação à administração.", authenticated: false })
        }
        const isMatch = await bcrypt.compare(userPassword,user.userPassword)
        if(isMatch){
            const token = gerarToken({
                userId: String(user._id),
                userEmail: normalizedEmail,
                userMatriculaId: user.userMatriculaId,
                userTipo: user.tipo
            })
            return res.json({
                status: "Login feito com sucesso!",
                authenticated: true,
                token,
                userID: user.userMatriculaId,
                userRecordId: String(user._id),
                userTipo: user.tipo
            })
        }else{
            console.warn('Falha no login: senha inválida para usuário localizado.')
            return res.status(401).json({message:"E-mail ou senha inválidos.", authenticated:false})
        }
    }catch(err){
        console.error("Erro ao autenticar usuário:", { name: err.name, code: err.code })
        return res.status(500).json({message:"Erro interno ao autenticar usuário.",authenticated:false})
    }
}

exports.currentSession = async (req, res) => {
    const userId = req.user && req.user.userId
    if (typeof userId !== 'string' || !userId) {
        return res.status(401).json({ message: 'Faça login novamente para continuar.' })
    }
    try {
        const currentUser = await User.findById(userId)
            .select('userName userEmail userMatriculaId tipo')
            .lean()
        if (!currentUser) {
            return res.status(401).json({ message: 'A conta associada a esta sessão não existe mais.' })
        }
        const access = await getEffectiveAccess(userId)
        if (!access) {
            return res.status(401).json({ message: 'A conta está desativada ou não possui acesso.' })
        }
        return res.status(200).json({
            authenticated: true,
            user: {
                userId: String(currentUser._id),
                userName: currentUser.userName,
                userEmail: currentUser.userEmail,
                userMatriculaId: currentUser.userMatriculaId,
                userTipo: currentUser.tipo,
                roleKey: access.role ? access.role.key : (currentUser.tipo === 'admin' ? 'administrador' : 'basico'),
                permissions: access.permissions
            }
        })
    } catch (error) {
        console.error('Erro ao validar sessão:', error)
        return res.status(500).json({ message: 'Não foi possível validar a sessão.' })
    }
}

exports.recoverPassword = async(req,res)=>{
    try {
        const userEmail = req.body && req.body.userEmail
        if (typeof userEmail !== 'string' || !userEmail.trim()) {
            return res.status(400).json({ message: "Informe um e-mail válido." })
        }
        const user = await User.findOne({
            userEmail: userEmail.toLowerCase().trim()
        }) 

        if (!user){
            return res.status(200).json({message:"Se o e-mail estiver cadastrado, você receberá um link para redefinir a senha."})
        }
        const token = gerarTokenRecuperacao(user._id)
        const passwordResetTokenHash = crypto.createHash('sha256').update(token).digest('hex')
        await User.updateOne({ _id: user._id }, { $set: { passwordResetTokenHash } })
        await sendMailRecoverPassword(user, token)
        return res.status(200).json({message:"Se o e-mail estiver cadastrado, você receberá um link para redefinir a senha."})
    } catch (error) {
        console.error("Erro ao solicitar recuperação de senha:", error)
        return res.status(500).json({message:"Não foi possível enviar o link de recuperação. Tente novamente mais tarde."})
    }

}

exports.passwordFormUpdate = async(req,res)=>{
    try {
        verificarTokenRecuperacao(req.params.token)
        const form = `
        <!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Redefinir senha</title>
        <form method="post" action="">
          <label for="password">Digite a nova senha:</label>
          <input type="password" id="password" name="userPassword" minlength="8" autocomplete="new-password" required>
          <button type="submit">Confirmar alteração de senha</button>
        </form>
        `
        return res.status(200).send(form)
    } catch (error) {
        return res.status(400).send('Link de recuperação inválido ou expirado.')
    }
}

exports.resetPassword = async (req, res) => {
    try {
        const userId = verificarTokenRecuperacao(req.params.token)
        const { userPassword } = req.body || {}
        if (typeof userPassword !== 'string' || userPassword.length < 8) {
            return res.status(400).json({ message: "A nova senha deve ter pelo menos 8 caracteres." })
        }

        const tokenHash = crypto.createHash('sha256').update(req.params.token).digest('hex')
        const hashedPassword = await bcrypt.hash(userPassword, 10)
        const updatedUser = await User.findOneAndUpdate(
            { _id: userId, passwordResetTokenHash: tokenHash },
            { $set: { userPassword: hashedPassword }, $unset: { passwordResetTokenHash: 1 } },
            { new: true }
        )
        if (!updatedUser) {
            return res.status(400).json({ message: "Link de recuperação inválido ou já utilizado." })
        }
        if (req.is('application/x-www-form-urlencoded')) {
            return res.status(200).type('html').send('<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Senha atualizada</title><p>Senha alterada com sucesso.</p><a href="/">Voltar ao login</a></html>')
        }
        return res.status(200).json({ message: "Senha alterada com sucesso." })
    } catch (error) {
        if (error.name === 'TokenExpiredError' || error.name === 'JsonWebTokenError' || error.message === 'Invalid password reset token') {
            return res.status(400).json({ message: "Link de recuperação inválido ou expirado." })
        }
        console.error("Erro ao redefinir senha:", error)
        return res.status(500).json({ message: "Erro interno ao redefinir a senha." })
    }
}


exports.confirmEmail = async (req, res) => {
    try {
        const userId = verificarTokenConfirmacao(req.params.token)
        const tokenHash = crypto.createHash('sha256').update(req.params.token).digest('hex')
        const confirmedUser = await User.findOneAndUpdate(
            { _id: userId, emailConfirmationTokenHash: tokenHash },
            { $unset: { emailConfirmationTokenHash: 1 } },
            { new: true }
        )
        if (!confirmedUser) return res.status(400).send('Invalid or already used confirmation link.')
        return res.status(200).send('E-mail confirmado. Sua solicitação aguarda a liberação de um administrador.')
    } catch (error) {
        if (error.name === 'TokenExpiredError' || error.name === 'JsonWebTokenError' || error.message === 'Invalid email confirmation token') {
            return res.status(400).send('Invalid or expired confirmation link.')
        }
        console.error('Email confirmation failed:', error)
        return res.status(500).send('Unable to confirm email.')
    }
}
