const jwt = require('jsonwebtoken');

const TOKEN_HEADER = "x-access-token";
const SECRET_PASSWORD_TOKEN = process.env.SECRET_PASSWORD_TOKEN

const verificaToken = (req, res, next) => {
    const token = req.headers[TOKEN_HEADER]
    try{
        if(!token){
            res.json({message:"você precisa de um token"})
        }else{
            jwt.verify(token,SECRET_PASSWORD_TOKEN, (err,decoded)=>{
                if(err){
                    console.log("Erro na verificação do token:", err);
                    return res.status(401).json({ message: "Falha ao autenticar o token", auth:false});
                }else{
                    console.log("Token valido !")
                    next()
                }
            })
        }
    }catch(err){
        console.log("Erro ao verificar o token:", err);
        return res.status(500).json({ message: "Erro ao verificar o token" });
    }
};

const gerarToken = (data)=>{
    return jwt.sign({data},SECRET_PASSWORD_TOKEN,{expiresIn:60*1000})
}

module.exports = {
  verificaToken,
  gerarToken
};