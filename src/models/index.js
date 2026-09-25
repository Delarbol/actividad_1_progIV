const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const id = () => ({ type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true });
const name = () => ({ type: DataTypes.STRING(120), allowNull: false, validate: { notEmpty: true } });
const foreignKey = () => ({ type: DataTypes.INTEGER, allowNull: false });
const money = () => ({ type: DataTypes.DECIMAL(12, 2), allowNull: false, validate: { min: 0.01 } });

const Provider = sequelize.define('Provider', {
  id: id(), name: name(),
  phone: { type: DataTypes.STRING(30), allowNull: false },
  email: { type: DataTypes.STRING(254), allowNull: false, validate: { isEmail: true } },
  city: { type: DataTypes.STRING(100), allowNull: false },
}, { tableName: 'providers' });

const User = sequelize.define('User', {
  id: id(), name: name(),
  email: { type: DataTypes.STRING(254), allowNull: false, unique: true, validate: { isEmail: true } },
  role: { type: DataTypes.STRING(50), allowNull: false, validate: { notEmpty: true } },
}, { tableName: 'users' });

const Product = sequelize.define('Product', {
  id: id(), name: name(),
  description: { type: DataTypes.TEXT, allowNull: false },
  price: money(),
  stock: { type: DataTypes.INTEGER, allowNull: false, validate: { min: 0, isInt: true } },
  providerId: foreignKey(),
}, { tableName: 'products' });

const Sale = sequelize.define('Sale', {
  id: id(), userId: foreignKey(),
  date: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  total: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0, validate: { min: 0 } },
}, { tableName: 'sales' });

const SaleDetail = sequelize.define('SaleDetail', {
  id: id(), saleId: foreignKey(), productId: foreignKey(),
  quantity: { type: DataTypes.INTEGER, allowNull: false, validate: { min: 1, isInt: true } },
  price: money(),
}, { tableName: 'sale_details', indexes: [{ unique: true, fields: ['saleId', 'productId'] }] });

// Definimos ambos lados de cada relación para poder consultar los datos asociados.
// No borramos registros referenciados, pues perderíamos información de las ventas.
Provider.hasMany(Product, { foreignKey: 'providerId', as: 'products', onDelete: 'RESTRICT' });
Product.belongsTo(Provider, { foreignKey: 'providerId', as: 'provider', onDelete: 'RESTRICT' });
User.hasMany(Sale, { foreignKey: 'userId', as: 'sales', onDelete: 'RESTRICT' });
Sale.belongsTo(User, { foreignKey: 'userId', as: 'user', onDelete: 'RESTRICT' });
Sale.hasMany(SaleDetail, { foreignKey: 'saleId', as: 'details', onDelete: 'RESTRICT' });
SaleDetail.belongsTo(Sale, { foreignKey: 'saleId', as: 'sale', onDelete: 'RESTRICT' });
Product.hasMany(SaleDetail, { foreignKey: 'productId', as: 'saleDetails', onDelete: 'RESTRICT' });
SaleDetail.belongsTo(Product, { foreignKey: 'productId', as: 'product', onDelete: 'RESTRICT' });

module.exports = { sequelize, Provider, User, Product, Sale, SaleDetail };
