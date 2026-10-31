// Preloaded by npm test. Tests mock persistence and never connect to a real DB.
const mongoose = require('mongoose')
const Module = require('node:module')
mongoose.set('bufferCommands', false)
const filename = require.resolve('../database/db')
const mocked = new Module(filename)
mocked.filename = filename
mocked.loaded = true
mocked.exports = mongoose
require.cache[filename] = mocked
mongoose.connect = () => { throw new Error('Database connections are disabled in unit tests') }
