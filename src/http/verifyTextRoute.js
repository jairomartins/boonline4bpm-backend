const TextController = require('../controllers/textController')
// Rota principal
function  verifyTextRoute (app){

    app.post('/api/verify-text', async (req, res)=>{
        
        console.log('POST /api/verify-text')
        
        await TextController.verifyText(req, res)
    })
}

module.exports = verifyTextRoute