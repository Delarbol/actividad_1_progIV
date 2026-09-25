const { Provider, Product, User } = require('../models');
const ApiError = require('../utils/ApiError');
const view = require('../views/jsonView');

// Los catálogos comparten el CRUD; dejamos aquí la lógica y las rutas solo la conectan.
function catalogController(Model, include = []) {
  async function find(id) {
    const record = await Model.findByPk(id);
    if (!record) throw new ApiError(404, 'El registro no existe.');
    return record;
  }
  async function checkReferences(data) {
    if (Model === Product && !await Provider.findByPk(data.providerId)) {
      throw new ApiError(404, 'El proveedor no existe.');
    }
  }
  return {
    list: async (req, res) => view.success(res, await Model.findAll({ include, order: [['id', 'ASC']] })),
    get: async (req, res) => {
      await find(req.params.id);
      return view.success(res, await Model.findByPk(req.params.id, { include }));
    },
    create: async (req, res) => {
      await checkReferences(req.body);
      return view.success(res, await Model.create(req.body), 201);
    },
    update: async (req, res) => {
      const record = await find(req.params.id);
      await checkReferences(req.body);
      return view.success(res, await record.update(req.body));
    },
    remove: async (req, res) => {
      await (await find(req.params.id)).destroy();
      return view.success(res, { message: 'Registro eliminado.' });
    },
  };
}

exports.providers = catalogController(Provider);
exports.users = catalogController(User);
exports.products = catalogController(Product, [{ model: Provider, as: 'provider' }]);
