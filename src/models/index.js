// Acá definimos los datos de cada entidad y cómo se relacionan en PostgreSQL.
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

// Reutilizamos estas funciones para los campos que se repiten en varios modelos.
// Cada id se genera automáticamente y los valores monetarios tienen dos decimales.
const id = () => ({ type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true });
const name = () => ({ type: DataTypes.STRING(120), allowNull: false, validate: { notEmpty: true } });
const foreignKey = () => ({ type: DataTypes.INTEGER, allowNull: false });
const money = () => ({ type: DataTypes.DECIMAL(12, 2), allowNull: false, validate: { min: 0.01 } });

// Primero definimos el proveedor, que guarda los datos de contacto de quien suministra productos.
const Provider = sequelize.define('Provider', {
  id: id(), name: name(),
  phone: { type: DataTypes.STRING(30), allowNull: false },
  email: { type: DataTypes.STRING(254), allowNull: false, validate: { isEmail: true } },
  city: { type: DataTypes.STRING(100), allowNull: false },
}, { tableName: 'providers' });

// El usuario representa a quien registra la venta. Su correo no se puede repetir.
const User = sequelize.define('User', {
  id: id(), name: name(),
  email: { type: DataTypes.STRING(254), allowNull: false, unique: true, validate: { isEmail: true } },
  role: { type: DataTypes.STRING(50), allowNull: false, validate: { notEmpty: true } },
}, { tableName: 'users' });

// Cada producto tiene un proveedor, un precio de catálogo y una cantidad disponible en inventario.
const Product = sequelize.define('Product', {
  id: id(), name: name(),
  description: { type: DataTypes.TEXT, allowNull: false },
  price: money(),
  stock: { type: DataTypes.INTEGER, allowNull: false, validate: { min: 0, isInt: true } },
  providerId: foreignKey(),
}, { tableName: 'products' });

// La venta guarda el usuario, la fecha y el total. Los productos van en sus detalles.
// Iniciamos el total en cero para permitir crear una venta y agregar los productos después.
const Sale = sequelize.define('Sale', {
  id: id(), userId: foreignKey(),
  date: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  total: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0, validate: { min: 0 } },
}, { tableName: 'sales' });

// Cada detalle indica qué producto se vendió, cuántas unidades y a qué precio.
// La combinación de venta y producto es única para no repetir el mismo producto en una venta.
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
