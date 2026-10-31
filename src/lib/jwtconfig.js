const jwt = require('jsonwebtoken');
const User = require('../model/user');
const { isAccountActive } = require('../utils/authorization')
const TOKEN_HEADER = "x-access-token";
const SECRET_PASSWORD_TOKEN = process.env.SECRET_PASSWORD_TOKEN;

const verificaToken = async (req, res, next) => {
    const token = req.headers[TOKEN_HEADER];

    if (!token) {
        return res.status(401).json({ message: "Missing token", code: "TOKEN_MISSING", auth: false });
    }

    try {
        const decoded = jwt.verify(token, SECRET_PASSWORD_TOKEN);
        if (!decoded || !decoded.data || typeof decoded.data !== 'object' ||
            typeof decoded.data.userId !== 'string') {
            return res.status(401).json({ message: "Invalid token", code: "TOKEN_INVALID", auth: false });
        }
        const userQuery = User.findById(decoded.data.userId)
        const currentUser = userQuery && typeof userQuery.lean === 'function'
            ? await userQuery.lean()
            : await userQuery
        if (!currentUser) {
            return res.status(401).json({ message: "Account no longer exists", auth: false });
        }
        if (!isAccountActive(currentUser)) {
            return res.status(401).json({ message: "Account is inactive", auth: false });
        }
        req.user = decoded.data;
        return next();
    } catch (err) {
        if (err && ['JsonWebTokenError', 'TokenExpiredError', 'NotBeforeError'].includes(err.name)) {
            if (err.name === 'TokenExpiredError') return res.status(401).json({ message: 'Token expired', code: 'TOKEN_EXPIRED', auth: false });
            return res.status(401).json({ message: "Invalid token", code: "TOKEN_INVALID", auth: false });
        }
        console.error("Error authenticating account:", err);
        return res.status(500).json({ message: "Unable to validate account status", auth: false });
    }
};

const gerarToken = (data) => {
    return jwt.sign({ data }, SECRET_PASSWORD_TOKEN, { expiresIn: "2h" });
};

const gerarTokenRecuperacao = (userId) => jwt.sign(
    { purpose: 'password-reset', userId: String(userId) },
    SECRET_PASSWORD_TOKEN,
    { expiresIn: '15m' }
);

const gerarTokenConfirmacao = (userId) => jwt.sign(
    { purpose: 'email-confirmation', userId: String(userId) },
    SECRET_PASSWORD_TOKEN,
    { expiresIn: '24h' }
);

const verificarTokenRecuperacao = (token) => {
    const decoded = jwt.verify(token, SECRET_PASSWORD_TOKEN);
    if (decoded.purpose !== 'password-reset' || typeof decoded.userId !== 'string') {
        throw new Error('Invalid password reset token');
    }
    return decoded.userId;
};

const verificarTokenConfirmacao = (token) => {
    const decoded = jwt.verify(token, SECRET_PASSWORD_TOKEN);
    if (decoded.purpose !== 'email-confirmation' || typeof decoded.userId !== 'string') {
        throw new Error('Invalid email confirmation token');
    }
    return decoded.userId;
};

module.exports = {
    verificaToken,
    gerarToken,
    gerarTokenRecuperacao,
    verificarTokenRecuperacao,
    gerarTokenConfirmacao,
    verificarTokenConfirmacao
};
