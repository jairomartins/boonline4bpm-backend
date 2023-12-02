require('dotenv').config();
const express = require('express');
const https = require('https');
const fs = require('fs');
const bodyParser = require('body-parser');
const cors = require('cors');

const app = express();

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

// Middleware para redirecionamento de HTTP para HTTPS
const enforceHttps = (req, res, next) => {
  if (req.secure) {
    // A requisição já é HTTPS, não é necessário redirecionar
    return next();
  }

  // Redireciona para HTTPS
  res.redirect(`https://${req.hostname}${req.url}`);
};

// Adiciona o middleware globalmente
app.use(enforceHttps);

// Rotas do seu aplicativo
require('./http/route')(app);
require('./http/boletimRoute')(app);
require('./http/userRoute')(app);
require('./http/authRouter')(app);

const httpsPort = process.env.PORT || 443;

// Configurações para HTTPS
const privateKey = fs.readFileSync('/etc/letsencrypt/live/jmartins.vps-kinghost.net/privkey.pem', 'utf8');
const certificate = fs.readFileSync('/etc/letsencrypt/live/jmartins.vps-kinghost.net/cert.pem', 'utf8');
const ca = fs.readFileSync('/etc/letsencrypt/live/jmartins.vps-kinghost.net/chain.pem', 'utf8');

const credentials = {
  key: privateKey,
  cert: certificate,
  ca: ca
};

// Cria um servidor HTTPS
const httpsServer = https.createServer(credentials, app);

httpsServer.listen(httpsPort, () => {
  console.log(`Online in https://${process.env.BASE_URL}:${httpsPort}`);
});