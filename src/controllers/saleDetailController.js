const { sequelize, SaleDetail, Product } = require('../models');
const { findSale, replaceItems } = require('./saleController');
const ApiError = require('../utils/ApiError');
const view = require('../views/jsonView');

async function findDetail(id, transaction) {
  // Buscamos el detalle y detenemos la operación si el id no está registrado.
  const detail = await SaleDetail.findByPk(id, { transaction });
  if (!detail) throw new ApiError(404, 'El detalle de venta no existe.');
  return detail;
}
exports.list = async (req, res) => view.success(res, await SaleDetail.findAll({ order: [['id', 'ASC']] }));
exports.get = async (req, res) => {
  await findDetail(req.params.id);
  return view.success(res, await SaleDetail.findByPk(req.params.id, { include: [{ model: Product, as: 'product' }] }));
};

// Reunimos crear, actualizar y eliminar en una función para aplicar las mismas reglas.
// La transacción permite deshacer los cambios si falla alguna parte de la operación.
async function mutate(req, action) {
  return sequelize.transaction(async (transaction) => {
    const initial = action === 'create' ? null : await findDetail(req.params.id, transaction);
    // Al crear usamos la venta enviada; al editar o eliminar usamos la venta original del detalle.
    const sale = await findSale(initial ? initial.saleId : req.body.saleId, transaction);
    // Volvemos a leer después de bloquear la venta, por si otra solicitud modificó sus detalles.
    const current = initial ? await findDetail(req.params.id, transaction) : null;
    const details = await SaleDetail.findAll({ where: { saleId: sale.id }, transaction });
    // Armamos la lista de productos sin el detalle actual para poder reemplazarlo o retirarlo.
    const items = details.filter((detail) => detail.id !== current?.id)
      .map(({ productId, quantity }) => ({ productId, quantity }));
    if (action !== 'remove') {
      // Si el producto ya está en otro detalle, pedimos actualizar su cantidad en lugar de duplicarlo.
      if (items.some((item) => item.productId === req.body.productId)) {
        throw new ApiError(409, 'El producto ya está en la venta. Actualiza su cantidad.');
      }
      items.push({ productId: req.body.productId, quantity: req.body.quantity });
    }
    // Al cambiar el producto conservamos el id del detalle y tomamos el precio del nuevo producto.
    // replaceItems libera el stock anterior y reserva el nuevo dentro de la misma transacción.
    await replaceItems(sale, items, transaction);
    if (action === 'remove') return { message: 'Detalle eliminado y total actualizado.' };
    const result = await SaleDetail.findOne({ where: { saleId: sale.id, productId: req.body.productId }, transaction });
    if (current && result.id !== current.id) {
      // Si se creó otro detalle al cambiar de producto, recuperamos el id que tenía el original.
      await SaleDetail.update({ id: current.id }, { where: { id: result.id }, transaction });
      return SaleDetail.findByPk(current.id, { transaction });
    }
    return result;
  });
}
// Finalmente cada ruta indica la acción que necesita y devuelve el resultado en formato JSON.
exports.create = async (req, res) => view.success(res, await mutate(req, 'create'), 201);
exports.update = async (req, res) => view.success(res, await mutate(req, 'update'));
exports.remove = async (req, res) => view.success(res, await mutate(req, 'remove'));
