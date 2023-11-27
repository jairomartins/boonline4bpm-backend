require('dotenv').config();
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


const port = process.env.PORT || 443;

app.listen(port, () => {
    console.log(`Online in http://${process.env.BASE_URL}:${port}`);
});
