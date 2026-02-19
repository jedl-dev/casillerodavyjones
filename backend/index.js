require('dotenv').config();
const dns = require('node:dns');

// 1. PARCHE DE DNS (Vital para Nayarit/Node 24)
// Forzamos el uso de DNS de Cloudflare para resolver SRV de MongoDB
if (process.env.NODE_ENV !== 'production') {
    dns.setServers(['1.1.1.1', '1.0.0.1']);
}
dns.setDefaultResultOrder('ipv4first');

const express = require('express');
const cors = require('cors');
const { connectDB } = require('./config/db'); 

// --- IMPORTAR RUTAS ---
const characterRoutes = require('./routes/characterRoutes');
const gridGameRoutes = require('./routes/gridGameRoutes');
const quizRoutes = require('./routes/quizRoutes');

const app = express();

// 2. CONEXIÓN A DB
connectDB(); 

app.use(express.json());
app.use(cors()); // CORS abierto como en tu ejemplo funcional

// Ruta de verificación
app.get('/api/saludo', (req, res) => {
    res.json({ message: "¡API de One Piece Games navegando sin errores!" });
});

// --- USAR RUTAS ---
app.use('/api/characters', characterRoutes);
app.use('/api/grid-game', gridGameRoutes); 
app.use('/api/quiz', quizRoutes);

// 3. EXPORTACIÓN PARA VERCEL
module.exports = app;

// 4. ESCUCHA LOCAL
if (process.env.NODE_ENV !== 'production') {
    const PORT = process.env.PORT || 5000;
    app.listen(PORT, () => {
        console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
    });
}