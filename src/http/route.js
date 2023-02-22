function route (app){
    app.get('/',(req,res)=>{
        console.log("[Servidor : ON]")
        res.send('[Servidor : ON ]') 
    })
}
module.exports = route