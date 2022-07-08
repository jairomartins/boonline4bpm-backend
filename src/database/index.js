const mongoose = require ('mongoose')

mongoose.connect('mongodb://localhost/boonline')

mongoose.Promise = global.Promise;

module.exports = mongoose