const mongoose = require ('mongoose')

mongoose.connect('mongodb://localhost/boletim')

mongoose.Promise = global.Promise;

module.exports = mongoose