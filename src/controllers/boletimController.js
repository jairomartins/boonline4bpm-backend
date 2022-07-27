//controller do boletim

const { json } = require('body-parser')
const Boletim = require('../model/boletim')

exports.BoletimList = async (req, res)=>{
    const result = await Boletim.find()
    res.send(JSON.stringify(result))
}

exports.boletimByID = async (req, res)=>{
    const result = await Boletim.find({_id: req.params.IDBoletim})

    res.send(JSON.stringify(result))
}

exports.createBoletim = async(req, res)=>{
    
    try{
        const newBoletim = await Boletim.create(req.body.boletim)
        return res.status(200).send(JSON.stringify(newBoletim))
    }catch(err){
        return res.status(400).send({error:'Registration failed'})
    }
    
}








// const newEnvolvido = { 
//     tipoEnvolvido:"testemunha",
//     nome:"Jairo Martins",
//     cpf:"000.000.000-00",
//     sexo:"masculino",
//     nascimento:"10/10/1994",
//     endereco:"rua XY",
//     numero:"s",
//     pontoReferencia:"s",
//     bairro:"s",
//     municipio:"s",
//     telefone:"s",
//     nomeMae:"s",
//     obs:"s"
// }
// const bo = {numero:"1232",
// horario:"10:23",
// data:"10/10/2014",
// natureza:"XYX",
// latitude:"",
// longitude:"",
// endereco:"Rua A",
// numero:"22",
// bairro:"Alpha Ville",
// municipio:"Bauru",
// referencia:"",
// envolvidos:[{ 
//     tipoEnvolvido:"testemunha",
//     nome:"Jairo Martins",
//     cpf:"000.000.000-00",
//     sexo:"masculino",
//     nascimento:"10/10/1994",
//     endereco:"rua XY",
//     numero:"s",
//     pontoReferencia:"s",
//     bairro:"s",
//     municipio:"s",
//     telefone:"s",
//     nomeMae:"s",
//     obs:"s"
// },{ 
//     tipoEnvolvido:"testemunha",
//     nome:"Jairo Martins",
//     cpf:"000.000.000-00",
//     sexo:"masculino",
//     nascimento:"10/10/1994",
//     endereco:"rua XY",
//     numero:"s",
//     pontoReferencia:"s",
//     bairro:"s",
//     municipio:"s",
//     telefone:"s",
//     nomeMae:"s",
//     obs:"s"
// }],
// material:[],
// efetivo:[],
// historico:[]
// }

