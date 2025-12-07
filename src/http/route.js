function route (app){
    app.get('/',(req,res)=>{
        console.log("[Server : ON]")
        res.send('[Server : ON  (version 04/12/2025)]') 
    })
}
module.exports = route