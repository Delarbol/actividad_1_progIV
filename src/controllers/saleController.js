const { Op } = require('sequelize');
const { sequelize, Sale, SaleDetail, Product, User } = require('../models');
const ApiError = require('../utils/ApiError');
const { toCents, fromCents } = require('../utils/money');
const view = require('../views/jsonView');

// Al consultar una venta, mostramos también el usuario y los productos de sus detalles.
const include = [
  { model: User, as: 'user' },
  { model: SaleDetail, as: 'details', include: [{ model: Product, as: 'product' }] },
];
async function findSale(id, transaction) {
  // Si vamos a modificar la venta, bloqueamos su fila hasta terminar la transacción.
  // Así otra solicitud que use este bloqueo espera antes de modificar la misma venta.
  const sale = await Sale.findByPk(id, { transaction, ...(transaction && { lock: transaction.LOCK.UPDATE }) });
  if (!sale) throw new ApiError(404, 'La venta no existe.');
  return sale;
}
async function checkUser(id, transaction) {
  // Una venta siempre debe pertenecer a un usuario que exista en la base de datos.
  if (!await User.findByPk(id, { transaction })) throw new ApiError(404, 'El usuario no existe.');
}

async function replaceItems(sale, items, transaction) {
  // Primero consultamos los detalles anteriores y los organizamos por producto en un Map.
  // Esto nos permite comparar lo que tenía la venta con la nueva lista de productos.
  const previous = await SaleDetail.findAll({ where: { saleId: sale.id }, transaction });
  const oldItems = new Map(previous.map((detail) => [detail.productId, detail]));
  // Reunimos los ids anteriores y nuevos sin repetirlos, incluyendo los productos que se van a retirar.
  const ids = [...new Set([...oldItems.keys(), ...items.map((item) => item.productId)])].sort((a, b) => a - b);
  // Bloqueamos los productos siempre en el mismo orden. Así dos ventas no gastan el mismo stock.
  const products = await Product.findAll({
    where: { id: { [Op.in]: ids } }, order: [['id', 'ASC']], transaction, lock: transaction.LOCK.UPDATE,
  });
  const byId = new Map(products.map((product) => [product.id, product]));
  const newItems = new Map(items.map((item) => [item.productId, item]));
  let total = 0;
  for (const productId of ids) {
    const product = byId.get(productId);
    if (!product) throw new ApiError(404, `El producto ${productId} no existe.`);
    const old = oldItems.get(productId);
    const item = newItems.get(productId);
    // Devolvemos la cantidad anterior y descontamos la nueva en una sola cuenta.
    // Por ejemplo: si había 8 disponibles, devolvemos 2 y vendemos 3, quedan 7.
    const stock = product.stock + (old?.quantity || 0) - (item?.quantity || 0);
    if (stock < 0) throw new ApiError(409, `Stock insuficiente para ${product.name}.`);
    if (stock > 2147483647) throw new ApiError(409, `El stock de ${product.name} supera el límite.`);
    await product.update({ stock }, { transaction });
    if (item) {
      // Conservamos el precio registrado, aunque después cambie el precio del catálogo.
      const price = old ? old.price : product.price;
      total += toCents(price) * item.quantity;
      // Revisamos el límite del total mientras lo acumulamos, antes de guardar la venta.
      fromCents(total);
      if (old) await old.update({ quantity: item.quantity }, { transaction });
      else await SaleDetail.create({ saleId: sale.id, productId, quantity: item.quantity, price }, { transaction });
    } else if (old) await old.destroy({ transaction });
  }
  await sale.update({ total: fromCents(total) }, { transaction });
}

exports.list = async (req, res) => view.success(res, await Sale.findAll({ include, order: [['id', 'ASC']] }));
exports.get = async (req, res) => {
  await findSale(req.params.id);
  return view.success(res, await Sale.findByPk(req.params.id, { include }));
};
exports.create = async (req, res) => {
  // Si algo falla, se deshacen juntos la venta, sus detalles y el descuento de inventario.
  const result = await sequelize.transaction(async (transaction) => {
    await checkUser(req.body.userId, transaction);
    const sale = await Sale.create({ userId: req.body.userId }, { transaction });
    await replaceItems(sale, req.body.items || [], transaction);
    return Sale.findByPk(sale.id, { include, transaction });
  });
  return view.success(res, result, 201);
};
// Podemos cambiar el usuario, reemplazar los productos o hacer ambas cosas en la misma operación.
exports.update = async (req, res) => {
  const result = await sequelize.transaction(async (transaction) => {
    const sale = await findSale(req.params.id, transaction);
    if (req.body.userId !== undefined) {
      await checkUser(req.body.userId, transaction);
      await sale.update({ userId: req.body.userId }, { transaction });
    }
    if (req.body.items) await replaceItems(sale, req.body.items, transaction);
    return Sale.findByPk(sale.id, { include, transaction });
  });
  return view.success(res, result);
};
exports.remove = async (req, res) => {
  // Al pasar una lista vacía, devolvemos todas las unidades y eliminamos los detalles.
  // Después borramos la venta, dentro de la misma transacción.
  await sequelize.transaction(async (transaction) => {
    const sale = await findSale(req.params.id, transaction);
    await replaceItems(sale, [], transaction);
    await sale.destroy({ transaction });
  });
  return view.success(res, { message: 'Venta eliminada y existencias devueltas.' });
};

// También usamos esta operación desde el CRUD de detalles para mantener las mismas reglas.
exports.findSale = findSale;
exports.replaceItems = replaceItems;
