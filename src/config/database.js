require('dotenv').config({ quiet: true });
const { Sequelize } = require('sequelize');

const databaseUrl = process.env.DATABASE_URL ||
  'postgres://marketsoft:marketsoft@localhost:5433/marketsoft';

module.exports = new Sequelize(databaseUrl, {
  dialect: 'postgres',
  logging: false,
  pool: { max: 10, min: 0, acquire: 30000, idle: 10000 },
  define: { timestamps: false, freezeTableName: true },
});
