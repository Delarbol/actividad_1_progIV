// Creamos un tipo de error que guarda el código HTTP junto con el mensaje.
// Así el controlador puede indicar, por ejemplo, que no existe un registro (404).
module.exports = class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
};
