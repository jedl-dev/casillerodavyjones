// backend/utils/gridGameCriteria.js
const { ALL_POOLS } = require('./gameConstants');

/**
 * Verifica si un personaje cumple con una categoría específica.
 */
const checkCriteria = (char, category) => {
  if (!char || !category) return false;

  switch (category) {
    // ==========================================
    // 1. FACCIONES
    // ==========================================
    case "Pirata": 
      return char.mainFaction === "Piratas";

    case "Marine": 
      return char.mainFaction === "Marines" || char.mainFaction === "Marine";

    case "Gobierno Mundial": 
      // Ahora incluye a los miembros del Gobierno y a los agentes del Cipher Pol
      return char.mainFaction === "Gobierno Mundial" || char.mainFaction === "Cipher Pol";

    case "Ejército Revolucionario": 
      return char.mainFaction === "Ejército Revolucionario";

    // ==========================================
    // 2. ROLES (Nombres actualizados)
    // ==========================================
    case "Capitán (Pirata)": return char.roles?.includes("Capitán");
    case "Vicecapitán (Pirata)": return char.roles?.includes("Vicecapitán");
    case "Comandante (Pirata)": return char.roles?.some(r => r.includes("Comandante"));
    case "Navegante": return char.roles?.includes("Navegante");
    case "Médico": return char.roles?.includes("Médico");
    case "Timonel": return char.roles?.includes("Timonel");
    case "Músico": return char.roles?.includes("Músico");
    case "Científico": return char.roles?.includes("Científico");
    case "Arqueólogo / Erudito": return char.roles?.includes("Arqueólogo") || char.roles?.includes("Erudito");

    // ==========================================
    // 3. ESTILOS DE PELEA
    // ==========================================
    case "Cuerpo a Cuerpo": return char.fightingStyles?.includes("Cuerpo a Cuerpo");
    case "Espadachin": return char.fightingStyles?.includes("Espadachin");

    // ==========================================
    // 4. TÍTULOS
    // ==========================================
    case "Guerrero del Mar (Shichibukai)": return char.titles?.includes("Guerrero del Mar (Shichibukai)");
    case "Supernova": return char.titles?.includes("Supernova");
    case "Almirante": return char.titles?.includes("Almirante");
    case "Vicealmirante": return char.titles?.includes("Vicealmirante");
    case "Gorosei": return char.titles?.includes("Gorosei");
    case "Caballeros Sagrados": return char.titles?.includes("Caballeros Sagrados");

    // ==========================================
    // 5. TRIPULACIONES
    // ==========================================
    case "Piratas de Sombrero de Paja": return char.crews?.includes("Piratas de Sombrero de Paja");
    case "Piratas del Pelirrojo": return char.crews?.includes("Piratas del Pelirrojo");
    case "Piratas de Barbanegra": return char.crews?.includes("Piratas de Barbanegra");
    case "Cross Guild": return char.crews?.includes("Cross Guild");
    case "Piratas de Barbablanca": return char.crews?.includes("Piratas de Barbablanca");
    case "Piratas de las Bestias": return char.crews?.includes("Piratas de las Bestias");
    case "Piratas de Big Mom": return char.crews?.includes("Piratas de Big Mom");
    case "Piratas de Roger": return char.crews?.includes("Piratas de Roger");
    case "Piratas de Rocks": return char.crews?.includes("Piratas de Rocks");
    case "Piratas de Heart": return char.crews?.includes("Piratas de Heart");
    case "Piratas de Kid": return char.crews?.includes("Piratas de Kid");
    case "Piratas Donquixote": return char.crews?.includes("Piratas Donquixote");
    case "Baroque Works": return char.crews?.includes("Baroque Works");
    case "Piratas de Thriller Bark": return char.crews?.includes("Piratas de Thriller Bark");
    case "Piratas de Kuja": return char.crews?.includes("Piratas de Kuja");

    // ==========================================
    // 6. RAZAS
    // ==========================================
    case "Humano": return char.race === "Humano";
    case "Gyojin": return char.race === "Gyojin";
    case "Mink": return char.race === "Mink";
    case "Gigante": return char.race === "Gigante" || char.race === "Gigante Ancestral";
    case "Lunarian": return char.race === "Lunarian";

    // ==========================================
    // 7. FRUTAS DEL DIABLO
    // ==========================================
    case "Paramecia": return char.devilFruit?.class?.includes("Paramecia");
    case "Zoan": return char.devilFruit?.class?.includes("Zoan"); 
    case "Logia": return char.devilFruit?.class === "Logia";
    case "Zoan Mitológica": return char.devilFruit?.class === "Zoan Mitológica";
    case "Zoan Prehistorica": return char.devilFruit?.class?.includes("Prehistórica") || char.devilFruit?.class?.includes("Prehistorica");
    
    // ==========================================
    // 8. HAKI
    // ==========================================
    case "Haki de Armamento (Básico)": return char.hakiAbilities?.includes("Haki de Armamento (Básico)");
    case "Haki de Armamento (Avanzado)": return char.hakiAbilities?.includes("Haki de Armamento (Avanzado)");
    case "Haki de Armamento (Cualquiera)": return char.hakiAbilities?.some(h => h.includes("Armamento"));

    case "Haki de Observación (Básico)": return char.hakiAbilities?.includes("Haki de Observación (Básico)");
    case "Haki de Observación (Avanzado)": return char.hakiAbilities?.includes("Haki de Observación (Avanzado)");
    case "Haki de Observación (Cualquiera)": return char.hakiAbilities?.some(h => h.includes("Observación"));

    case "Haki del Conquistador (Básico)": return char.hakiAbilities?.includes("Haki del Conquistador (Básico)");
    case "Haki del Conquistador (Avanzado)": return char.hakiAbilities?.includes("Haki del Conquistador (Avanzado)");
    case "Haki del Conquistador (Cualquiera)": return char.hakiAbilities?.some(h => h.includes("Conquistador"));

    case "Usuario de Haki": return char.hakiAbilities && char.hakiAbilities.length > 0;

    // ==========================================
    // 9. ORIGEN (Nombres actualizados)
    // ==========================================
    case "Proviene del East Blue": return char.origin === "East Blue";
    case "Proviene del West Blue": return char.origin === "West Blue";
    case "Proviene del North Blue": return char.origin === "North Blue";
    case "Proviene del South Blue": return char.origin === "South Blue";
    case "Proviene del Grand Line (Paraíso)": return char.origin === "Grand Line (Paraíso)";
    case "Proviene del Nuevo Mundo": return char.origin === "Nuevo Mundo";
    case "De Alguna Isla del Cielo": return char.origin === "Isla del Cielo" || char.origin === "Skypiea";
    case "De Isla Gyojin": return char.origin === "Bajo el Mar" || char.origin === "Isla Gyojin";

    default:
      console.warn(`⚠️ Categoría no reconocida en el switch: [${category}]`);
      return false;
  }
};

module.exports = { checkCriteria, ALL_POOLS };