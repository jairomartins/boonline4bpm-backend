require('dotenv').config();
const express = require('express');
const https = require('https');
const http = require('http');
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

app.use(enforceHttps);

// Rotas do seu aplicativo
require('./http/route')(app);
require('./http/boletimRoute')(app);
require('./http/userRoute')(app);
require('./http/authRouter')(app);

const port = process.env.PORT || 443;

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

httpsServer.listen(port, () => {
  console.log(`Online in https://${process.env.BASE_URL}:${port}`);
});

// Cria um servidor HTTP para redirecionar para HTTPS
const httpServer = http.createServer((req, res) => {
  res.writeHead(301, { 'Location': `https://${req.headers.host}${req.url}` });
  res.end();
});

const httpPort = 80;
httpServer.listen(httpPort, () => {
  console.log(`HTTP server listening on port ${httpPort}`);
});