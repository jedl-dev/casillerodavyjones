// C:\Documentos\onepiecegames\backend\server\config\db.js
const mongoose = require('mongoose');

// Parche para Node 24 en Nayarit
require('node:dns').setDefaultResultOrder('ipv4first');

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI, {
      dbName: 'onepiece'
    });
    console.log(`🔥 MongoDB Conectado: ${conn.connection.host}`);
  } catch (err) {
    console.error(`❌ Error: ${err.message}`);
    process.exit(1);
  }
};

// LA EXPORTACIÓN DEBE SER ASÍ:
module.exports = { connectDB };