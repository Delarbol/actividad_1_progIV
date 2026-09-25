const { ZodError } = require('zod');
const { UniqueConstraintError, ForeignKeyConstraintError, ValidationError } = require('sequelize');
const view = require('../views/jsonView');

module.exports = (err, req, res, next) => {
  if (res.headersSent) return next(err);
  if (err instanceof ZodError) return view.error(res, 400, 'Revisa los datos enviados.', err.issues.map(
    (issue) => ({ field: issue.path.join('.'), message: issue.message }),
  ));
  if (err instanceof UniqueConstraintError) return view.error(res, 409, 'Ya existe un registro con esos datos únicos.');
  if (err instanceof ForeignKeyConstraintError) return view.error(res, 409, 'El registro está relacionado con otros datos o la referencia no existe.');
  if (err instanceof ValidationError) return view.error(res, 400, 'Los datos no cumplen las validaciones del modelo.');
  if (err.type === 'entity.parse.failed') return view.error(res, 400, 'El cuerpo debe ser un JSON válido.');
  if (err.type === 'entity.too.large') return view.error(res, 413, 'El cuerpo de la solicitud es demasiado grande.');
  if (err.status >= 400 && err.status < 500) return view.error(res, err.status, err.message);
  console.error('Error interno:', err.message);
  return view.error(res, 500, 'Ocurrió un error interno en el servidor.');
};
