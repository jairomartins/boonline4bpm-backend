require('dotenv').config()

//const's
const port = process.env.PORT

console.log(process.env.MONGO)

// const email = require('./lib/nodemailerconfig')

const express = require('express')
const bodyParser = require('body-parser')
const cors = require('cors')// define de onde são permitidas as requisições. default = todos os lugares

app = express()

app.use(cors())

app.use(bodyParser.json())

app.use(bodyParser.urlencoded({extended:false})) //entender quando passar parametro via url

require('./http/route')(app)
require('./http/boletimRoute')(app)
require('./http/userRoute')(app)
require('./http/authRouter')(app)

app.listen(port,()=>{
    console.log(`Online  in http://${process.env.BASE_URL}:${port}`)
})