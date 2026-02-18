// backend/utils/gameConstants.js

const FACTIONS = [
  "Pirata",
  "Marine",
  "Gobierno Mundial",
  "Ejército Revolucionario"
];

const ROLES = [
  "Capitán (Pirata)",
  "Vicecapitán (Pirata)",
  "Comandante (Pirata)", 
  "Navegante", 
  "Médico", 
  "Timonel",
  "Músico",
  "Científico", 
  "Arqueólogo / Erudito"
];

const FIGHTING_STYLES = [
  "Cuerpo a Cuerpo",
  
  "Espadachin"
];

const TITLES = [
  "Gorosei", 
  "Caballeros Sagrados",
  "Guerrero del Mar (Shichibukai)", 
  "Supernova", 
  "Almirante",
  "Vicealmirante"
];

const MAJOR_CREWS = [
  "Piratas de Sombrero de Paja", 
  "Piratas del Pelirrojo", 
  "Piratas de Barbanegra", 
  "Cross Guild", 
  "Piratas de Barbablanca", 
  "Piratas de las Bestias", 
  "Piratas de Big Mom", 
  "Piratas de Roger", 
  "Piratas de Rocks", 
  "Piratas de Heart",       
  "Piratas de Kid",         
  "Piratas Donquixote",  
  "Baroque Works",          
  "Piratas de Thriller Bark", 
  "Piratas de Kuja"
];

const RACES = [
  "Humano", 
  "Gyojin",             
  "Mink", 
  "Gigante", 
  "Lunarian"
];

const DEVIL_FRUIT_CLASSES = [
  "Paramecia",          
  "Zoan",               
  "Logia",               
  "Zoan Mitológica",    
  "Zoan Prehistorica"     
];

const HAKI_TYPES = [
  "Haki de Armamento (Básico)",      
  "Haki de Armamento (Avanzado)",
  "Haki de Armamento (Cualquiera)",
  "Haki de Observación (Básico)", 
  "Haki de Observación (Avanzado)",
  "Haki de Observación (Cualquiera)",
  "Haki del Conquistador (Básico)", 
  "Haki del Conquistador (Avanzado)",
  "Haki del Conquistador (Cualquiera)",
  "Usuario de Haki"
];

const ORIGINS = [
  "Proviene del East Blue", 
  "Proviene del West Blue", 
  "Proviene del North Blue", 
  "Proviene del South Blue",
  "Proviene del Grand Line (Paraíso)", 
  "Proviene del Nuevo Mundo", 
  "De Alguna Isla del Cielo", 
  "De Isla Gyojin"
];

const ALL_POOLS = [
  ...FACTIONS,
  ...ROLES,
  ...FIGHTING_STYLES,
  ...TITLES,
  ...MAJOR_CREWS,
  ...RACES,
  ...DEVIL_FRUIT_CLASSES,
  ...HAKI_TYPES,
  ...ORIGINS
];

module.exports = {
  FACTIONS,
  ROLES,
  FIGHTING_STYLES,
  TITLES,
  MAJOR_CREWS,
  RACES,
  DEVIL_FRUIT_CLASSES,
  HAKI_TYPES,
  ORIGINS,
  ALL_POOLS
};