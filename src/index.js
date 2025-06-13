const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const obtenerEstadisticasDesdeURL = require('./scraper');

dotenv.config();

const app = express();
app.use(cors());

app.get('/estadisticas', async (req, res) => {
  const { url } = req.query;

  if (!url) {
    return res.status(400).json({ error: 'Falta el parámetro ?url=' });
  }

  try {
    const datos = await obtenerEstadisticasDesdeURL(url);
    res.json(datos);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener estadísticas', detalle: err.message });
  }
});

// Usar el puerto definido por Render o .env
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Servidor en http://localhost:${PORT}`));
