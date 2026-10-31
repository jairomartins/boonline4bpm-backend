const mongoose = require ('mongoose')

mongoose.set("strictQuery", false);

const mongoUri = process.env.MONGO || 'mongodb://127.0.0.1:27017/boonline'

// Keep a single shared connection, but let maintenance commands await it and
// report failures instead of silently continuing against an unknown database.
mongoose.connect(mongoUri).catch(error => {
    console.error('Falha ao conectar ao MongoDB:', error.message)
})

mongoose.Promise = global.Promise;

module.exports = mongoose

