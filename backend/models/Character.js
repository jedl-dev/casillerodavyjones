const mongoose = require('mongoose');

const characterSchema = new mongoose.Schema({
  name: { type: String, required: true },
  slug: { type: String, slug: "name" },
  epithet: { type: String, default: '' },
  imageFile: { type: String, default: 'default.png' },
  bounty: { type: Number, default: 0 },
  stars: { type: Number, default: 0 },
  crowns: { type: Number, default: 0 },
  hasNoBounty: { type: Boolean, default: false },
  status: { type: String, default: 'Alive' },
  origin: { type: String, default: '' },
  mainFaction: { type: String, required: true },
  // Estos son arreglos (Arrays)
  roles: [String],
  titles: [String],
  crews: [String],
  races: [String],
  fightingStyles: [String],
  hakiAbilities: [String],
  devilFruit: {
    hasFruit: { type: Boolean, default: false },
    name: { type: String, default: '' },
    class: { type: String, default: '' },
    awakened: { type: Boolean, default: false }
  }
}, { timestamps: true });

// ✅ Único índice permitido: El slug (que es un String, no un Array)
characterSchema.index({ slug: 1 }); 

// ❌ NUNCA agregues: characterSchema.index({ fightingStyles: 1, titles: 1 });

module.exports = mongoose.model('Character', characterSchema);