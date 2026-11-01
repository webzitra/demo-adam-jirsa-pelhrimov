const { handler } = require('../netlify/functions/zona-auth.js');
const netlifyToVercel = require('./_netlify-adapter');

module.exports = netlifyToVercel(handler);
