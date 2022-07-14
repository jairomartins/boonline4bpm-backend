//controller do boletim

const { json } = require('body-parser')
const Boletim = require('../model/boletim')
const Env = require('../model/envolvido')

exports.BoletimList = async (req, res)=>{
    const result = await Boletim.find()
    res.send(JSON.stringify(result))
}


exports.createBoletim = async(req, res)=>{
    
    try{
        // const newBoletim = await Boletim.create({
        //     numero:"123",
        //     natureza:"furto",
        //     envolvidos:[{
        //             nome:"joao",
        //             sobrenome:"martins"
        //         },{
        //             nome:"maria",
        //             sobrenome:"martins"
        //         },{
        //             nome:"henrique",
        //             sobrenome:"martins"
        //         }
        //     ],
        //     material:[{
        //         descricao:"item1",
        //     },{
        //         descricao:"item3",
        //         quantidade:"23gramas",
        //         validade:"23"
        //     }],
        //     efetivo:[{vtr:"128",
        //     nome:"jairo martins de sousa",
        //     graduacao:"SD PM",
        //     numeroBarra:"194/18",
        //     id:"871110"},
        //     {vtr:"128",
        //     nome:"henrique martins de sousa",
        //     graduacao:"CAP PM",
        //     numeroBarra:"/48",
        //     id:"871111-2"}
        // ],
        //     historico:{content:"Aqui vai o histórico 3"},
             
        // })
        const newBoletim = await Boletim.create(req.body.boletim)
        console.log("-------------\n"+newBoletim)
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

