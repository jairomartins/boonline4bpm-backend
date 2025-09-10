function route (app){
    app.get('/',(req,res)=>{
        console.log("[Servidor : ON]")
        res.send('[Servidor : ON version 10/09/2025]') 
    })
}
module.exports = route