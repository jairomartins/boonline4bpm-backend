

function route  (app){
    app.get('/',(req,res)=>{

        res.send('it´s ok!')
    })

}

module.exports = route