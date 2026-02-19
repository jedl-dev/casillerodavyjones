const Question = require('../models/Question');

const getQuizSession = async (req, res) => {
    try {
        const sessionConfig = [
            { difficulty: 'Fácil', count: 15 },
            { difficulty: 'Intermedia', count: 15 },
            { difficulty: 'Difícil', count: 12 },
            { difficulty: 'Muy Difícil', count: 10 },
            { difficulty: 'Imposible', count: 8 }
        ];

        let pool = {};
        for (const config of sessionConfig) {
            const batch = await Question.aggregate([
                { $match: { difficulty: config.difficulty } },
                { $sample: { size: config.count } }
            ]);
            pool[config.difficulty] = batch;
        }

        res.json({ success: true, pool });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

const createQuestion = async (req, res) => {
    try {
        const newQuestion = new Question(req.body);
        await newQuestion.save();
        res.status(201).json({ success: true, data: newQuestion });
    } catch (error) {
        res.status(400).json({ success: false, error: error.message });
    }
};

const getQuestions = async (req, res) => {
    try {
        const questions = await Question.find().sort({ createdAt: -1 });
        res.json({ success: true, data: questions });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

const updateQuestion = async (req, res) => {
    try {
        const question = await Question.findByIdAndUpdate(req.params.id, req.body, { new: true });
        res.json({ success: true, data: question });
    } catch (error) {
        res.status(400).json({ success: false, error: error.message });
    }
};

const deleteQuestion = async (req, res) => {
    try {
        await Question.findByIdAndDelete(req.params.id);
        res.json({ success: true, message: "Eliminada" });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

module.exports = {
    getQuizSession,
    createQuestion,
    getQuestions,
    updateQuestion,
    deleteQuestion
};