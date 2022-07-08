const express = require('express')

const bodyParser = require('body-parser')

const route = require('./http/route')

app = express()

app.use(bodyParser.json())

app.use(bodyParser.urlencoded({extended:false})) //entender quando passar parametro via url

route(app)

require('./controllers/authController')(app)

app.listen(3000,()=>{
    console.log('Online  in http://localhost:3000')
})