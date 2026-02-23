export const CRITERIA_DEFINITIONS = {
  // ==========================================
  // 1. FACCIONES PRINCIPALES
  // ==========================================
  "PIRATA": (c) => c.mainFaction === "Piratas",
  "MIEMPBRO DE LA MARINA (o ex)": (c) => c.mainFaction === "Marines",
  
  // Lógica combinada: Cipher Pol cuenta como Gobierno Mundial
  "MIEMBRO DEL GOBIERNO MUNDIAL": (c) => c.mainFaction === "Gobierno Mundial" || c.mainFaction === "Cipher Pol",
  
  "MIEMBRO DEL EJÉRCITO REVOLUCIONARIO": (c) => c.mainFaction === "Ejército Revolucionario",
  

  // ==========================================
  // 2. ROLES (Nombres Clásicos)
  // ==========================================
  // --- Mando ---
  "CAPITÁN (PIRATA)": (c) => c.roles?.includes("Capitán"), 
  "VICECAPITÁN (PIRATA)": (c) => c.roles?.includes("Vicecapitán"),
  "COMANDANTE (PIRATA, TITANICO, ect)": (c) => c.roles?.some(r => r.includes("Comandante") || r.includes("Capitan Titanico")),

  // --- Tripulación Clásica ---
  "NAVEGANTE": (c) => c.roles?.includes("Navegante"),
  "MÉDICO": (c) => c.roles?.includes("Médico"),
  "MÚSICO": (c) => c.roles?.includes("Músico"),
  "TIMONEL": (c) => c.roles?.includes("Timonel"),



  // ==========================================
  // 3. ESTILOS DE PELEA (Identificados Claramente)
  // ==========================================
  "PELEADOR CUERPO A CUERPO": (c) => c.fightingStyles?.includes("Cuerpo a Cuerpo"),
  "ESPADACHÍN": (c) => c.fightingStyles?.includes("Espadachin"),
  "COMBATE CON FRUTA DEL DIABLO": (c) => c.fightingStyles?.includes("Usuario de Fruta del Diablo"),
  
  

  // ==========================================
  // 4. TÍTULOS DE PODER
  // ==========================================
  "SHICHIBUKAI": (c) => c.titles?.includes("Guerrero del Mar (Shichibukai)"),
  "SUPERNOVA": (c) => c.titles?.includes("Supernova"),
  
  // --- Marina ---
  "ALMIRANTE DE FLOTA": (c) => c.titles?.includes("Almirante de Flota"),
  "ALMIRANTE": (c) => c.titles?.includes("Almirante"),
  "VICEALMIRANTE": (c) => c.titles?.includes("Vicealmirante"),

  // ==========================================
  // 5. TRIPULACIONES MAYORES
  // ==========================================
  "MUGIWARA": (c) => c.crews?.includes("Piratas de Sombrero de Paja"),
  "PIRATAS DE BARBANEGRA": (c) => c.crews?.includes("Piratas de Barbanegra"),
  "PIRATAS DEL PELIRROJO": (c) => c.crews?.includes("Piratas del Pelirrojo"),
  "CROSS GUILD": (c) => c.crews?.includes("Cross Guild"),
  "PIRATAS DE BARBABLANCA": (c) => c.crews?.includes("Piratas de Barbablanca"),
  "PIRATAS DE LAS BESTIAS": (c) => c.crews?.includes("Piratas de las Bestias"),
  "PIRATAS DE BIG MOM": (c) => c.crews?.includes("Piratas de Big Mom"),
  "PIRATAS DE ROGER": (c) => c.crews?.includes("Piratas de Roger"),
  "PIRATAS DONQUIXOTE": (c) => c.crews?.includes("Piratas de Donquixote"),
  "BAROQUE WORKS": (c) => c.crews?.includes("Baroque Works"),
  "PIRATAS DE HEART": (c) => c.crews?.includes("Piratas de Heart"),
  "PIRATAS DE KID": (c) => c.crews?.includes("Piratas de Kid"),
  "THRILLER BARK": (c) => c.crews?.includes("Piratas de Thriller Bark"),
  "PIRATAS ROCKS": (c) => c.crews?.includes("Piratas de Rocks"),
  "PIRATAS KUJA": (c) => c.crews?.includes("Piratas de Kuja"),

  // ==========================================
  // 6. RAZAS COMUNES
  // ==========================================
  "RAZA: HUMANO": (c) => c.race === "Humano",
  "RAZA: GYOJIN": (c) => c.race === "Gyojin",
  "RAZA: MINK": (c) => c.race === "Mink",
  "RAZA: GIGANTE": (c) => c.race === "Gigante",
  "RAZA: LUNARIAN": (c) => c.race === "Lunarian", 

  // ==========================================
  // 7. FRUTAS DEL DIABLO (Zoan Unificada)
  // ==========================================
  "USUARIO DE FRUTA (CUALQUIER TIPO)": (c) => c.devilFruit && c.devilFruit.hasFruit,
  "USUARIO PARAMECIA": (c) => c.devilFruit?.class === "Paramecia",
  "USUARIO LOGIA": (c) => c.devilFruit?.class === "Logia",
  
  // Esto busca "Zoan" en cualquier parte del nombre (Zoan, Zoan Antigua, Zoan Mitológica)
  "USUARIO ZOAN (CUALQUIERA)": (c) => c.devilFruit?.class?.includes("Zoan"),

// ==========================================
  // 8. HAKI
  // ==========================================
  // Al usar .includes(), detecta tanto "(Básico)" como "(Avanzado)" automáticamente
  "HAKI: ARMAMENTO": (c) => c.hakiAbilities?.some(h => h.includes("Armamento")),
  "HAKI: OBSERVACIÓN": (c) => c.hakiAbilities?.some(h => h.includes("Observación")),
  "HAKI: CONQUISTADOR": (c) => c.hakiAbilities?.some(h => h.includes("Conquistador")),

  // NUEVO: Detecta si el personaje tiene AL MENOS UN tipo de Haki en su lista
  "USUARIO DE HAKI (CUALQUIERA)": (c) => c.hakiAbilities && c.hakiAbilities.length > 0,

  // ==========================================
  // 9. ORIGEN
  // ==========================================
  "PROVENIENTE DEL EAST BLUE": (c) => c.origin === "East Blue",
  "PROVENIENTE DEL WEST BLUE": (c) => c.origin === "West Blue",
  "PROVENIENTE DEL NORTH BLUE": (c) => c.origin === "North Blue",
  "PROVENIENTE DEL SOUTH BLUE": (c) => c.origin === "South Blue",
  "PROVENIENTE DEL GRAND LINE": (c) => c.origin === "Grand Line (Paraíso)",
  "PROVENIENTE DEL NUEVO MUNDO": (c) => c.origin === "Nuevo Mundo",
  "PROVENIENTE DE UNA ISLA DEL CIELO": (c) => c.origin === "Isla del Cielo",
  "PROVENIENTE DE LA ISLA GYOJIN": (c) => c.origin === "Bajo el Mar",
  
  // ==========================================
  // 10. EXTRAS
  // ==========================================
  "ESTATUS: MUERTO": (c) => c.status === "Deceased",
};