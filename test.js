const parser = require('./parser')
const fs = require('fs')

// console.log(parser(fs.readFileSync('test.magic', 'utf8')))
fs.writeFileSync('output.json', JSON.stringify(parser(fs.readFileSync('test.magic', 'utf8')), null, 4))