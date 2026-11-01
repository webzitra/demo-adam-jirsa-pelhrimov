const { handler } = require('../netlify/functions/zona-admin.js');
const netlifyToVercel = require('./_netlify-adapter');

module.exports = netlifyToVercel(handler);
