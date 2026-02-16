export const CRITERIA_DEFINITIONS = {
  // ==========================================
  // 1. FACCIONES (FACTIONS)
  // ==========================================
  "FACCIÓN: PIRATA": (c) => c.mainFaction === "Piratas",
  "FACCIÓN: MARINE": (c) => c.mainFaction === "Marines",
  "FACCIÓN: GOBIERNO MUNDIAL": (c) => c.mainFaction === "Gobierno Mundial",
  "FACCIÓN: EJÉRCITO REVOLUCIONARIO": (c) => c.mainFaction === "Ejército Revolucionario",
  "FACCIÓN: CIVIL": (c) => c.mainFaction === "Civiles",
  "FACCIÓN: CAZADOR DE RECOMPENSAS": (c) => c.mainFaction === "Cazadores de Recompensas",
  "FACCIÓN: BAJO MUNDO": (c) => c.mainFaction === "Bajo Mundo",
  "CIPHER POL": (c) => c.crews?.some(cr => cr.includes("Cipher Pol") || cr.includes("CP0") || cr.includes("CP9")),
  "GUARDIA DEL REINO": (c) => c.mainFaction === "Guardia del Reino",
  "TRIBU GUERRERA": (c) => c.mainFaction?.includes("Tribus Guerreras"),

  // ==========================================
  // 2. ROLES (ROLES)
  // ==========================================
  // --- Mando ---
  "CAPITÁN": (c) => c.roles?.some(r => r === "Capitán"),
  "VICECAPITÁN": (c) => c.roles?.some(r => r === "Vicecapitán"),
  "PRIMER OFICIAL": (c) => c.roles?.some(r => r === "Primer Oficial"),
  "COMANDANTE DE DIVISIÓN": (c) => c.roles?.some(r => r === "Comandante de División"),
  "CAPITÁN TITÁNICO": (c) => c.roles?.some(r => r === "Capitan Titanico"),

  // --- Esenciales ---
  "NAVEGANTE": (c) => c.roles?.includes("Navegante"),
  "COCINERO": (c) => c.roles?.includes("Cocinero"),
  "MÉDICO": (c) => c.roles?.includes("Médico"),
  "CARPINTERO": (c) => c.roles?.includes("Carpintero"),
  "TIMONEL": (c) => c.roles?.includes("Timonel"),
  "MÚSICO": (c) => c.roles?.includes("Músico"),
  "COMBATIENTE": (c) => c.roles?.includes("Combatiente"),

  // --- Operativos ---
  "FRANCOTIRADOR": (c) => c.roles?.includes("Francotirador"),
  "ESPADACHÍN (ROL)": (c) => c.roles?.includes("Espadachin"), // Ojo: Rol vs Estilo
  "VIGÍA": (c) => c.roles?.includes("Vigía"),
  "ARTILLERO": (c) => c.roles?.includes("Artillero"),
  "EXPLORADOR": (c) => c.roles?.includes("Explorador"),
  "VANGUARDIA": (c) => c.roles?.includes("Vanguardia"),
  "GUARDIA": (c) => c.roles?.includes("Guardia"),

  // --- Especialistas ---
  "CIENTÍFICO": (c) => c.roles?.includes("Científico"),
  "ARQUEÓLOGO / ERUDITO": (c) => c.roles?.some(r => r === "Arqueólogo" || r === "Erudito"),
  "HERRERO": (c) => c.roles?.includes("Herrero"),
  "INFILTRADO / ESPÍA": (c) => c.roles?.some(r => r === "Infiltrado" || r === "Espía"),
  "INTERROGADOR": (c) => c.roles?.includes("Interrogador"),
  "SASTRE": (c) => c.roles?.includes("Sastre"),
  "CRONISTA": (c) => c.roles?.includes("Cronista"),
  "APRENDIZ": (c) => c.roles?.includes("Aprendiz"),
  "MASCOTA": (c) => c.roles?.includes("Mascota"),

  // ==========================================
  // 3. ESTILOS DE PELEA (FIGHTING_STYLES)
  // ==========================================
  "ESTILO: CUERPO A CUERPO": (c) => c.fightingStyles?.includes("Cuerpo a Cuerpo"),
  "ESTILO: ESPADACHÍN": (c) => c.fightingStyles?.includes("Espadachin"),
  "ESTILO: FRUTA DEL DIABLO": (c) => c.fightingStyles?.includes("Usuario de Fruta del Diablo"),
  "ESTILO: TIRADOR": (c) => c.fightingStyles?.includes("Tirador"),
  "ESTILO: HAKI": (c) => c.fightingStyles?.includes("Usuario de Haki"),
  "ESTILO: RACIAL": (c) => c.fightingStyles?.includes("Estilo Racial"), // Incluye Gyojin Karate si así lo registraste
  "ESTILO: TÉCNICO": (c) => c.fightingStyles?.includes("Técnico"),

  // ==========================================
  // 4. TÍTULOS Y RANGOS (TITLES)
  // ==========================================
  // --- Cúspide ---
  "GOROSEI": (c) => c.titles?.includes("Gorosei"),
  "DIOS GUERRERO": (c) => c.titles?.includes("Dios Guerrero"),
  "DRAGÓN CELESTIAL": (c) => c.titles?.includes("Dragón Celestial"),
  "CABALLEROS SAGRADOS": (c) => c.titles?.includes("Caballeros Sagrados"),
  
  // --- Piratería ---
  "REY DE LOS PIRATAS": (c) => c.titles?.includes("Rey de los Piratas"),
  "YONKO": (c) => c.titles?.includes("Yonko"),
  "SHICHIBUKAI": (c) => c.titles?.some(t => t.includes("Guerrero del Mar") || t.includes("Shichibukai")),
  "PEOR GENERACIÓN": (c) => c.titles?.includes("La Peor Generación"),
  "SUPERNOVA": (c) => c.titles?.includes("Supernova"),

  // --- Marina (Alto Mando) ---
  "COMANDANTE EN JEFE": (c) => c.titles?.includes("Comandante en Jefe"),
  "ALMIRANTE DE FLOTA": (c) => c.titles?.includes("Almirante de Flota"),
  "ALMIRANTE": (c) => c.titles?.some(t => t === "Almirante"), // Exacto para no confundir con Flota
  "VICEALMIRANTE": (c) => c.titles?.includes("Vicealmirante"),
  "CONTRAALMIRANTE": (c) => c.titles?.includes("Contraalmirante"),
  "COMODORO": (c) => c.titles?.includes("Comodoro"),

  // --- Marina (Oficiales) ---
  "CAPITÁN DE NAVÍO": (c) => c.titles?.includes("Capitán de Navío"),
  "COMANDANTE (MARINA)": (c) => c.titles?.some(t => t === "Comandante"), // Distinguir de comandante pirata por contexto si es necesario, o asumir overlap
  "TENIENTE COMANDANTE": (c) => c.titles?.includes("Teniente Comandante"),
  "TENIENTE": (c) => c.titles?.some(t => t === "Teniente"),
  "TENIENTE GRADO MENOR": (c) => c.titles?.includes("Teniente de Grado Menor"),
  "ALFÉREZ": (c) => c.titles?.includes("Alférez"),

  // --- Marina (Tropas) ---
  "SUBOFICIAL MAYOR": (c) => c.titles?.includes("Suboficial Mayor"),
  "SUBOFICIAL JEFE": (c) => c.titles?.includes("Suboficial Jefe"),
  "SUBOFICIAL": (c) => c.titles?.some(t => t === "Suboficial"),
  "MARINERO 1RA": (c) => c.titles?.includes("Marinero de Primera"),
  "MARINERO APRENDIZ": (c) => c.titles?.includes("Marinero Aprendiz"),

  // --- Otros ---
  "COMANDANTE SUPREMO": (c) => c.titles?.includes("Comandante Supremo"),
  "JEFE DE PERSONAL": (c) => c.titles?.includes("Jefe de Personal"),
  "COMANDANTE DE EJÉRCITO": (c) => c.titles?.includes("Comandante de Ejército"),
  "EMPERADOR BAJO MUNDO": (c) => c.titles?.includes("Emperador del Bajo Mundo"),
  "INSPECTOR GENERAL": (c) => c.titles?.includes("Inspector General"),
  "INSTRUCTOR": (c) => c.titles?.includes("Instructor"),
  "OFICIAL TÉCNICO": (c) => c.titles?.includes("Oficial Técnico"),
  "AGENTE CP0": (c) => c.titles?.includes("Agente Enmascarado del CP0"),

  // ==========================================
  // 5. TRIPULACIONES (MAJOR_CREWS)
  // ==========================================
  "MUGIWARA": (c) => c.crews?.includes("Piratas de Sombrero de Paja"),
  "PIRATAS DEL PELIRROJO": (c) => c.crews?.includes("Piratas del Pelirrojo"),
  "PIRATAS DE BARBANEGRA": (c) => c.crews?.includes("Piratas de Barbanegra"),
  "CROSS GUILD": (c) => c.crews?.includes("Cross Guild"),
  "PIRATAS DE BARBABLANCA": (c) => c.crews?.includes("Piratas de Barbablanca"),
  "PIRATAS DE LAS BESTIAS": (c) => c.crews?.includes("Piratas de las Bestias"),
  "PIRATAS DE BIG MOM": (c) => c.crews?.includes("Piratas de Big Mom"),
  "PIRATAS DE ROGER": (c) => c.crews?.includes("Piratas de Roger"),
  "PIRATAS DE ROCKS": (c) => c.crews?.includes("Piratas de Rocks"),
  "PIRATAS DE HEART": (c) => c.crews?.includes("Piratas de Heart"),
  "PIRATAS DE KID": (c) => c.crews?.includes("Piratas de Kid"),
  "PIRATAS DONQUIXOTE": (c) => c.crews?.includes("Piratas de Donquixote"),
  "BAROQUE WORKS": (c) => c.crews?.includes("Baroque Works"),
  "THRILLER BARK": (c) => c.crews?.includes("Piratas de Thriller Bark"),
  "FIRE TANK": (c) => c.crews?.includes("Piratas de Fire Tank"),
  "PIRATAS DE BONNEY": (c) => c.crews?.includes("Piratas de Bonney"),
  "BARTO CLUB": (c) => c.crews?.includes("Barto Club"),
  "PIRATAS DE BEAUTIFUL": (c) => c.crews?.includes("Piratas de Beautiful"),
  "ARMADA HAPPO": (c) => c.crews?.includes("Armada Happo"),
  "PIRATAS TONTATTA": (c) => c.crews?.includes("Piratas de Tontatta"),
  "NUEVOS GIGANTES": (c) => c.crews?.includes("Nuevos Piratas Gigantes"),
  "PIRATAS DEL SOL": (c) => c.crews?.includes("Piratas del Sol"),
  "PIRATAS KUJA": (c) => c.crews?.includes("Piratas de Kuja"),
  "PIRATAS DRAKE": (c) => c.crews?.includes("Piratas de Drake"),
  "PIRATAS HAWKINS": (c) => c.crews?.includes("Piratas de Hawkins"),
  "MONJES CAÍDOS": (c) => c.crews?.includes("Piratas de los Monjes Caídos"),
  "PIRATAS ON-AIR": (c) => c.crews?.includes("Piratas On-Air"),
  "PIRATAS CARIBOU": (c) => c.crews?.includes("Piratas de Caribou"),
  "LEÓN DORADO": (c) => c.crews?.includes("Piratas del León Dorado"),
  "GUERREROS GIGANTES": (c) => c.crews?.includes("Piratas Guerreros Gigantes"),
  "PIRATAS SPADE": (c) => c.crews?.includes("Piratas de Spade"),
  "PIRATAS NOX": (c) => c.crews?.includes("Piratas de Nox"),
  "PIRATAS RUMBAR": (c) => c.crews?.includes("Piratas Rumbar"),
  "PIRATAS ARLONG": (c) => c.crews?.includes("Piratas de Arlong"),
  "PIRATAS BUGGY": (c) => c.crews?.includes("Piratas de Buggy"),
  "PIRATAS KRIEG": (c) => c.crews?.includes("Piratas de Krieg"),
  "GATO NEGRO": (c) => c.crews?.includes("Piratas del Gato Negro"),
  "PIRATAS BELLAMY": (c) => c.crews?.includes("Piratas de Bellamy"),
  "PIRATAS FOXY": (c) => c.crews?.includes("Piratas de Foxy"),
  "PIRATAS WAPOL": (c) => c.crews?.includes("Piratas de Wapol"),
  "PIRATAS ALVIDA": (c) => c.crews?.includes("Piratas de Alvida"),
  "PIRATAS BLUEJAM": (c) => c.crews?.includes("Piratas de Bluejam"),
  "BARBAMARRÓN": (c) => c.crews?.includes("Piratas de Barbamarrón"),
  "BARBAMELOCOTÓN": (c) => c.crews?.includes("Piratas de Barbamelocotón"),
  "PIRATAS MACRO": (c) => c.crews?.includes("Piratas de Macro"),
  "PIRATAS COCINEROS": (c) => c.crews?.includes("Piratas Cocineros"),
  "PIRATAS ESPACIALES": (c) => c.crews?.includes("Piratas Espaciales"),
  "FLOTA YONTA MARIA": (c) => c.crews?.includes("Flota Yonta Maria"),
  "GIMNASIO XXX": (c) => c.crews?.includes("Alianza de Artes Marciales del Gimnasio XXX"),

  // ==========================================
  // 6. RAZAS (RACES)
  // ==========================================
  "RAZA: HUMANO": (c) => c.race === "Humano",
  "RAZA: GYOJIN": (c) => c.race === "Gyojin",
  "RAZA: TRITÓN/SIRENA": (c) => c.race === "Tritón/Sirena",
  "RAZA: MINK": (c) => c.race === "Mink",
  "RAZA: GIGANTE": (c) => c.race === "Gigante",
  "RAZA: CYBORG": (c) => c.race === "Cyborg",
  "RAZA: HUMANO MODIFICADO": (c) => c.race === "Humano Modificado",
  "RAZA: LUNARIAN": (c) => c.race === "Lunarian",
  "RAZA: BUCANERO": (c) => c.race === "Bucanero",
  "RAZA: ONI": (c) => c.race === "Oni",
  "RAZA: TRES OJOS": (c) => c.race === "Tribu de Tres Ojos",
  "RAZA: GIGANTE ANCESTRAL": (c) => c.race === "Gigante Ancestral",
  "RAZA: ENANO (TONTATTA)": (c) => c.race === "Enano (Tontatta)",
  "RAZA: BRAZOS LARGOS": (c) => c.race === "Brazos Largos",
  "RAZA: PIERNAS LARGAS": (c) => c.race === "Piernas Largas",
  "RAZA: CUELLOS LARGOS": (c) => c.race === "Cuellos Largos",
  "RAZA: WOTAN": (c) => c.race === "Wotan",
  "RAZA: SKYPIEANO": (c) => c.race === "Skypieano",
  "RAZA: SHANDIA": (c) => c.race === "Shandia",
  "RAZA: BIRKANO": (c) => c.race === "Birkano / Birka",
  "RAZA: AUTÓMATA": (c) => c.race === "Autómata",

  // ==========================================
  // 7. FRUTAS DEL DIABLO (DEVIL_FRUIT_CLASSES)
  // ==========================================
  "USUARIO DE FRUTA": (c) => c.devilFruit && c.devilFruit.hasFruit,
  "CLASE: PARAMECIA": (c) => c.devilFruit?.class === "Paramecia",
  "CLASE: ZOAN": (c) => c.devilFruit?.class === "Zoan",
  "CLASE: LOGIA": (c) => c.devilFruit?.class === "Logia",
  "CLASE: ZOAN ANTIGUA": (c) => c.devilFruit?.class === "Zoan Antigua",
  "CLASE: ZOAN MITOLÓGICA": (c) => c.devilFruit?.class === "Zoan Mitológica",
  "CLASE: PARAMECIA ESPECIAL": (c) => c.devilFruit?.class === "Paramecia Especial",
  "CLASE: SMILE": (c) => c.devilFruit?.class === "Zoan Artificial (SMILE)",
  "CLASE: DESCONOCIDA/YOKAI": (c) => c.devilFruit?.class === "Clase Desconocida / Yokai",

  // ==========================================
  // 8. HAKI (HAKI_TYPES)
  // ==========================================
  "HAKI: ARMAMENTO (BÁSICO)": (c) => c.hakiAbilities?.includes("Haki de Armamento (Básico)"),
  "HAKI: OBSERVACIÓN (BÁSICO)": (c) => c.hakiAbilities?.includes("Haki de Observación (Básico)"),
  "HAKI: ARMAMENTO (AVANZADO)": (c) => c.hakiAbilities?.includes("Haki de Armamento (Avanzado)"),
  "HAKI: OBSERVACIÓN (AVANZADO)": (c) => c.hakiAbilities?.includes("Haki de Observación (Avanzado)"),
  "HAKI: CONQUISTADOR (BÁSICO)": (c) => c.hakiAbilities?.includes("Haki del Conquistador (Básico)"),
  "HAKI: CONQUISTADOR (AVANZADO)": (c) => c.hakiAbilities?.includes("Haki del Conquistador (Avanzado)"),
  // Genéricos para facilitar el juego si no tienes tantos datos específicos
  "HAKI: ARMAMENTO (CUALQUIERA)": (c) => c.hakiAbilities?.some(h => h.includes("Armamento")),
  "HAKI: OBSERVACIÓN (CUALQUIERA)": (c) => c.hakiAbilities?.some(h => h.includes("Observación")),
  "HAKI: CONQUISTADOR (CUALQUIERA)": (c) => c.hakiAbilities?.some(h => h.includes("Conquistador")),


  // ==========================================
  // 9. ORIGEN (ORIGINS)
  // ==========================================
  "ORIGEN: EAST BLUE": (c) => c.origin === "East Blue",
  "ORIGEN: WEST BLUE": (c) => c.origin === "West Blue",
  "ORIGEN: NORTH BLUE": (c) => c.origin === "North Blue",
  "ORIGEN: SOUTH BLUE": (c) => c.origin === "South Blue",
  "ORIGEN: GRAND LINE (PARAÍSO)": (c) => c.origin === "Grand Line (Paraíso)",
  "ORIGEN: NUEVO MUNDO": (c) => c.origin === "Nuevo Mundo",
  "ORIGEN: RED LINE": (c) => c.origin === "Red Line",
  "ORIGEN: CALM BELT": (c) => c.origin === "Calm Belt",
  "ORIGEN: ISLA DEL CIELO": (c) => c.origin === "Isla del Cielo",
  "ORIGEN: BAJO EL MAR": (c) => c.origin === "Bajo el Mar",
  "ORIGEN: LA LUNA": (c) => c.origin === "La Luna",
  "ORIGEN: DESCONOCIDO": (c) => c.origin === "Desconocido / N/A",

  // ==========================================
  // 10. ESTATUS
  // ==========================================
  "ESTATUS: MUERTO": (c) => c.status === "Deceased",
};