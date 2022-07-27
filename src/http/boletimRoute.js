
const boCont = require('../controllers/boletimController')

function route (app){

    app.get('/adm/boletim',(req,res)=>{
        boCont.createBoletim(req,res)
        res.send('tentei cara;/')
    })
    
    app.get('/adm/listarBoletins',async ()=>{
        await boCont.BoletimList()
    })

    app.get('/adm/listaByID', async (req, res)=>{
        await boCont.boletimByID(req, res)
    })

    app.get('/adm/listByID/:IDBoletim', async(req, res) => {
        await boCont.boletimByID(req, res)
      })

    app.post('/adm/salvarBoletim', async (req,res)=>{
        await boCont.createBoletim(req,res)
    })


}

module.exports = route