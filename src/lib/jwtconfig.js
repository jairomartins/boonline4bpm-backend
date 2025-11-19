const jwt = require('jsonwebtoken');
const TOKEN_HEADER = "x-access-token";
const SECRET_PASSWORD_TOKEN = process.env.SECRET_PASSWORD_TOKEN;

const verificaToken = (req, res, next) => {
    const token = req.headers[TOKEN_HEADER];

    if (!token) {
        return res.status(401).json({ message: "Token não fornecido", auth: false });
    }

    jwt.verify(token, SECRET_PASSWORD_TOKEN, (err, decoded) => {
        if (err) {
            console.log("Erro ao autenticar token:", err);
            return res.status(401).json({ message: "Token inválido ou expirado", auth: false });
        }

        // Se chegou aqui, o token é válido
        req.user = decoded;
        next();
    });
};

const gerarToken = (data) => {
    return jwt.sign({ data }, SECRET_PASSWORD_TOKEN, { expiresIn: "2h" }); // <-- defina um tempo de expiração aqui
};

module.exports = {
    verificaToken,
    gerarToken
};
