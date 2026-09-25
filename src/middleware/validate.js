const ApiError = require('../utils/ApiError');

exports.body = (schema) => (req, res, next) => {
  // Solo pasan los campos definidos; el cliente no puede imponer precios de venta ni totales.
  req.body = schema.parse(req.body);
  next();
};
exports.id = (req, res, next) => {
  if (!/^[1-9]\d*$/.test(req.params.id) || Number(req.params.id) > 2147483647) {
    throw new ApiError(400, 'El identificador debe ser un entero positivo válido.');
  }
  next();
};
