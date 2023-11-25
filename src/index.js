const https = require('https');
const fs = require('fs');
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');

const app = express();

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

// Rotas do seu aplicativo
require('./http/route')(app);
require('./http/boletimRoute')(app);
require('./http/userRoute')(app);
require('./http/authRouter')(app);

// Certificados SSL do Let's Encrypt
const privateKeyPath = '/etc/letsencrypt/live/jmartins.vps-kinghost.net/privkey.pem';
const certificatePath = '/etc/letsencrypt/live/jmartins.vps-kinghost.net/fullchain.pem';
// Middleware para permitir requisições CORS
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '167.249.15.184'); // ou substitua '*' pelo domínio específico que você deseja permitir
    res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE');
    res.header('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        // Preflight request. Reply successfully:
        res.sendStatus(200);
    } else {
        next();
    }
});
// Adicionar middleware para redirecionamento HTTP para HTTPS
app.use((req, res, next) => {
    if (req.secure) {
        // A solicitação já é segura, prossiga para a próxima middleware
        next();
    } else {
        // Redirecionar para o mesmo caminho usando HTTPS
        res.redirect(`https://${req.headers.host}${req.url}`);
    }
});

const privateKey = fs.readFileSync(privateKeyPath, 'utf8');
const certificate = fs.readFileSync(certificatePath, 'utf8');

const credentials = { key: privateKey, cert: certificate };

const httpsServer = https.createServer(credentials, app);

const port = process.env.PORT || 443;

httpsServer.listen(port, () => {
    console.log(`Online in https://${process.env.BASE_URL}:${port}`);
});
