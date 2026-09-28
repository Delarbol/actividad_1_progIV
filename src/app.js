// En este archivo organizamos cómo recibe y responde las solicitudes nuestra aplicación.
const express = require('express');
const cors = require('cors');
const swaggerUi = require('swagger-ui-express');
const routes = require('./routes');
const specification = require('./views/openapi');
const view = require('./views/jsonView');
const errorHandler = require('./middleware/errorHandler');

const app = express();
app.disable('x-powered-by');
// Permitimos que el frontend indicado consulte la API desde el navegador.
app.use(cors({ origin: process.env.CORS_ORIGIN || 'http://localhost:5173' }));
// Convertimos el JSON recibido en req.body y limitamos el tamaño de cada solicitud.
app.use(express.json({ limit: '100kb' }));
app.get('/', (req, res) => view.success(res, { name: 'MarketSoft API', docs: '/api-docs' }));
app.get('/api-docs.json', (req, res) => res.json(specification));
// Mostramos Swagger para que se puedan consultar y probar las operaciones del proyecto.
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specification));
app.use('/api', routes);
// Si ninguna ruta coincide, respondemos con un error. Por eso este bloque va después de las rutas.
app.use((req, res) => view.error(res, 404, 'La ruta solicitada no existe.'));
// Finalmente dejamos el manejo de errores en un solo lugar para mantener el mismo formato.
app.use(errorHandler);
// Exportamos la aplicación sin abrir el puerto; así también podemos usarla desde las pruebas.
module.exports = app;
