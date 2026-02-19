const Character = require('../models/Character');
const gridGameService = require('../services/gridGameService');
const { checkCriteria } = require('../utils/gridGameCriteria');

// --- 1. NUEVO JUEGO ---
exports.getNewGame = async (req, res) => {
  try {
    const gameData = await gridGameService.createSolvableGame();
    res.json(gameData);
  } catch (error) {
    console.error("Error generando Grid:", error);
    res.status(500).json({ success: false, message: "Error interno al generar el juego." });
  }
};

// --- 2. VALIDAR MOVIMIENTO ---
exports.validateMove = async (req, res) => {
  const { characterId, rowCategory, colCategory } = req.body;
  
  try {
    const char = await Character.findById(characterId);
    
    if (!char) {
      return res.status(404).json({ correct: false, message: "Personaje no encontrado" });
    }

    const validRow = checkCriteria(char, rowCategory);
    const validCol = checkCriteria(char, colCategory);

    if (validRow && validCol) {
      res.json({ correct: true });
    } else {
      res.json({ correct: false });
    }
  } catch (error) {
    console.error("Error validando movimiento:", error);
    res.status(500).json({ correct: false, error: "Error de servidor" });
  }
};

// --- 3. RENDIRSE (OBTENER SOLUCIÓN) ---
exports.solveGame = async (req, res) => {
  const { rows, cols } = req.body;
  try {
    const solution = await gridGameService.solveSpecificGrid(rows, cols);
    
    if (solution) {
      res.json({ success: true, solution });
    } else {
      res.json({ success: false, message: "No se encontró solución para este tablero (¿Bug?)" });
    }
  } catch (error) {
    console.error("Error resolviendo:", error);
    res.status(500).json({ success: false, error: "Error de servidor" });
  }
};

// --- 4. BUSCADOR DE PERSONAJES ---
exports.searchCharacters = async (req, res) => {
  const query = req.query.q;
  if (!query) return res.json({ data: [] });

  try {
    const chars = await Character.find({
      $or: [
        { name: { $regex: query, $options: 'i' } },
        { epithet: { $regex: query, $options: 'i' } }
      ]
    })
    .limit(10)
    .select('name imageFile epithet');

    res.json({ data: chars });
  } catch (error) {
    console.error("Error buscando:", error);
    res.status(500).json({ error: "Error de servidor" });
  }
};

// --- 5. AYUDA VISUAL (CHECK HINTS) ---
exports.checkHints = async (req, res) => {
  const { characterId, rows, cols } = req.body;

  try {
    const char = await Character.findById(characterId);
    if (!char) {
      return res.status(404).json({ success: false, message: "Personaje no encontrado" });
    }

    // Generamos un mapa de coordenadas r-c donde el personaje es válido
    const hints = {};
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        const isValid = checkCriteria(char, rows[r]) && checkCriteria(char, cols[c]);
        if (isValid) {
          hints[`${r}-${c}`] = true;
        }
      }
    }

    res.json({ success: true, hints });
  } catch (error) {
    console.error("Error en checkHints:", error);
    res.status(500).json({ success: false, error: "Error de servidor" });
  }
};