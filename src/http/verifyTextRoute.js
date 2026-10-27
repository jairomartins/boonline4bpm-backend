const TextController = require('../controllers/textController')
// Rota principal
function  verifyTextRoute (app){

    app.post('/api/verify-text', async (req, res)=>{
        await TextController.verifyText(req, res)
    })
}

module.exports = verifyTextRoute