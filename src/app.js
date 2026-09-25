const express = require('express');
const cors = require('cors');
const swaggerUi = require('swagger-ui-express');
const routes = require('./routes');
const specification = require('./views/openapi');
const view = require('./views/jsonView');
const errorHandler = require('./middleware/errorHandler');

const app = express();
app.disable('x-powered-by');
app.use(cors({ origin: process.env.CORS_ORIGIN || 'http://localhost:5173' }));
app.use(express.json({ limit: '100kb' }));
app.get('/', (req, res) => view.success(res, { name: 'MarketSoft API', docs: '/api-docs' }));
app.get('/api-docs.json', (req, res) => res.json(specification));
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specification));
app.use('/api', routes);
app.use((req, res) => view.error(res, 404, 'La ruta solicitada no existe.'));
app.use(errorHandler);
module.exports = app;
