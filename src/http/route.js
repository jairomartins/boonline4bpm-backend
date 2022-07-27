
const boCont = require('../controllers/boletimController')

function route (app){
    app.get('/',(req,res)=>{

        res.send('it´s ok!')
    })

    app.get('/inserirbo',(req,res)=>{
        boCont.createBoletim(req,res)
        res.send('tentei cara;/')
    })
    app.get('/listbo',async (req,res)=>{
        await boCont.BoletimList(req,res)
        // res.send('tentei cara;/')
    })

    app.get('/listaByID', async (req, res)=>{
        await boCont.boletimByID(req, res)
    })

    app.post('/savebo', async (req,res)=>{
        await boCont.createBoletim(req,res)
    })


}

module.exports = route