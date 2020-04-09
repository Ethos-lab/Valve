const shim = require('lambda-shim');
// console.log(module.exports)
// shim.makeShim(module.exports, true);
// console.log('After')
// console.log(module.exports)
module.exports = (event, context, callback) => {
    console.log("Hello World")
    var response = shim.makeShim( true);
    console.log('received response')
    console.log(response)
    response(event, context, callback)
}

// *** Try ***

