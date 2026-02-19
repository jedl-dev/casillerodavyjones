const Character = require('../models/Character');
const { checkCriteria } = require('../utils/gridGameCriteria');
// Importamos los grupos individuales para poder comparar familias
const { 
  ALL_POOLS, 
  FACTIONS, 
  ROLES, 
  FIGHTING_STYLES, 
  TITLES, 
  MAJOR_CREWS, 
  RACES, 
  DEVIL_FRUIT_CLASSES, 
  HAKI_TYPES, 
  ORIGINS 
} = require('../utils/gameConstants');

/**
 * Identifica a qué grupo pertenece una categoría
 */
const getCategoryGroup = (category) => {
  if (FACTIONS.includes(category)) return 'FACTION';
  if (ROLES.includes(category)) return 'ROLE';
  if (FIGHTING_STYLES.includes(category)) return 'STYLE';
  if (TITLES.includes(category)) return 'TITLE';
  if (MAJOR_CREWS.includes(category)) return 'CREW';
  if (RACES.includes(category)) return 'RACE';
  if (DEVIL_FRUIT_CLASSES.includes(category)) return 'FRUIT';
  if (HAKI_TYPES.includes(category)) return 'HAKI';
  if (ORIGINS.includes(category)) return 'ORIGIN';
  return 'UNKNOWN';
};

const getRandomCategories = (pool, count) => {
  return [...pool].sort(() => 0.5 - Math.random()).slice(0, count);
};

function solveRecursively(cellIndex, gridCandidates, usedIds, solutionMap) {
  if (cellIndex === 9) return true;
  const currentCandidates = gridCandidates[cellIndex];
  for (const char of currentCandidates) {
    const charId = char._id.toString();
    if (!usedIds.has(charId)) {
      usedIds.add(charId);
      if (solutionMap) solutionMap[cellIndex] = char;
      if (solveRecursively(cellIndex + 1, gridCandidates, usedIds, solutionMap)) return true;
      usedIds.delete(charId);
      if (solutionMap) delete solutionMap[cellIndex];
    }
  }
  return false;
}

exports.createSolvableGame = async () => {
  console.log("--> ⚓ Iniciando generación inteligente y diversificada...");
  const allCharacters = await Character.find({});

  if (allCharacters.length < 9) {
    throw new Error("Se necesitan al menos 9 personajes en la base de datos.");
  }

  const populatedPool = ALL_POOLS.filter(cat => 
    allCharacters.some(c => checkCriteria(c, cat))
  );

  let attempt = 0;
  while (true) {
    attempt++;
    
    // 1. Elegimos 3 categorías para las filas
    const rows = getRandomCategories(populatedPool, 3);
    
    // Obtenemos los grupos de las filas elegidas (ej: ['HAKI', 'ROLE', 'FACTION'])
    const rowGroups = rows.map(cat => getCategoryGroup(cat));

    // 2. FILTRADO INTELIGENTE DE COLUMNAS (Con restricción de grupo)
    const compatibleCols = populatedPool.filter(colCat => {
      // Regla 1: No repetir categoría exacta
      if (rows.includes(colCat)) return false;

      // Regla 2: NO permitir que la columna sea del mismo grupo que CUALQUIERA de las filas
      // Esto evita cruces Haki vs Haki, Fruta vs Fruta, etc.
      const colGroup = getCategoryGroup(colCat);
      if (rowGroups.includes(colGroup)) return false;

      // Regla 3: Verificar intersección física (que existan personajes)
      return rows.every(rowCat => 
        allCharacters.some(char => checkCriteria(char, rowCat) && checkCriteria(char, colCat))
      );
    });

    if (compatibleCols.length < 3) {
      if (attempt % 100 === 0) console.log(`... Intento ${attempt}: Re-intentando por falta de columnas compatibles ...`);
      continue;
    }

    // 3. Elegimos 3 columnas de las compatibles (también cuidando que entre ellas no repitan grupo)
    // Ordenamos al azar y buscamos 3 de grupos diferentes
    const shuffledCols = [...compatibleCols].sort(() => 0.5 - Math.random());
    const selectedCols = [];
    const selectedColGroups = new Set();

    for (const cCat of shuffledCols) {
      const g = getCategoryGroup(cCat);
      if (!selectedColGroups.has(g)) {
        selectedCols.push(cCat);
        selectedColGroups.add(g);
      }
      if (selectedCols.length === 3) break;
    }

    if (selectedCols.length < 3) continue;

    const cols = selectedCols;

    // 4. Preparar candidatos y Backtracking
    const gridCandidates = [];
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        const matches = allCharacters.filter(char => 
          checkCriteria(char, rows[r]) && checkCriteria(char, cols[c])
        );
        gridCandidates.push(matches);
      }
    }

    const usedIds = new Set();
    if (solveRecursively(0, gridCandidates, usedIds, null)) {
      console.log(`✅ Grid diversificado generado en ${attempt} intentos.`);
      return { success: true, rows, cols, gameId: Date.now().toString() };
    }

    if (attempt > 2000) {
      throw new Error("No se pudo generar un tablero con estas restricciones de grupo. Añade más variedad de datos.");
    }
  }
};

exports.solveSpecificGrid = async (rows, cols) => {
  const allCharacters = await Character.find({});
  const gridCandidates = [];
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      gridCandidates.push(allCharacters.filter(char => 
        checkCriteria(char, rows[r]) && checkCriteria(char, cols[c])
      ));
    }
  }
  const usedIds = new Set();
  const solutionMap = {};
  if (solveRecursively(0, gridCandidates, usedIds, solutionMap)) {
    const formattedSolution = {};
    let idx = 0;
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        const char = solutionMap[idx];
        if (char) formattedSolution[`${r}-${c}`] = { ...char.toObject(), isRevealed: true };
        idx++;
      }
    }
    return formattedSolution;
  }
  return null;
};