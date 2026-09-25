const { sequelize } = require('./src/models');
const app = require('./src/app');

async function start() {
  // Primero verificamos la base de datos; no abrimos la API si no podemos atender solicitudes.
  await sequelize.authenticate();
  if (process.env.DB_SYNC !== 'false') await sequelize.sync();
  const port = Number(process.env.PORT || 3000);
  const server = app.listen(port, () => {
    console.log(`MarketSoft disponible en http://localhost:${port}`);
    console.log(`Swagger: http://localhost:${port}/api-docs`);
  });
  server.on('error', async (error) => {
    console.error('No fue posible iniciar el servidor:', error.message);
    await sequelize.close();
    process.exitCode = 1;
  });
  const shutdown = () => {
    server.close(async () => { await sequelize.close(); });
  };
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
}

start().catch(async (error) => {
  console.error('No fue posible conectar con PostgreSQL:', error.message);
  console.error('Revisa DATABASE_URL o inicia la base con docker compose up -d db.');
  await sequelize.close();
  process.exitCode = 1;
});
