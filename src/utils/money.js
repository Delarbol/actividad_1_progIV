const ApiError = require('./ApiError');

// Hacemos las cuentas en centavos para evitar errores de precisión con decimales.
exports.toCents = (value) => Math.round(Number(value) * 100);
// Ahora convertimos los centavos al formato que usamos en las respuestas, por ejemplo "12.50".
exports.fromCents = (value) => {
  // Validamos que el resultado sea un entero seguro, no sea negativo y quepa en DECIMAL(12, 2).
  if (!Number.isSafeInteger(value) || value < 0 || value > 999999999999) {
    throw new ApiError(400, 'El total supera el valor permitido.');
  }
  return (value / 100).toFixed(2);
};
