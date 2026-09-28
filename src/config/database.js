// Primero cargamos las variables del archivo .env para leer los datos de conexión.
require('dotenv').config({ quiet: true });
const { Sequelize } = require('sequelize');

// Si no definimos una conexión, usamos la base local configurada en Docker Compose.
const databaseUrl = process.env.DATABASE_URL ||
  'postgres://marketsoft:marketsoft@localhost:5433/marketsoft';

// Creamos una sola instancia de Sequelize y la compartimos con todos los modelos.
module.exports = new Sequelize(databaseUrl, {
  dialect: 'postgres',
  logging: false,
  // Reutilizamos hasta diez conexiones para no abrir una nueva por cada consulta.
  pool: { max: 10, min: 0, acquire: 30000, idle: 10000 },
  // No agregamos fechas automáticas de creación y edición, ni cambiamos los nombres de las tablas.
  define: { timestamps: false, freezeTableName: true },
});
