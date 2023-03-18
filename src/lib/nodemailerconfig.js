const nodemailer = require('nodemailer');
require('dotenv').config()

let transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: {
        user: 'boonlinema@gmail.com',
        pass: process.env.EMAIL_PASSWORD
    }
});

exports.sendMailConfirm = async (destinatario, id)=>{
    

    let mailOptions = {
        from: 'boonlinema@gmail.com',
        to: destinatario,
        subject: 'Confirme seu cadastro no BOLETIM ONLINE',
        html: '<p>Parabéns por entrar no boletim online, para ativar seu cadastro, clique no link abaixo:</p>' +
              `<a href="http://${process.env.BASE_URL}:${process.env.PORT}/users/confirm/${id}">Confirmar cadastro</a>` +
              '<p><i>Criado por: SD Jmartins ID 871110 PMMA</i></p>'
    };
    
    await transporter.sendMail(mailOptions, function(error, info){
        if(error){
            console.log(error);
        }else{
            console.log('E-mail enviado: ' + info.response);
        }
    })
}

exports.sendMailRecoverPassword = async (user)=>{
    let mailOptions = {
        from: 'boonlinema@gmail.com',
        to: user.userEmail,
        subject: 'Recuperação de senha BOLETIM ONLINE',
        html: '<p>Você solicitou a sua senha do Boletim Online 4BPM:</p>' +
            `<a href="http://${process.env.BASE_URL}:${process.env.PORT}/passwordrecover/${user.id}">Redefinir Senha</a>` +
            '<p><i>Criado por: SD Jmartins ID 871110 PMMA</i></p>'
    };
    
    await transporter.sendMail(mailOptions, function(error, info){
        if(error){
            console.log(error);
        }else{
            console.log('E-mail enviado: ' + info.response);
        }
    })
}