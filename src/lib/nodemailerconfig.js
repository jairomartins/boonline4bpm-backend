const nodemailer = require('nodemailer');
require('dotenv').config();

const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: {
        user: process.env.EMAIL_USER,  // Movido para variáveis de ambiente
        pass: process.env.EMAIL_PASSWORD
    }
});

/**
 * Retorna o protocolo adequado (HTTP ou HTTPS) baseado na variável de ambiente.
 */
function getProtocolo() {
    return process.env.USE_HTTPS === 'true' ? 'https' : 'http';
}

/**
 * Função auxiliar para envio de e-mails.
 */
async function sendMail(to, subject, htmlContent) {
    try {
        if (!to) throw new Error("Destinatário do e-mail não informado.");
        
        const mailOptions = {
            from: process.env.EMAIL_USER,
            to,
            subject,
            html: htmlContent
        };

        const info = await transporter.sendMail(mailOptions);
        console.log(`E-mail enviado para ${to}: ${info.response}`);
        return info;
    } catch (error) {
        console.error(`Erro ao enviar e-mail para ${to}:`, error);
        throw error; // Repassa o erro para quem chamar a função
    }
}

/**
 * Envia e-mail de confirmação de cadastro.
 */
exports.sendMailConfirm = async (destinatario, id) => {
    const confirmUrl = `${getProtocolo()}://${process.env.BASE_URL}:${process.env.PORT}/users/confirm/${id}`;
    
    const htmlContent = `
        <p>Parabéns por entrar no Boletim Online! Para ativar seu cadastro, clique no link abaixo:</p>
        <a href="${confirmUrl}">Confirmar cadastro</a>
        <p><i>Criado por: SD Jmartins ID 871110 PMMA</i></p>
    `;

    return sendMail(destinatario, 'Confirme seu cadastro no BOLETIM ONLINE', htmlContent);
};

/**
 * Envia e-mail para recuperação de senha.
 */
exports.sendMailRecoverPassword = async (user) => {
    if (!user || !user.userEmail || !user.id) {
        throw new Error("Usuário inválido ou dados insuficientes para recuperação de senha.");
    }

    const recoverUrl = `${getProtocolo()}://${process.env.BASE_URL}:${process.env.PORT}/passwordrecover/${user.id}`;

    const htmlContent = `
        <p>Você solicitou a recuperação de senha do Boletim Online 4BPM:</p>
        <a href="${recoverUrl}">Redefinir Senha</a>
        <p><i>Criado por: SD Jmartins ID 871110 PMMA</i></p>
    `;

    return sendMail(user.userEmail, 'Recuperação de senha BOLETIM ONLINE', htmlContent);
};
