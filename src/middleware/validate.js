const ApiError = require('../utils/ApiError');

// Hacemos una función que recibe las reglas de la ruta y revisa el cuerpo de la solicitud.
exports.body = (schema) => (req, res, next) => {
  // Solo pasan los campos definidos; el cliente no puede imponer precios de venta ni totales.
  req.body = schema.parse(req.body);
  // Si la validación termina bien, continuamos al controlador. Si falla, se lanza un error.
  next();
};
exports.id = (req, res, next) => {
  // El id de la dirección llega como texto. Revisamos su formato y el límite del entero de PostgreSQL.
  if (!/^[1-9]\d*$/.test(req.params.id) || Number(req.params.id) > 2147483647) {
    throw new ApiError(400, 'El identificador debe ser un entero positivo válido.');
  }
  next();
};
