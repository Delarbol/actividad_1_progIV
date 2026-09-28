// Acá probamos la API con solicitudes HTTP y una base PostgreSQL exclusiva para pruebas.
// Comprobamos tanto las respuestas como los cambios en ventas e inventario.
const { before, after, test } = require('node:test');
const assert = require('node:assert/strict');
require('dotenv').config({ quiet: true });

// Solo recreamos tablas en una base de pruebas indicada de forma explícita.
const testUrl = process.env.TEST_DATABASE_URL;
if (!testUrl || !new URL(testUrl).pathname.endsWith('_test')) {
  throw new Error('Define TEST_DATABASE_URL con una base exclusiva cuyo nombre termine en _test.');
}
const applicationUrl = new URL(process.env.DATABASE_URL || 'postgres://marketsoft:marketsoft@localhost:5433/marketsoft');
const targetUrl = new URL(testUrl);
if (targetUrl.pathname === applicationUrl.pathname) {
  throw new Error('La base de pruebas debe ser distinta de la base de la aplicación.');
}
// Cambiamos la conexión antes de importar la aplicación para que los modelos usen la base de pruebas.
process.env.DATABASE_URL = testUrl;
const request = require('supertest');
const app = require('../src/app');
const { sequelize, Sale, SaleDetail } = require('../src/models');
const api = request(app);

// Antes de las pruebas recreamos las tablas de esa base; al terminar cerramos las conexiones.
before(async () => { await sequelize.sync({ force: true }); });
after(async () => { await sequelize.close(); });

let counter = 0;
async function fixture(stock = 10, price = 12.5) {
  // Creamos un proveedor, un usuario y un producto para reutilizarlos en cada caso.
  // El contador permite generar correos diferentes y evitar duplicados entre pruebas.
  counter += 1;
  const providerInput = { name: 'Proveedor', phone: '3001234567', email: `proveedor${counter}@example.com`, city: 'Manizales' };
  const userInput = { name: 'Usuario', email: `usuario${counter}@example.com`, role: 'cajero' };
  const provider = (await api.post('/api/providers').send(providerInput).expect(201)).body.data;
  const user = (await api.post('/api/users').send(userInput).expect(201)).body.data;
  const productInput = { name: 'Producto', description: 'Descripción', price, stock, providerId: provider.id };
  const product = (await api.post('/api/products').send(productInput).expect(201)).body.data;
  return { provider, user, product, providerInput, userInput, productInput };
}
async function getStock(id) {
  // Consultamos el inventario a través de la API para revisar el resultado de cada operación.
  return (await api.get(`/api/products/${id}`).expect(200)).body.data.stock;
}
async function getSale(id) {
  return (await api.get(`/api/sales/${id}`).expect(200)).body.data;
}

test('CRUD completo de proveedores, usuarios y productos', async () => {
  // Recorremos las tres entidades con las mismas comprobaciones de consulta y actualización.
  const f = await fixture();
  for (const [resource, record, input] of [
    ['providers', f.provider, f.providerInput], ['users', f.user, f.userInput], ['products', f.product, f.productInput],
  ]) {
    const list = await api.get(`/api/${resource}`).expect(200);
    assert.ok(list.body.data.some((item) => item.id === record.id));
    await api.get(`/api/${resource}/${record.id}`).expect(200);
    const updated = await api.put(`/api/${resource}/${record.id}`).send({ ...input, name: 'Actualizado' }).expect(200);
    assert.equal(updated.body.data.name, 'Actualizado');
  }
  await api.delete(`/api/providers/${f.provider.id}`).expect(409);
  for (const [resource, record] of [['products', f.product], ['users', f.user], ['providers', f.provider]]) {
    await api.delete(`/api/${resource}/${record.id}`).expect(200);
    await api.get(`/api/${resource}/${record.id}`).expect(404);
  }
});

