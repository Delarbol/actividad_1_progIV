// Usamos Zod para definir qué datos aceptamos antes de intentar guardarlos en la base.
const { z } = require('zod');

// Primero definimos las reglas que se repiten: textos sin espacios en los extremos,
// ids enteros positivos y correos normalizados a minúsculas.
const text = (max) => z.string().trim().min(1).max(max);
const id = z.number().int().positive().max(2147483647);
const email = z.email().max(254).trim().toLowerCase();
// Comprobamos que el precio sea positivo y tenga como máximo dos decimales.
// Dejamos una pequeña tolerancia al multiplicar por cien por la precisión numérica de JavaScript.
const price = z.number().positive().max(9999999999.99).refine(
  (value) => Math.abs(value * 100 - Math.round(value * 100)) < 0.0001,
  'El precio debe tener máximo dos decimales.',
);
const item = z.strictObject({ productId: id, quantity: id });
// Si enviamos productos en una venta, debe haber entre uno y cien, sin repetir su id.
// Usamos un Set para comparar la cantidad de ids únicos con la cantidad de elementos.
const items = z.array(item).min(1).max(100).refine(
  (list) => new Set(list.map((entry) => entry.productId)).size === list.length,
  'Cada producto debe aparecer una sola vez.',
);

// Ahora definimos los campos de cada operación. strictObject rechaza los campos adicionales.
// Así el cliente no puede enviar un total o un precio de detalle calculado por su cuenta.
module.exports = {
  provider: z.strictObject({ name: text(120), phone: text(30), email, city: text(100) }),
  user: z.strictObject({ name: text(120), email, role: text(50) }),
  product: z.strictObject({
    name: text(120), description: z.string().trim().max(5000), price,
    stock: z.number().int().min(0).max(2147483647), providerId: id,
  }),
  sale: z.strictObject({ userId: id, items: items.optional() }),
  // Para actualizar una venta permitimos enviar solo el usuario o los productos, pero no un objeto vacío.
  saleUpdate: z.strictObject({ userId: id.optional(), items: items.optional() })
    .refine((data) => Object.keys(data).length > 0, 'Envía al menos un campo.'),
  detail: z.strictObject({ saleId: id, productId: id, quantity: id }),
  // Al editar un detalle no recibimos saleId, porque debe permanecer en su venta original.
  detailUpdate: z.strictObject({ productId: id, quantity: id }),
};
