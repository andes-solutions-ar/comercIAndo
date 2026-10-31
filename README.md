# ComercIAndo Remake — backend propio

Esta rama es **Emprendedores**: consultar [EMPRENDEDORES.md](EMPRENDEDORES.md)
para su Supabase, entorno local y preview independientes. La configuración de
abajo describe la aplicación original; en esta rama las variables de Vercel se
limitan a Preview con override para `emprendedores`.

La aplicación operativa está en /administracion/ y la tienda conectada en /tienda/.
/panel/ deriva a la administración actual; /catalogo deriva a la tienda.
/demo/ conserva el prototipo restringido y sus datos ficticios, separado del backend.

## Configuración

VITE_SUPABASE_URL y VITE_SUPABASE_PUBLISHABLE_KEY se configuran mediante variables
locales ignoradas y en Vercel (Production, Preview, Development). No hay claves de
servidor en el cliente. El proyecto nuevo pertenece a la cuenta de Supabase elegida
por el propietario, es independiente de Malvi’s y no reutiliza el backend anterior.
Auth requiere perfil activo; las altas son por invitación. Se conservan tres cupos
para administradores y el superadministrador no ocupa cupo. En esta primera versión
operativa del remake los administradores requieren acceso completo: los permisos
parciales no habilitan el documento del negocio.

## Persistencia del remake

La migración remake_backend agrega un documento JSONB versionado por instancia en
PostgreSQL, eventos de guardado con actor real y pedidos web privados. Los esquemas
normalizados anteriores se conservan como base histórica, pero la interfaz del
remake usa exclusivamente remake_load, remake_commit y remake_catalog; no escribe
operaciones en dos modelos a la vez. Las escrituras directas están revocadas y las
tablas tienen RLS. Esta adaptación conserva el modelo del frontend suministrado;
no es una migración completa a entidades normalizadas de todas sus extensiones.

Los guardados se serializan con bloqueo de fila y control de versión. Un conflicto
recarga el estado y exige revisar la operación. Un UUID permite recuperar un
reintento sin duplicarlo. Los comprobantes se abren después de confirmar el guardado.
El servidor valida cantidades, precios controlados, totales, descuentos, stock,
históricos inmutables, reservas y entrega pagada. Los precios de POS de artículos
sin control comercial permiten la edición manual prevista por el diseño original.
No se importan automáticamente datos del localStorage ni los ejemplos de la demo.

La tienda recibe el catálogo público filtrado del servidor. Los pedidos y su
seguimiento pasan por la función remake-store, con validación y límite de solicitudes.
Cada pedido tiene un token privado UUID para seguimiento, distinto del código de
entrega. Reserva existencias y cupo; una entrega confirmada consume la reserva una
sola vez. Los cobros son registros manuales; no se conectó ninguna pasarela.

## Operación y límites

La tienda comienza sin productos y sin recibir pedidos. El administrador puede
cargar productos, asignar cupo online en Stock/Catálogo virtual y habilitar pedidos
en Configuración → Tienda conectada. Actualizar datos vuelve a consultar el servidor;
los cambios de otras sesiones se revalidan al guardar, sin sincronización visual en
segundo plano. El documento tiene un límite de 8 MB, incluidos adjuntos; para crecer
se deben normalizar entidades y trasladar archivos a Storage. Los tickets JPG pueden
mantener caché local, y el carrito público conserva su borrador en el dispositivo.

npm run build prepara el frontend original con un adaptador de autenticación y
persistencia asíncrona antes de compilar Vite. npm test verifica SQL real en PGlite.
La fixture tests/fixtures/remake.html usa un backend simulado sólo para revisar UI
en desarrollo; no se incluye en dist. No reemplaza la prueba de login y guardado
productivos con una cuenta real, ni la prueba de cámara/USB/WebRTC físico.

## Documentación de la implementación anterior

# ComercIAndo

