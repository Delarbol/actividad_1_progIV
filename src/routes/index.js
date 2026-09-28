const { Router } = require('express');
const catalog = require('../controllers/catalogController');
const sales = require('../controllers/saleController');
const details = require('../controllers/saleDetailController');
const schemas = require('../validators/schemas');
const validate = require('../middleware/validate');

const router = Router();
// Hacemos una función para registrar las cinco operaciones de cada recurso.
// Así podemos reutilizar las rutas de listar, consultar, crear, actualizar y eliminar.
function resource(path, controller, createSchema, updateSchema = createSchema) {
  router.get(path, controller.list);
  router.get(`${path}/:id`, validate.id, controller.get);
  // Antes de llegar al controlador, validamos los datos que envió el cliente.
  router.post(path, validate.body(createSchema), controller.create);
  router.put(`${path}/:id`, validate.id, validate.body(updateSchema), controller.update);
  router.delete(`${path}/:id`, validate.id, controller.remove);
}
// Ahora conectamos cada dirección con su controlador y sus reglas de validación.
// Ventas y detalles tienen reglas distintas para crear y actualizar un registro.
resource('/providers', catalog.providers, schemas.provider);
resource('/users', catalog.users, schemas.user);
resource('/products', catalog.products, schemas.product);
resource('/sales', sales, schemas.sale, schemas.saleUpdate);
resource('/sale-details', details, schemas.detail, schemas.detailUpdate);
module.exports = router;
