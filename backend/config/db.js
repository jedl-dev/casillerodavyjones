const mongoose = require('mongoose');

// Mantenemos una referencia a la conexión para reutilizarla
let isConnected = false;

const connectDB = async () => {
  if (isConnected) {
    console.log('=> Usando conexión existente a MongoDB');
    return;
  }

  try {
    const db = await mongoose.connect(process.env.MONGO_URI, {
      dbName: 'onepiece'
    });
    
    // El valor 1 significa "conectado"
    isConnected = db.connections[0].readyState;
    console.log(`⚓ Nueva conexión establecida: ${db.connection.host}`);
  } catch (err) {
    console.error(`❌ Error en conexión: ${err.message}`);
    // En serverless, no hacemos process.exit(1), dejamos que la función falle
    throw err; 
  }
};

module.exports = { connectDB };