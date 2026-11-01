const { handler } = require('../netlify/functions/zona-data.js');
const netlifyToVercel = require('./_netlify-adapter');

module.exports = netlifyToVercel(handler);
