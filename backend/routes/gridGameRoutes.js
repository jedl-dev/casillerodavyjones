const express = require('express');
const router = express.Router();
const gridGameController = require('../controllers/gridGameController');

// Ruta final: /api/grid-game/new
router.get('/new', gridGameController.getNewGame);

// Ruta final: /api/grid-game/validate
router.post('/validate', gridGameController.validateMove);

// Ruta final: /api/grid-game/solve
router.post('/solve', gridGameController.solveGame);

// Ruta final: /api/grid-game/search
router.get('/search', gridGameController.searchCharacters);

// NUEVA RUTA: /api/grid-game/check-hints
router.post('/check-hints', gridGameController.checkHints);

module.exports = router;