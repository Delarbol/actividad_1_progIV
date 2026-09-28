// Primero importamos los modelos y la aplicación para preparar el inicio del servidor.
const { sequelize } = require('./src/models');
const app = require('./src/app');

async function start() {
  // Primero verificamos la base de datos; no abrimos la API si no podemos atender solicitudes.
  await sequelize.authenticate();
  // Creamos las tablas que falten. Esto no borra los datos ni modifica las tablas existentes.
  if (process.env.DB_SYNC !== 'false') await sequelize.sync();
  // Luego ponemos la API a escuchar en el puerto definido en el archivo .env.
  const port = Number(process.env.PORT || 3000);
  const server = app.listen(port, () => {
    console.log(`MarketSoft disponible en http://localhost:${port}`);
    console.log(`Swagger: http://localhost:${port}/api-docs`);
  });
  server.on('error', async (error) => {
    // Si no podemos abrir el puerto, cerramos también la conexión con la base de datos.
    console.error('No fue posible iniciar el servidor:', error.message);
    await sequelize.close();
    process.exitCode = 1;
  });
  const shutdown = () => {
    // Al detener el programa, esperamos a que terminen las solicitudes antes de cerrar la base.
    server.close(async () => { await sequelize.close(); });
  };
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
}

start().catch(async (error) => {
  // Acá mostramos el error de conexión o de creación de tablas para poder revisar la configuración.
  console.error('No fue posible conectar con PostgreSQL:', error.message);
  console.error('Revisa DATABASE_URL o inicia la base con docker compose up -d db.');
  await sequelize.close();
  process.exitCode = 1;
});
