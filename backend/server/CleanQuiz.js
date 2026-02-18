const mongoose = require('mongoose');
const Question = require('./models/Question');
const fs = require('fs');
require('dotenv').config();

async function rollbackImport() {
  try {
    // 1. Conectar a la DB (Atlas)
    await mongoose.connect(process.env.MONGO_URI);
    console.log("⚓ Conexión establecida para el Rollback...");

    // 2. Leer el archivo JSON para saber qué borrar
    const rawData = fs.readFileSync('./preguntas.json', 'utf8');
    const preguntas = JSON.parse(rawData);
    
    // Extraemos solo los textos de las preguntas para usarlos como filtro
    const textosABorrar = preguntas.map(q => q.questionText);

    console.log(`🗑️ Preparando eliminación de ${textosABorrar.length} registros...`);

    // 3. Ejecutar deleteMany
    const result = await Question.deleteMany({
      questionText: { $in: textosABorrar }
    });

    console.log(`✅ ¡Misión cumplida! Se eliminaron ${result.deletedCount} preguntas.`);
    
  } catch (error) {
    console.error('💥 Error durante el borrado:', error.message);
  } finally {
    mongoose.connection.close();
    process.exit();
  }
}

rollbackImport();