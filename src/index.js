// Arquivo: boonline4bpm-backend/src/index.js
// Descrição: Ponto de entrada do aplicativo Express com suporte para HTTP e HTTPS
// Autor: Jairo Martins

require('dotenv').config();
const express = require('express');
const https = require('https');
const http = require('http');
const fs = require('fs');
const bodyParser = require('body-parser');
const cors = require('cors');

const app = express();

// Middleware 
// Configuração do CORS e body-parser (análise do corpo da requisição e suporte a JSON)
app.use(cors()); // Habilita CORS for all routes
app.use(bodyParser.json()); // Suporte to JSON bodies
app.use(bodyParser.urlencoded({ extended: false })); // Suporte to URL-encoded bodies

// Routes
require('./http/route')(app);
require('./http/incidentReportRoute')(app);
require('./http/userRoute')(app);
require('./http/authRouter')(app);
require('./http/verifyTextRoute')(app);

const port = process.env.PORT || 3000;

if (process.env.USE_HTTPS === 'true') {
  const privateKey = fs.readFileSync('/etc/letsencrypt/live/jmartins.vps-kinghost.net/privkey.pem', 'utf8');
  const certificate = fs.readFileSync('/etc/letsencrypt/live/jmartins.vps-kinghost.net/cert.pem', 'utf8');
  const ca = fs.readFileSync('/etc/letsencrypt/live/jmartins.vps-kinghost.net/chain.pem', 'utf8');

  // Configuração das credenciais SSL (chave privada, certificado e CA)
  const credentials = {
    key: privateKey, // Chave privada
    cert: certificate, // Certificado
    ca: ca // Autoridade certificadora
  };

  const httpsServer = https.createServer(credentials, app);

  httpsServer.listen(port, () => {
    console.log(`Online in https://${process.env.BASE_URL}:${port}`);
  });
} else {
  const httpServer = http.createServer(app);

  httpServer.listen(port, () => {
    console.log(`Online in http://${process.env.BASE_URL}:${port}`);
  });
}