test('validaciones, referencias y correo único sin distinguir mayúsculas', async () => {
  const f = await fixture();
  for (const change of [{ price: 0 }, { price: -1 }, { price: 1.111 }, { stock: -1 }, { stock: 1.5 }, { providerId: '1' }]) {
    await api.post('/api/products').send({ ...f.productInput, ...change }).expect(400);
  }
  await api.post('/api/products').send({ ...f.productInput, providerId: 2147483647 }).expect(404);
  await api.post('/api/users').send({ ...f.userInput, email: f.userInput.email.toUpperCase() }).expect(409);
  await api.post('/api/users').send({ ...f.userInput, email: 'correo inválido' }).expect(400);
  await api.put(`/api/users/${f.user.id}`).send({ name: 'Incompleto' }).expect(400);
  await api.post('/api/sales').send({ userId: f.user.id, total: 1 }).expect(400);
  await api.post('/api/sales').send({ userId: 2147483647 }).expect(404);
  await api.post('/api/sales').send({ userId: f.user.id, items: [] }).expect(400);
  await api.post('/api/sales').send({ userId: f.user.id, items: [{ productId: f.product.id, quantity: 1 }, { productId: f.product.id, quantity: 2 }] }).expect(400);
  for (const id of ['abc', '0', '-1', '1.5', '2147483648']) await api.get(`/api/products/${id}`).expect(400);
});

test('CRUD de ventas, cálculo automático, precio histórico y devolución', async () => {
  // Vendemos dos unidades y luego cambiamos el precio del catálogo.
  // Al editar la venta verificamos que siga usando el precio con el que se registró.
  const f = await fixture();
  const sale = (await api.post('/api/sales').send({ userId: f.user.id, items: [{ productId: f.product.id, quantity: 2 }] }).expect(201)).body.data;
  assert.equal(sale.total, '25.00');
  assert.ok(sale.date);
  assert.equal(sale.details[0].price, '12.50');
  assert.equal(await getStock(f.product.id), 8);
  assert.ok((await api.get('/api/sales').expect(200)).body.data.some((item) => item.id === sale.id));
  await api.delete(`/api/users/${f.user.id}`).expect(409);
  await api.delete(`/api/products/${f.product.id}`).expect(409);
  await api.put(`/api/products/${f.product.id}`).send({ ...f.productInput, stock: 8, price: 20 }).expect(200);
  const updated = (await api.put(`/api/sales/${sale.id}`).send({ items: [{ productId: f.product.id, quantity: 3 }] }).expect(200)).body.data;
  assert.equal(updated.total, '37.50');
  assert.equal(await getStock(f.product.id), 7);
  const other = await fixture();
  await api.put(`/api/sales/${sale.id}`).send({ userId: other.user.id }).expect(200);
  assert.equal((await getSale(sale.id)).userId, other.user.id);
  await api.delete(`/api/sales/${sale.id}`).expect(200);
  assert.equal(await getStock(f.product.id), 10);
  assert.equal(await SaleDetail.count({ where: { saleId: sale.id } }), 0);
  await api.get(`/api/sales/${sale.id}`).expect(404);
});

test('CRUD de detalles mantiene id, total y stock al cambiar el producto', async () => {
  // Partimos de una venta vacía y cambiamos el producto de uno de sus detalles.
  // Revisamos que se devuelvan las unidades anteriores y se descuenten las del nuevo producto.
  const f = await fixture();
  const other = await fixture(8, 3.25);
  const sale = (await api.post('/api/sales').send({ userId: f.user.id }).expect(201)).body.data;
  assert.equal(sale.total, '0.00');
  const detail = (await api.post('/api/sale-details').send({ saleId: sale.id, productId: f.product.id, quantity: 2 }).expect(201)).body.data;
  await api.get(`/api/sale-details/${detail.id}`).expect(200);
  assert.ok((await api.get('/api/sale-details').expect(200)).body.data.some((item) => item.id === detail.id));
  await api.post('/api/sale-details').send({ saleId: sale.id, productId: f.product.id, quantity: 1 }).expect(409);
  await api.post('/api/sale-details').send({ saleId: sale.id, productId: other.product.id, quantity: 0 }).expect(400);
  await api.put(`/api/sale-details/${detail.id}`).send({ productId: f.product.id, quantity: 3 }).expect(200);
  assert.equal((await getSale(sale.id)).total, '37.50');
  const updated = (await api.put(`/api/sale-details/${detail.id}`).send({ productId: other.product.id, quantity: 2 }).expect(200)).body.data;
  assert.equal(updated.id, detail.id);
  assert.equal(updated.price, '3.25');
  assert.equal(await getStock(f.product.id), 10);
  assert.equal(await getStock(other.product.id), 6);
  assert.equal((await getSale(sale.id)).total, '6.50');
  await api.delete(`/api/sale-details/${detail.id}`).expect(200);
  await api.get(`/api/sale-details/${detail.id}`).expect(404);
  assert.equal(await getStock(other.product.id), 8);
  assert.equal((await getSale(sale.id)).total, '0.00');
});

