const express = require('express');
const router = express.Router();
const quizController = require('../controllers/quizController');

// 1. LAS RUTAS DINÁMICAS O ESPECÍFICAS PRIMERO
router.get('/session', quizController.getQuizSession); // <--- ESTA DEBE IR ARRIBA
router.get('/random', quizController.getRandomQuestions);

// 2. LAS RUTAS DE CRUD GENERAL
router.get('/', quizController.getQuestions);
router.post('/', quizController.createQuestion);

// 3. LAS RUTAS CON PARÁMETROS AL FINAL
router.put('/:id', quizController.updateQuestion);
router.delete('/:id', quizController.deleteQuestion);

module.exports = router;