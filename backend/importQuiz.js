const axios = require('axios');
const fs = require('fs');

async function importQuiz() {
  try {
    // 1. Cargar el JSON de preguntas
    const rawData = fs.readFileSync('./preguntas.json', 'utf8');
    const preguntas = JSON.parse(rawData);
    
    console.log(`📡 Iniciando importación de ${preguntas.length} preguntas al Wanted Quiz...`);

    // 2. Enviar cada pregunta al backend
    for (const q of preguntas) {
      try {
        // Asegúrate de que tu servidor esté corriendo en el puerto 5000
        await axios.post('http://localhost:5000/api/quiz', q);
        console.log(`✅ Pregunta registrada (${q.difficulty}): ${q.questionText.substring(0, 30)}...`);
      } catch (err) {
        console.error(`❌ Error en pregunta "${q.questionText.substring(0, 20)}":`, 
          err.response?.data?.error || err.message);
      }
    }

    console.log('🏁 ¡Importación finalizada! El Log Pose ahora marca el camino al Quiz.');
  } catch (error) {
    console.error('💥 Error crítico al leer preguntas.json:', error.message);
  }
}

importQuiz();