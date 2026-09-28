const { Provider, Product, User } = require('../models');
const ApiError = require('../utils/ApiError');
const view = require('../views/jsonView');

// Los catálogos comparten el CRUD; dejamos aquí la lógica y las rutas solo la conectan.
function catalogController(Model, include = []) {
  // Buscamos por la clave primaria y avisamos si el registro solicitado no existe.
  async function find(id) {
    const record = await Model.findByPk(id);
    if (!record) throw new ApiError(404, 'El registro no existe.');
    return record;
  }
  async function checkReferences(data) {
    // Antes de guardar un producto, comprobamos que su proveedor esté registrado.
    if (Model === Product && !await Provider.findByPk(data.providerId)) {
      throw new ApiError(404, 'El proveedor no existe.');
    }
  }
  return {
    // Listamos por id e incluimos los datos relacionados que reciba este controlador.
    list: async (req, res) => view.success(res, await Model.findAll({ include, order: [['id', 'ASC']] })),
    get: async (req, res) => {
      await find(req.params.id);
      return view.success(res, await Model.findByPk(req.params.id, { include }));
    },
    create: async (req, res) => {
      // Los datos ya pasaron por las validaciones de la ruta; acá revisamos las referencias.
      await checkReferences(req.body);
      return view.success(res, await Model.create(req.body), 201);
    },
    update: async (req, res) => {
      // Primero buscamos el registro para actualizarlo sin crear uno nuevo.
      const record = await find(req.params.id);
      await checkReferences(req.body);
      return view.success(res, await record.update(req.body));
    },
    remove: async (req, res) => {
      // La base impide eliminar registros que todavía estén relacionados con otros datos.
      await (await find(req.params.id)).destroy();
      return view.success(res, { message: 'Registro eliminado.' });
    },
  };
}

// Usamos la misma función para las tres entidades. En productos también consultamos su proveedor.
exports.providers = catalogController(Provider);
exports.users = catalogController(User);
exports.products = catalogController(Product, [{ model: Provider, as: 'provider' }]);
