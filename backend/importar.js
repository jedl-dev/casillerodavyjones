const axios = require('axios');
const fs = require('fs');

async function bulkImport() {
  try {
    // 1. Cargar el JSON
    const rawData = fs.readFileSync('./personajes.json', 'utf8');
    const personajes = JSON.parse(rawData);
    
    console.log(`🚢 Preparando el envío de ${personajes.length} registros a Atlas...`);

    // 2. Ejecutar inserciones por lotes
    for (const p of personajes) {
      try {
        await axios.post('http://localhost:5000/api/characters', p);
        console.log(`✅ ${p.name} ha sido registrado exitosamente.`);
      } catch (err) {
        console.error(`❌ Error con ${p.name}:`, err.response?.data?.msg || err.message);
      }
    }

    console.log('🏁 ¡Proceso completado! Revisa tu galería en el puerto 5173.');
  } catch (error) {
    console.error('💥 Error fatal al leer el archivo:', error.message);
  }
}

bulkImport();