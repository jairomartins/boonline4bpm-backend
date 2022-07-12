//controller de usuarios

const { json } = require('body-parser')
const user = require('../model/user')

exports.userList = async (req, res)=>{
    const result = await user.find()
    res.send(JSON.stringify(result))
}


