require('dotenv').config()

//const's
const port = process.env.PORT

console.log(process.env.MONGO)

const express = require('express')

const bodyParser = require('body-parser')

const route = require('./http/route')

const userRoute = require('./http/userRoute')

const boRoute = require('./http/boletimRoute')

const cors = require('cors')// define de onde são permitidas as requisições. default = todos os lugares

app = express()

app.use(cors())

app.use(bodyParser.json())

app.use(bodyParser.urlencoded({extended:false})) //entender quando passar parametro via url

route(app)

userRoute(app)

boRoute(app)

require('./controllers/authController')(app)

app.listen(433,()=>{
    console.log('Online  in http://localhost:433')
})