const Character = require('../models/Character');

// CREATE
exports.createCharacter = async (req, res) => {
    try {
        const newCharacter = new Character(req.body);
        const saved = await newCharacter.save();
        res.status(201).json({ success: true, data: saved });
    } catch (err) {
        console.error("❌ Error en CREATE:", err.message);
        res.status(400).json({ success: false, msg: err.message });
    }
};

// READ ALL
exports.getCharacters = async (req, res) => {
    try {
        const characters = await Character.find().sort({ bounty: -1 });
        res.status(200).json({ success: true, data: characters });
    } catch (err) {
        res.status(500).json({ success: false, msg: err.message });
    }
};

// READ ONE (Línea crítica para la ruta 10)
exports.getCharacterBySlug = async (req, res) => {
    try {
        const character = await Character.findOne({ slug: req.params.slug });
        if (!character) return res.status(404).json({ success: false, msg: "No encontrado" });
        res.status(200).json({ success: true, data: character });
    } catch (err) {
        res.status(500).json({ success: false, msg: err.message });
    }
};

// UPDATE
exports.updateCharacter = async (req, res) => {
    try {
        const updated = await Character.findOneAndUpdate(
            { slug: req.params.slug },
            req.body,
            { new: true, runValidators: true }
        );
        res.status(200).json({ success: true, data: updated });
    } catch (err) {
        res.status(400).json({ success: false, msg: err.message });
    }
};

// DELETE
exports.deleteCharacter = async (req, res) => {
    try {
        await Character.findOneAndDelete({ slug: req.params.slug });
        res.status(200).json({ success: true, msg: "Eliminado" });
    } catch (err) {
        res.status(500).json({ success: false, msg: err.message });
    }
};