function route (app){
    app.get('/',(req,res)=>{
        console.log("[Servidor : ON]")
        res.send('[Servidor : ON version 20/11/2025]') 
    })
}
module.exports = route