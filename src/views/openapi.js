const integer = { type: 'integer', minimum: 1, maximum: 2147483647 };
const string = (maxLength) => ({ type: 'string', minLength: 1, maxLength });
const email = { type: 'string', format: 'email', maxLength: 254 };
const money = { type: 'string', pattern: '^\\d+\\.\\d{2}$', example: '4500.00', description: 'PostgreSQL devuelve los valores DECIMAL como cadenas.' };
const ref = (name) => ({ $ref: `#/components/schemas/${name}` });
const object = (properties, required = Object.keys(properties)) => ({ type: 'object', properties, required, additionalProperties: false });

const provider = { name: string(120), phone: string(30), email, city: string(100) };
const user = { name: string(120), email, role: string(50) };
const product = {
  name: string(120), description: { type: 'string', maxLength: 5000 },
  price: { type: 'number', minimum: 0, exclusiveMinimum: true, maximum: 9999999999.99, multipleOf: 0.01 },
  stock: { type: 'integer', minimum: 0, maximum: 2147483647 }, providerId: integer,
};
const items = { type: 'array', minItems: 1, maxItems: 100, items: ref('SaleItem'), description: 'No se permite repetir un productId.' };
const schemas = {
  ProviderInput: object(provider), UserInput: object(user), ProductInput: object(product),
  SaleItem: object({ productId: integer, quantity: integer }),
  SaleInput: object({ userId: integer, items }, ['userId']),
  SaleUpdate: { ...object({ userId: integer, items }, []), minProperties: 1 },
  SaleDetailInput: object({ saleId: integer, productId: integer, quantity: integer }),
  SaleDetailUpdate: object({ productId: integer, quantity: integer }),
  Provider: object({ id: integer, ...provider }),
  User: object({ id: integer, ...user }),
  Product: object({ id: integer, ...product, price: money, provider: ref('Provider') }, ['id', ...Object.keys(product)]),
  Sale: object({ id: integer, userId: integer, date: { type: 'string', format: 'date-time' }, total: money, user: ref('User'), details: { type: 'array', items: ref('SaleDetail') } }, ['id', 'userId', 'date', 'total']),
  SaleDetail: object({ id: integer, saleId: integer, productId: integer, quantity: integer, price: money, product: ref('Product') }, ['id', 'saleId', 'productId', 'quantity', 'price']),
  Message: object({ message: { type: 'string' } }),
  Error: object({ error: object({ message: { type: 'string' }, details: { type: 'array', items: object({ field: { type: 'string' }, message: { type: 'string' } }) } }, ['message']) }),
};
const examples = {
  Provider: { name: 'Distribuidora Central', phone: '3001234567', email: 'contacto@central.com', city: 'Manizales' },
  User: { name: 'Camilo Andrés De la Cruz Arboleda', email: 'camilo@example.com', role: 'cajero' },
  Product: { name: 'Arroz', description: 'Bolsa de arroz de 1 kg', price: 4500, stock: 30, providerId: 1 },
  Sale: { userId: 1, items: [{ productId: 1, quantity: 2 }] },
  SaleDetail: { saleId: 1, productId: 2, quantity: 1 },
};
function response(description, schema) {
  return { description, content: { 'application/json': { schema } } };
}
function success(schema, description = 'Operación realizada.') {
  return response(description, object({ data: schema }));
}
const errors = {
  400: response('Datos inválidos o JSON mal formado.', ref('Error')),
  404: response('Recurso o referencia inexistente.', ref('Error')),
  409: response('Registro duplicado, stock insuficiente o relación que impide eliminar.', ref('Error')),
  500: response('Error interno.', ref('Error')),
};
const paths = {};
// Construimos la documentación del mismo CRUD para las cinco entidades.
for (const [path, name, tag] of [
  ['providers', 'Provider', 'Proveedores'], ['users', 'User', 'Usuarios'],
  ['products', 'Product', 'Productos'], ['sales', 'Sale', 'Ventas'],
  ['sale-details', 'SaleDetail', 'Detalles de venta'],
]) {
  const body = (schema, example) => ({ required: true, content: { 'application/json': { schema: ref(schema), example } } });
  const updateSchema = ['Sale', 'SaleDetail'].includes(name) ? `${name}Update` : `${name}Input`;
  const updateExample = name === 'SaleDetail' ? { productId: 2, quantity: 3 } : examples[name];
  paths[`/api/${path}`] = {
    get: { tags: [tag], summary: 'Listar registros', responses: { 200: success({ type: 'array', items: ref(name) }), ...errors } },
    post: { tags: [tag], summary: 'Crear registro', requestBody: body(`${name}Input`, examples[name]), responses: { 201: success(ref(name)), ...errors } },
  };
  paths[`/api/${path}/{id}`] = {
    parameters: [{ name: 'id', in: 'path', required: true, schema: integer }],
    get: { tags: [tag], summary: 'Consultar por id', responses: { 200: success(ref(name)), ...errors } },
    put: { tags: [tag], summary: 'Actualizar registro', description: name === 'Sale' ? 'items reemplaza el conjunto de productos. Conserva los precios de productos que ya estaban en la venta. Si se omite items, solo cambia el usuario.' : 'Envía todos los campos del esquema. El detalle permanece en su venta original.', requestBody: body(updateSchema, updateExample), responses: { 200: success(ref(name)), ...errors } },
    delete: { tags: [tag], summary: 'Eliminar registro', responses: { 200: success(ref('Message')), ...errors } },
  };
}
module.exports = {
  openapi: '3.0.3',
  info: { title: 'MarketSoft API', version: '1.0.0', description: 'Backend de supermercado con MVC. El total, la fecha y el precio de los detalles los calcula el servidor. Se permiten ventas vacías para agregar detalles mediante su CRUD. API académica sin autenticación.' },
  servers: [{ url: '/' }], paths, components: { schemas },
};
