const express = require('express');
const router = express.Router();

// Importamos el objeto que contiene toda la lógica de los personajes
// La ruta asume que estás en la carpeta /routes y el controlador en /controllers
const charCtrl = require('../controllers/characterController');

// --- RUTAS DE COLECCIÓN (Base: /api/characters) ---

// 1. OBTENER TODOS: Lista completa para tu Galería/Visor
router.get('/', charCtrl.getCharacters);

// 2. CREAR NUEVO: Registro inicial del pirata
router.post('/', charCtrl.createCharacter);


// --- RUTAS DE DOCUMENTO ÚNICO (Identificado por slug) ---

// 3. OBTENER UNO: Para ver detalles específicos de un pirata
// ESTA ES LA LÍNEA 10: Asegúrate de que charCtrl.getCharacterBySlug sea una función válida
router.get('/:slug', charCtrl.getCharacterBySlug);

// 4. ACTUALIZAR: La lógica que usaremos para tu componente "EditData"
router.put('/:slug', charCtrl.updateCharacter);

// 5. ELIMINAR: Borrado definitivo del registro
router.delete('/:slug', charCtrl.deleteCharacter);

module.exports = router;