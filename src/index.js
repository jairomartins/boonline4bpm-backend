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

// Rotas do seu aplicativo
require('./http/route')(app);
require('./http/boletimRoute')(app);
require('./http/userRoute')(app);
require('./http/authRouter')(app);

const port = process.env.PORT || 3000;

if (process.env.USE_HTTPS === 'true') {
  const privateKey = fs.readFileSync('/etc/letsencrypt/live/jmartins.vps-kinghost.net/privkey.pem', 'utf8');
  const certificate = fs.readFileSync('/etc/letsencrypt/live/jmartins.vps-kinghost.net/cert.pem', 'utf8');
  const ca = fs.readFileSync('/etc/letsencrypt/live/jmartins.vps-kinghost.net/chain.pem', 'utf8');

  const credentials = {
    key: privateKey,
    cert: certificate,
    ca: ca
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