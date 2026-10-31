// Arquivo: boonline4bpm-backend/src/index.js
// Descrição: Ponto de entrada do aplicativo Express com suporte para HTTP e HTTPS
// Autor: Jairo Martins

require('dotenv').config();
if (process.env.NODE_ENV === 'production' && !process.env.MONGO) {
  throw new Error('MONGO é obrigatório em produção; configure o banco explicitamente no .env.');
}
if (process.env.NODE_ENV === 'production' && !process.env.SECRET_PASSWORD_TOKEN) {
  throw new Error('SECRET_PASSWORD_TOKEN é obrigatório em produção.');
}
const mongoose = require('./database/db');
const express = require('express');
const https = require('https');
const http = require('http');
const fs = require('fs');
const bodyParser = require('body-parser');
const cors = require('cors');

const app = express();

// Middleware 
// Configuração do CORS e body-parser (análise do corpo da requisição e suporte a JSON)
const configuredCorsOrigins = (process.env.CORS_ORIGIN || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
const corsOrigins = [...new Set([
  ...(process.env.NODE_ENV === 'production' ? [] : ["http://localhost:3000"]),
  ...configuredCorsOrigins,
])];

// Same-origin requests do not need CORS. Cross-origin access is limited to
// known frontend origins and optional, explicitly configured deployments.
app.use(cors({
  origin: corsOrigins,
  methods: ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "X-Access-Token"],
  optionsSuccessStatus: 204,
}));
app.use(bodyParser.json()); // Suporte to JSON bodies
app.use(bodyParser.urlencoded({ extended: false })); // Suporte to URL-encoded bodies

// Routes
require('./http/route')(app);
require('./http/docsRoute')(app);
require('./http/incidentReportRoute')(app);
require('./http/naturezaRoute')(app);
require('./http/localidadeRoute')(app);
require('./http/roleRoute')(app);
require('./http/userRoute')(app);
require('./http/authRouter')(app);

const port = process.env.PORT || 3001;

let server;
let protocol;
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

  server = https.createServer(credentials, app);
  protocol = 'https';
} else {
  server = http.createServer(app);
  protocol = 'http';
}

mongoose.connection.asPromise()
  .then(() => server.listen(port, () => {
    console.log(`MongoDB conectado; API online em ${protocol}://${process.env.BASE_URL || 'localhost'}:${port}`);
  }))
  .catch(error => {
    console.error('API não iniciada porque a conexão MongoDB falhou:', error.message);
    process.exitCode = 1;
  });
