// Reunimos las respuestas en estas funciones para que todos los controladores usen el mismo formato.
// Cuando la operación funciona, los resultados van dentro de data.
exports.success = (res, data, status = 200) => res.status(status).json({ data });
// Cuando falla, devolvemos el mensaje dentro de error y agregamos detalles solo si los recibimos.
exports.error = (res, status, message, details) => res.status(status).json({
  error: { message, ...(details && { details }) },
});
