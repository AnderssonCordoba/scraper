const express = require('express');
const cors = require('cors');
const obtenerEstadisticasDesdeURL = require('./scraper');

const app = express();
app.use(cors());
app.use(express.json()); // Necesario para leer JSON en el body

app.post('/estadisticas', async (req, res) => {
  const { url } = req.body;

  if (!url) {
    return res.status(400).json({ error: 'Falta el parámetro "url"' });
  }

  try {
    const data = await obtenerEstadisticasDesdeURL(url);
    res.json(data);
  } catch (error) {
    console.error('Error al obtener estadísticas:', error.message);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor backend en puerto ${PORT}`);
});
