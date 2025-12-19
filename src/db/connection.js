const { MongoClient } = require('mongodb');
require('dotenv').config();

const uri = process.env.MONGO_URI;
const client = new MongoClient(uri);

let dbConnection;

module.exports = {
  connectToDb: async (cb) => {
    try {
      if (!dbConnection) {
        await client.connect();
        dbConnection = client.db('Ezeiza');
        console.log('Conectado exitosamente a MongoDB');
      }
      return cb();
    } catch (err) {
      console.error('Error conectando a MongoDB:', err);
      return cb(err);
    }
  },
  getDb: () => dbConnection,
  getClient: () => client
};