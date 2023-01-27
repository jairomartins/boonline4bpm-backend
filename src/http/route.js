
const boCont = require('../controllers/boletimController')

function route (app){
    app.get('/',(req,res)=>{
        console.log("run")
        res.send('it´s ok!')
    })
}

module.exports = route