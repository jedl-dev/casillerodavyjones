require('dotenv').config();
const dns = require('node:dns');

// FORZAR DNS A NIVEL DE PROCESO
// Esto ignora el resolver local y usa Cloudflare directamente
dns.setServers(['1.1.1.1', '1.0.0.1']);

// MANTENER EL PARCHE DE ORDEN PARA NODE 24
dns.setDefaultResultOrder('ipv4first');

const express = require('express');
const cors = require('cors');
const { connectDB } = require('./config/db'); 
const characterRoutes = require('./routes/characterRoutes');

const app = express();

// Iniciar conexión con la nueva configuración de DNS activa
connectDB(); 

app.use(cors());
app.use(express.json());

app.use('/api/characters', characterRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`🚀 Servidor en puerto ${PORT} con DNS forzado (1.1.1.1)`);
});