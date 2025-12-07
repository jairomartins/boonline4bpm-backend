const jwt = require('jsonwebtoken');
const TOKEN_HEADER = "x-access-token";
const SECRET_PASSWORD_TOKEN = process.env.SECRET_PASSWORD_TOKEN;

const verificaToken = (req, res, next) => {
    const token = req.headers[TOKEN_HEADER];

    if (!token) {
        return res.status(401).json({ message: "Missing token", auth: false });
    }

    jwt.verify(token, SECRET_PASSWORD_TOKEN, (err, decoded) => {
        if (err) {
            console.log("Error authenticating token:", err);
            return res.status(401).json({ message: "Invalid or expired token", auth: false });
        }

        // If we reach here, the token is valid
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
