# MarketSoft API

Backend para la gestión de productos, proveedores, usuarios, ventas y detalles de venta de un supermercado. Desarrollado en JavaScript con Node.js, Express, PostgreSQL y Sequelize para la Actividad Colaborativa I de Programación IV.

## Integrantes

| Nombre completo | Responsabilidad |
| --- | --- |
| Camilo Andrés De la Cruz Arboleda | Desarrollo inicial del proyecto |
| Andrés Felipe Peña Cruz | Revisión de arquitectura MVC, validación de endpoints, pruebas funcionales, documentación Swagger y complementación del README |

## Requisitos y ejecución

- Node.js 20 o superior y npm.
- PostgreSQL 16, instalado directamente o mediante Docker Compose.

Desde la carpeta del proyecto, inicia la base de datos y la aplicación:

```sh
docker compose up -d db
npm install
npm start
```

La configuración predeterminada coincide con `compose.yaml`, por lo que no hace falta modificar archivos. La base queda disponible en el puerto **5433** para evitar conflictos con instalaciones locales de PostgreSQL. Docker debe estar instalado y en ejecución. Las tablas se crean automáticamente al arrancar sin borrar datos existentes.

Si usas tu propio PostgreSQL, crea una base y un usuario con permisos sobre ella. Copia `.env.example` como `.env` y ajusta `DATABASE_URL` a tu conexión antes de ejecutar `npm install` y `npm start`. No subas `.env` al repositorio. Las credenciales incluidas en Compose son exclusivamente para desarrollo local.

En PowerShell, si la política de ejecución bloquea `npm.ps1`, utiliza `npm.cmd install` y `npm.cmd start`.

- API: <http://localhost:3000/api>
- Swagger interactivo: <http://localhost:3000/api-docs>
- Especificación OpenAPI: <http://localhost:3000/api-docs.json>
- Desarrollo con reinicio automático: `npm run dev`.

| Variable | Valor predeterminado | Uso |
| --- | --- | --- |
| `PORT` | `3000` | Puerto HTTP |
| `DATABASE_URL` | `postgres://marketsoft:marketsoft@localhost:5433/marketsoft` | Conexión PostgreSQL |
| `CORS_ORIGIN` | `http://localhost:5173` | Origen permitido para el frontend |
| `DB_SYNC` | `true` | Creación de tablas faltantes; usa `false` si gestionas el esquema por separado |
| `TEST_DATABASE_URL` | Sin valor | Base exclusiva para las pruebas |

## Arquitectura MVC

```text
server.js                      Inicio del servidor y conexión a PostgreSQL
src/
  app.js                       Configuración de Express
  config/database.js           Conexión Sequelize
  models/index.js              Cinco modelos y sus relaciones
  controllers/                 CRUD y reglas de ventas e inventario
  routes/index.js              Asociación entre endpoints y controladores
  views/jsonView.js            Formato de respuestas JSON
  views/openapi.js             Contrato OpenAPI y documentación Swagger
  middleware/                  Validación de solicitudes y manejo de errores
  validators/schemas.js        Esquemas de entrada
  utils/                       Errores y operaciones monetarias
tests/                         Pruebas HTTP sobre PostgreSQL real
```

Las rutas no contienen lógica de negocio. Los controladores procesan las operaciones, los modelos definen los datos y la vista presenta las respuestas JSON. Swagger permite consultar y probar el contrato de la API.

Relaciones: proveedor → productos; usuario → ventas; venta → detalles; producto → detalles. Todas tienen clave foránea y asociación en ambos sentidos. Una venta no puede contener dos detalles del mismo producto.

## Endpoints

Cada recurso ofrece `GET /api/recurso`, `GET /api/recurso/:id`, `POST /api/recurso`, `PUT /api/recurso/:id` y `DELETE /api/recurso/:id`.

| Entidad | Recurso | Campos de creación |
| --- | --- | --- |
| Proveedor | `providers` | `name`, `phone`, `email`, `city` |
| Usuario | `users` | `name`, `email`, `role` |
| Producto | `products` | `name`, `description`, `price`, `stock`, `providerId` |
| Venta | `sales` | `userId`, `items` opcional |
| Detalle de venta | `sale-details` | `saleId`, `productId`, `quantity` |

Los `PUT` de proveedores, usuarios y productos reciben todos los campos de creación. El `PUT` de una venta permite cambiar `userId`, reemplazar `items` o ambos. El `PUT` de un detalle recibe `productId` y `quantity`; conserva su id y su venta de origen.

Ejecuta estos ejemplos en orden desde Swagger con **Try it out**. Usa los ids devueltos por cada solicitud; los siguientes cuerpos asumen ids iniciales iguales a 1.

**1. Crear proveedor — `POST /api/providers`**

```json
{"name":"Distribuidora Central","phone":"3001234567","email":"contacto@central.com","city":"Manizales"}
```

**2. Crear usuario — `POST /api/users`**

