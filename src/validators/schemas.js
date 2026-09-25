const { z } = require('zod');

const text = (max) => z.string().trim().min(1).max(max);
const id = z.number().int().positive().max(2147483647);
const email = z.email().max(254).trim().toLowerCase();
const price = z.number().positive().max(9999999999.99).refine(
  (value) => Math.abs(value * 100 - Math.round(value * 100)) < 0.0001,
  'El precio debe tener máximo dos decimales.',
);
const item = z.strictObject({ productId: id, quantity: id });
const items = z.array(item).min(1).max(100).refine(
  (list) => new Set(list.map((entry) => entry.productId)).size === list.length,
  'Cada producto debe aparecer una sola vez.',
);

module.exports = {
  provider: z.strictObject({ name: text(120), phone: text(30), email, city: text(100) }),
  user: z.strictObject({ name: text(120), email, role: text(50) }),
  product: z.strictObject({
    name: text(120), description: z.string().trim().max(5000), price,
    stock: z.number().int().min(0).max(2147483647), providerId: id,
  }),
  sale: z.strictObject({ userId: id, items: items.optional() }),
  saleUpdate: z.strictObject({ userId: id.optional(), items: items.optional() })
    .refine((data) => Object.keys(data).length > 0, 'Envía al menos un campo.'),
  detail: z.strictObject({ saleId: id, productId: id, quantity: id }),
  detailUpdate: z.strictObject({ productId: id, quantity: id }),
};