test('rollback completo al fallar un producto y al editar sin existencias', async () => {
  // Provocamos un error por falta de inventario y comprobamos que se deshagan todos los cambios.
  const f = await fixture(4);
  const other = await fixture(0);
  const count = await Sale.count();
  await api.post('/api/sales').send({ userId: f.user.id, items: [{ productId: f.product.id, quantity: 2 }, { productId: other.product.id, quantity: 1 }] }).expect(409);
  assert.equal(await Sale.count(), count);
  assert.equal(await getStock(f.product.id), 4);
  const sale = (await api.post('/api/sales').send({ userId: f.user.id, items: [{ productId: f.product.id, quantity: 1 }] }).expect(201)).body.data;
  await api.put(`/api/sales/${sale.id}`).send({ userId: other.user.id, items: [{ productId: f.product.id, quantity: 5 }] }).expect(409);
  await api.put(`/api/sale-details/${sale.details[0].id}`).send({ productId: other.product.id, quantity: 1 }).expect(409);
  const unchanged = await getSale(sale.id);
  assert.equal(unchanged.userId, f.user.id);
  assert.equal(unchanged.total, '12.50');
  assert.equal(unchanged.details[0].quantity, 1);
  assert.equal(await getStock(f.product.id), 3);
});

test('ventas simultáneas no generan stock negativo', async () => {
  // Enviamos dos ventas para una sola unidad disponible. Solo una debe poder completarse.
  const f = await fixture(1, 0.1);
  const input = { userId: f.user.id, items: [{ productId: f.product.id, quantity: 1 }] };
  const responses = await Promise.all([api.post('/api/sales').send(input), api.post('/api/sales').send(input)]);
  assert.deepEqual(responses.map((result) => result.status).sort(), [201, 409]);
  assert.equal(await getStock(f.product.id), 0);
  assert.equal(responses.find((result) => result.status === 201).body.data.total, '0.10');
});

test('ediciones simultáneas de detalles mantienen el total y el inventario', async () => {
  // No suponemos cuál edición terminará de última; revisamos que el estado final sea consistente.
  const f = await fixture(10, 0.1);
  const sale = (await api.post('/api/sales').send({ userId: f.user.id, items: [{ productId: f.product.id, quantity: 1 }] }).expect(201)).body.data;
  const results = await Promise.all([2, 3].map((quantity) => api.put(`/api/sale-details/${sale.details[0].id}`).send({ productId: f.product.id, quantity })));
  assert.ok(results.every((result) => result.status === 200));
  const final = await getSale(sale.id);
  assert.equal(await getStock(f.product.id), 10 - final.details[0].quantity);
  assert.equal(final.total, (final.details[0].quantity * 0.1).toFixed(2));
});

test('límite monetario revierte la venta', async () => {
  // Cada unidad tiene un precio permitido, pero la suma supera el límite del total de la venta.
  const f = await fixture(2, 9999999999.99);
  await api.post('/api/sales').send({ userId: f.user.id, items: [{ productId: f.product.id, quantity: 2 }] }).expect(400);
  assert.equal(await getStock(f.product.id), 2);
});

test('Swagger documenta las 25 operaciones y los errores siempre son JSON', async () => {
  // Contamos cinco operaciones por entidad y probamos errores de ruta, formato y tamaño del cuerpo.
  const specification = (await api.get('/api-docs.json').expect(200)).body;
  const operations = Object.values(specification.paths).reduce((total, path) => total + Object.keys(path).filter((key) => ['get', 'post', 'put', 'delete'].includes(key)).length, 0);
  assert.equal(operations, 25);
  await api.get('/api-docs/').expect(200).expect('Content-Type', /html/);
  await api.get('/api/inexistente').expect(404).expect('Content-Type', /json/);
  const malformed = await api.post('/api/users').set('Content-Type', 'application/json').send('{').expect(400);
  assert.ok(malformed.body.error.message);
  await api.post('/api/users').send({ name: 'x'.repeat(110000) }).expect(413).expect('Content-Type', /json/);
});
