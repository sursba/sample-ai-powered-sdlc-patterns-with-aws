const serverlessExpress = require('@vendia/serverless-express');
const app = require('./server/index');

// Create the serverless express handler
const handler = serverlessExpress({ app });

module.exports = { handler };