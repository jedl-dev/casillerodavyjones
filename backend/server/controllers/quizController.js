const Question = require('../models/Question');

exports.getQuizSession = async (req, res) => {
    try {
        // Distribución del pool: Traemos suficientes para que al retroceder/avanzar siempre haya variedad
        const sessionConfig = [
            { difficulty: 'Fácil', count: 12 },
            { difficulty: 'Intermedia', count: 12 },
            { difficulty: 'Difícil', count: 10 },
            { difficulty: 'Muy Difícil', count: 8 },
            { difficulty: 'Imposible', count: 5 }
        ];

        let pool = {};

        for (const config of sessionConfig) {
            const batch = await Question.aggregate([
                { $match: { difficulty: config.difficulty } },
                { $sample: { size: config.count } }
            ]);
            pool[config.difficulty] = batch;
        }

        // Validación: Si el pool está vacío, la base de datos no tiene preguntas
        const totalFetched = Object.values(pool).reduce((acc, curr) => acc + curr.length, 0);
        if (totalFetched === 0) {
            return res.status(404).json({ 
                success: false, 
                message: "No hay preguntas en la base de datos." 
            });
        }

        res.json({ success: true, pool });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

exports.createQuestion = async (req, res) => {
    try {
        const newQuestion = new Question(req.body);
        await newQuestion.save();
        res.status(201).json({ success: true, data: newQuestion });
    } catch (error) {
        res.status(400).json({ success: false, error: error.message });
    }
};

exports.getQuestions = async (req, res) => {
    try {
        const questions = await Question.find().sort({ createdAt: -1 });
        res.json({ success: true, data: questions });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

exports.updateQuestion = async (req, res) => {
    try {
        const question = await Question.findByIdAndUpdate(req.params.id, req.body, { new: true });
        res.json({ success: true, data: question });
    } catch (error) {
        res.status(400).json({ success: false, error: error.message });
    }
};

exports.deleteQuestion = async (req, res) => {
    try {
        await Question.findByIdAndDelete(req.params.id);
        res.json({ success: true, message: "Eliminada" });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};