const mongoose = require('mongoose');

const questionSchema = new mongoose.Schema({
  questionText: { 
    type: String, 
    required: true,
    trim: true 
  },
  options: {
    type: [String],
    validate: [arrayLimit, '{PATH} debe tener exactamente 4 opciones'],
    required: true
  },
  correctAnswer: { 
    type: String, 
    required: true 
  },
  difficulty: {
    type: String,
    enum: ['Muy Fácil', 'Fácil', 'Intermedia', 'Difícil', 'Muy Difícil', 'Imposible'],
    default: 'Intermedia'
  },
  imageFile: { 
    type: String, 
    default: null // Por si la pregunta es "¿Quién es este pirata?"
  },
  category: {
    type: String,
    default: 'General'
  }
}, { timestamps: true });

function arrayLimit(val) {
  return val.length === 4;
}

module.exports = mongoose.model('Question', questionSchema);