const shim = require('lambda-shim');

module.exports = (event, context, callback) => {
    console.log("Hello World")
    var response = shim.makeShim( true);
    console.log('received response')
    console.log(response)
    response(event, context, callback)
}