Base tecnológica generalista de Andes Solutions para digitalización, venta y gestión comercial de emprendedores, profesionales, comercios y pequeñas/medianas empresas.

> ComercIAndo no es una familia gastronómica. Andes Gastro / Andes Gastro Pro constituyen una línea separada.

## Productos comerciales

### START — USD 100/mes

- Página base, tienda o catálogo digital.
- Panel administrativo.
- Gestión de productos o servicios e imágenes.
- Ventas, pedidos y/o reservas según el negocio.
- Stock Básico.
- 1 usuario administrativo.

### COMMERCE — USD 150/mes

Incluye START y agrega:

- Pasarela de pagos.
- Hasta 3 usuarios administrativos.
- Mantiene Stock Básico.

### PREMIUM — USD 250/mes

- Página base, tienda o catálogo.
- Panel administrativo.
- Productos o servicios.
- Ventas, pedidos y/o reservas.
- Stock Pro.
- Gestión de entrega segura asociada al Stock Pro.
- Punto de venta (POS).
- Pasarela de pagos.
- Hasta 3 usuarios administrativos.
- Un módulo empresarial a elección:
  - Nómina de personal y gestión de turnos, o
  - Presupuestos y cotizaciones.

## Arquitectura actual de Premium

La referencia aceptada es `indexantigravity.html`: se conserva su sistema visual y sus once módulos. La aplicación usa Vite y JavaScript modular, Supabase Auth, PostgreSQL y RLS.

La especificación nueva establece una instancia independiente de Vercel y Supabase por cliente sobre este mismo Golden Repo. La identidad del negocio se configura en `app_settings`. Esta decisión reemplaza para Premium la propuesta anterior de tenants compartidos dentro de una misma base.

El panel exige una sesión con perfil administrativo activo. Los productos son la fuente central de POS, inventario, catálogo y presupuestos. Las operaciones de stock, cobros, reservas y entregas se registran en transacciones. No se importan automáticamente los datos anteriores del navegador. localStorage sólo conserva el tema; Supabase Auth administra su sesión.

La pasarela permanece sin configurar: el sistema registra efectivo/débito manuales y cobros digitales pendientes de confirmación, sin simular acreditaciones de un proveedor.

## Desarrollo

1. Ejecutar `npm ci`.
2. Copiar `.env.example` a `.env.local`.
3. Completar `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY` del proyecto correspondiente.
4. Ejecutar `npm run dev`.
5. Verificar con `npm test` y `npm run build`.

Las variables `VITE_*` se incorporan al frontend y sólo deben contener la URL y una publishable key. Los archivos de entorno reales están excluidos de Git. No colocar credenciales administrativas en ellos ni en el código del navegador.

## Backend y despliegue

Las migraciones están en `supabase/migrations`. Las Edge Functions están en `supabase/functions`; requieren `SITE_URL` y los secrets predeterminados de servidor de Supabase. Configurar las variables del frontend en Production, Preview y Development de Vercel, y publicar las migraciones/funciones en el backend de esa misma instancia. Vercel no aplica migraciones SQL automáticamente.

Auth debe tener registro público deshabilitado y redirecciones de invitación/recuperación autorizadas. Andes crea el primer `super_admin` administrativamente; luego invita hasta tres administradores desde Usuarios. Cada destinatario define personalmente su contraseña.

El catálogo se publica en `/catalogo` cuando se habilita desde configuración. Los pedidos web parten desactivados.

El [informe de implementación](docs/IMPLEMENTACION_PREMIUM.md) detalla archivos, tablas, políticas, RPC, Edge Functions, verificación y pendientes de aceptación. Los flujos que requieren un usuario real deben verificarse después de que ese usuario complete su invitación.

## Alcance

No se agregaron compras, proveedores, CRM, contabilidad, facturación fiscal, IA ni automatizaciones. Premium incluye un módulo empresarial seleccionable: presupuestos y cotizaciones, o personal y turnos.
