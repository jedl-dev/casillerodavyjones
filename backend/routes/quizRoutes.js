const express = require('express');
const router = express.Router();
const quizController = require('../controllers/quizController');

// Línea 7: Ahora quizController.getQuizSession existe garantizado
router.get('/session', quizController.getQuizSession); 
router.get('/', quizController.getQuestions);
router.post('/', quizController.createQuestion);
router.put('/:id', quizController.updateQuestion);
router.delete('/:id', quizController.deleteQuestion);

module.exports = router;