```json
{"name":"Camilo Andrés De la Cruz Arboleda","email":"camilo@example.com","role":"cajero"}
```

**3. Crear producto — `POST /api/products`**

```json
{"name":"Arroz","description":"Bolsa de arroz de 1 kg","price":4500,"stock":30,"providerId":1}
```

**4. Crear venta — `POST /api/sales`**

```json
{"userId":1,"items":[{"productId":1,"quantity":2}]}
```

El total será `"9000.00"`, el stock del producto quedará en 28 y el detalle almacenará el precio `"4500.00"`. Consulta la venta mediante `GET /api/sales/1`.

**5. Cambiar cantidad — `PUT /api/sale-details/1`**

```json
{"productId":1,"quantity":3}
```

El total pasará a `"13500.00"` y el stock a 27. `DELETE /api/sale-details/1` devuelve las tres unidades y deja la venta en cero. También puedes crear una venta con `{"userId":1}` y agregar sus productos con `POST /api/sale-details` enviando `{"saleId":1,"productId":1,"quantity":2}`.

Para eliminar una venta y devolver todas sus unidades, utiliza `DELETE /api/sales/1`.

## Validaciones y reglas

- El precio debe ser mayor que cero y tener como máximo dos decimales; el stock debe ser un entero no negativo.
- Las cantidades e identificadores son enteros positivos. Se comprueba que las referencias existan.
- El correo del usuario es único y se normaliza a minúsculas. `role` es una etiqueta obligatoria, sin permisos asociados.
- El servidor asigna la fecha, toma el precio del catálogo y calcula el total. Rechaza campos desconocidos, incluido un total o precio de detalle enviado por el cliente.
- El precio histórico se conserva al modificar la cantidad. Si se cambia el producto del detalle, se utiliza el precio actual del nuevo producto.
- Una venta puede comenzar vacía y quedar vacía al borrar sus detalles. Si se envía `items`, debe incluir de 1 a 100 productos distintos; sustituye el conjunto completo de productos de la venta.
- Crear, editar o eliminar ventas y detalles actualiza el inventario y el total dentro de una transacción. Si falla una validación, se revierte toda la operación.
- Los bloqueos de fila evitan que ventas simultáneas consuman las mismas unidades. Los productos se bloquean en orden de id.
- No se permite eliminar proveedores con productos, usuarios con ventas ni productos incluidos en detalles. Primero deben retirarse las relaciones correspondientes.
- Los importes de salida son cadenas decimales para mantener el formato de PostgreSQL. Los cálculos se hacen en centavos y respetan el límite de `DECIMAL(12,2)`.

Respuestas exitosas: `{"data": ...}`. Errores: `{"error":{"message":"..."}}`, con detalles de validación cuando corresponda. Los códigos son `200` para consultas, actualizaciones y eliminaciones, `201` para creación, `400` para entradas inválidas, `404` para recursos inexistentes, `409` para conflictos, `413` para cuerpos demasiado grandes y `500` para errores internos. Los endpoints de negocio siempre responden JSON; Swagger es la interfaz HTML de documentación.

## Pruebas

Las pruebas usan **PostgreSQL real** y recrean las tablas de una base exclusiva. Por seguridad, la base indicada en `TEST_DATABASE_URL` debe tener un nombre terminado en `_test` y no debe ser la base de la aplicación.

Con la base de Docker en ejecución:

```sh
docker compose exec db createdb -U marketsoft marketsoft_test
```

PowerShell:

```powershell
$env:TEST_DATABASE_URL='postgres://marketsoft:marketsoft@localhost:5433/marketsoft_test'
npm.cmd test
```

Bash:

```sh
TEST_DATABASE_URL=postgres://marketsoft:marketsoft@localhost:5433/marketsoft_test npm test
```

Se comprueban el CRUD de las cinco entidades, validaciones, relaciones, precios históricos, devoluciones de stock, rollback y ventas concurrentes. Sin `TEST_DATABASE_URL`, la suite se detiene para evitar actuar sobre una base equivocada.

## Alcance y entrega

Proyecto académico sin autenticación ni autorización, orientado al consumo posterior desde un frontend. `sequelize.sync()` crea tablas faltantes, pero no migra tablas existentes. Antes de un despliegue público se necesita implementar autenticación y una estrategia de migraciones.


Referencias técnicas: [transacciones de Sequelize](https://sequelize.org/docs/v6/other-topics/transactions/) y [manejo de errores de Express](https://expressjs.com/en/guide/error-handling/).

Se fija `uuid` en `11.1.1` dentro de Sequelize para incluir la corrección del [aviso GHSA-w5hq-g745-h8pq](https://github.com/advisories/GHSA-w5hq-g745-h8pq). La compatibilidad se comprueba con las pruebas de integración.

### Validación funcional local

Se ejecutó el backend en entorno local con PostgreSQL y se verificó desde Swagger la respuesta JSON de la API. También se revisó la disponibilidad de la documentación interactiva en `/api-docs`.
