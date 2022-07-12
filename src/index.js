require('dotenv').config()

//const's
const port = process.env.PORT


const express = require('express')

const bodyParser = require('body-parser')

const route = require('./http/route')
const userRoute = require('./http/userRoute')

const cors = require('cors')// define de onde são permitidas as requisições defaul = todos os lugares

app = express()

app.use(cors())

app.use(bodyParser.json())

app.use(bodyParser.urlencoded({extended:false})) //entender quando passar parametro via url

route(app)

userRoute(app)

require('./controllers/authController')(app)

app.listen(port,()=>{
    console.log('Online  in http://localhost:'+port)
})