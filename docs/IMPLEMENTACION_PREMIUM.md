# ComercIAndo Premium — implementación

## Base visual y estructura

Se tomó `indexantigravity.html` como referencia del sistema visual: Instrument Sans, JetBrains Mono, paletas clara/oscura, SVG completos, sidebar, nombres de módulos, tarjetas, POS, switches, modales y ticket.

`index.html` ahora monta un loader; `src/main.js` verifica Supabase Auth y el perfil activo antes de importar el panel. El código está separado en `auth`, `components`, `services`, `utils` y `views`. Los datos operativos ya no usan arrays iniciales ni localStorage. localStorage conserva únicamente el tema; Supabase Auth administra su propia sesión persistente.

La especificación nueva define una instancia independiente por cliente: mismo repositorio y una pareja Vercel/Supabase por negocio. La identidad reside en `app_settings`; el código productivo no contiene URLs de clientes, emails, datos fiscales ni claves. No se introdujo un sistema de tenants compartidos ni módulos ajenos al alcance.

## Archivos principales

| Área | Archivos |
| --- | --- |
| Entrada y estilos | `index.html`, `src/main.js`, `src/application.js`, `src/styles.css` |
| Auth | `src/lib/supabase.js`, `src/auth/guard.js`, `src/auth/session.js`, `src/views/auth.js` |
| Componentes | `src/components/navigation.js`, `src/components/shell.js`, `src/components/ui.js` |
| Datos | `src/services/api.js` |
| Reglas y formato | `src/utils/business.js`, `src/utils/format.js` |
| Inventario | `src/views/inventory.js` |
| POS y tickets | `src/views/pos.js`, `src/views/sales.js` |
| Catálogo | `src/views/catalog.js`, `vercel.json` |
| Administración | `src/views/settings.js`, `src/views/business-module.js` |
| Inicio | `src/views/dashboard.js` |
| Entorno y dependencias | `.env.example`, `package.json`, `package-lock.json` |
| Backend | `supabase/config.toml`, `supabase/migrations/*.sql`, `supabase/functions/*/index.ts` |
| Verificación | `tests/*.test.js`, `tests/fixtures/ui.html`, `scripts/verify-public.mjs`, `scripts/review-backend.mjs` |

`.gitignore` ya excluía `.env`, `.env.local`, `.env.*`, `.vercel`, `node_modules` y `dist`, conservando `.env.example`. No se necesitó cambiarlo.

## Migraciones

Se aplicaron en orden y se registraron en `supabase_migrations.schema_migrations`:

1. `202610110001_core`: perfiles, configuración y helpers de autorización.
2. `202610110002_inventory`: catálogo central y Kardex; alta con stock inicial auditado.
3. `202610110003_operations`: ventas, ítems, pagos, reservas, entregas y transacciones.
4. `202610110004_catalog_users`: lectura pública limitada, invitaciones y límite de administradores.
5. `202610110005_business_module`: presupuestos/ítems, personal y turnos.
6. `202610110006_hardening`: revocación explícita de grants heredados para cada rol.
7. `202610110007_rpc_boundaries`: acceso a la transacción interna sólo desde wrappers POS/WEB.

Tablas públicas: `profiles`, `app_settings`, `products`, `stock_movements`, `sales`, `sale_items`, `payments`, `stock_reservations`, `deliveries`, `user_invitations`, `quotes`, `quote_items`, `staff_members`, `shifts`.

Todas tienen RLS. Los perfiles pueden leer su propio registro; los permisos habilitan las lecturas administrativas correspondientes. No hay políticas `USING(true)`. Las tablas financieras y de inventario no admiten escrituras directas desde el cliente. Configuración sólo permite actualizar las columnas previstas a usuarios con permiso `settings`. Los perfiles y permisos sólo cambian mediante procedimientos de superadministrador. Los datos públicos se entregan mediante un RPC que filtra productos activos/publicados y campos permitidos. La tabla privada de límites de pedidos también tiene RLS y carece de grants de cliente.

## RPC y reglas

RPC autenticados: `save_product`, `inventory`, `move_stock`, `create_pos_sale`, `confirm_payment`, `advance_delivery`, `cancel_web_order`, `reserve_invitation`, `update_admin`, `save_quote`, `accept_quote`, `save_staff`, `save_shift`.

RPC público de lectura: `get_public_catalog`.

RPC exclusivos de servidor: `create_web_order`, `check_order_rate`, `finish_invitation`.

- POS obtiene precios actuales desde PostgreSQL, normaliza productos repetidos, verifica stock disponible, calcula IVA incluido y registra venta/ítems/pago/movimientos en una sola transacción. El UUID de solicitud evita repetir la venta al reintentar.
- Disponible = físico menos reservas activas. Stock y reservas comparten un advisory lock transaccional, además de bloqueos de filas, para impedir sobreventa entre POS, movimientos y entregas.
- Web crea venta, ítems, pago pendiente, reservas y entrega. No permite insertar directamente como `anon`.
- Entrega sigue Pendiente → Preparado → Entregado. Exige cobro confirmado para entregar y consume reserva/stock/Kardex una sola vez. La cancelación libera reservas de pedidos sin cobrar; los pedidos cobrados requieren resolver su devolución fuera de este alcance.
- Efectivo y débito se registran como cobros manuales. Débito exige que el operador confirme previamente su terminal. Digital queda pendiente hasta confirmación manual en Pagos. No se simula ninguna aprobación de pasarela.
- Tickets leen ítems y precios históricos y usan una instantánea de identidad/IVA de la venta. Son comprobantes internos, no facturas fiscales.
- Presupuestos admiten productos centrales y conceptos libres, mantienen snapshots y permiten Enviado → Aceptado. No afectan stock.
- Personal y turnos sólo se escriben cuando está seleccionado ese módulo; se rechazan horarios superpuestos de una misma persona.
- El cupo máximo contempla administradores activos más invitaciones pendientes. Andes `super_admin` no ocupa cupo y está protegido contra edición desde la app.

## Edge Functions

`admin-invite-user`: valida el JWT mediante `auth.getUser`, vuelve a verificar perfil activo/superadmin, reserva cupo atómicamente, usa la API administrativa de invitaciones y crea el perfil correspondiente. Las credenciales administrativas sólo existen en el entorno del servidor. Si la invitación se envía y falla la finalización del perfil, la función conserva el cupo pendiente y devuelve una referencia para reconciliación; no informa éxito falso.

`create-web-order`: endpoint intencionalmente público, valida el cuerpo, limita solicitudes con una huella de IP salteada y llama al RPC exclusivo del servidor. CORS admite únicamente `SITE_URL`. Las reservas y precios se validan de nuevo en PostgreSQL.

Las dos funciones tienen `verify_jwt=false`: la primera usa validación explícita de sesión y rol dentro de la función; la segunda recibe pedidos anónimos por diseño. No se confía en el verificador de JWT legado para claves actuales. Referencias: [autenticación de funciones](https://supabase.com/docs/guides/functions/auth), [despliegue](https://supabase.com/docs/guides/functions/deploy).

## Configuración por instancia

- Frontend/Vercel: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` en Production, Preview y Development.
- Edge Functions: `SITE_URL` con el origen de esa instancia. Las claves de servidor/publishable se obtienen de los secrets predeterminados de Supabase, con compatibilidad con variables heredadas.
- Auth: registro público y sesiones anónimas deshabilitados; email habilitado, confirmación de email activa; Site URL productiva y redirección exacta `/?recovery=1`.
- Primera cuenta Andes: invitar desde el dashboard de Auth y asociar al usuario confirmado de Auth un perfil `super_admin` mediante una operación administrativa explícita. No hay bootstrap por email hardcodeado ni por `user_metadata`.
- Cada usuario define su propia contraseña desde el correo de invitación/recuperación.
- Para dominios de clientes fuera de los permitidos por el mailer de Supabase puede ser necesario configurar SMTP propio. No se configuró un proveedor inventado.
- Preview/localhost requieren configurar expresamente sus redirecciones de Auth y su origen en Edge; `SITE_URL` apunta al origen productivo. Un despliegue independiente de cliente debe tener su propio backend y origen.

## Verificación realizada

- `npm test`: ocho pruebas aprobadas, con múltiples casos y aserciones.
- PostgreSQL local (PGlite): instalación completa de migraciones, RLS y grants por defecto semejantes a Supabase, stock inicial auditado, venta con precio del servidor aunque el cliente envíe otro, IVA incluido, vuelto, reintento idempotente, rollback por stock insuficiente, carrito inválido, movimiento idempotente, reserva web, protección de reservas, cobro antes de entregar, doble entrega bloqueada, presupuesto real, cupo de invitaciones y rechazo a usuarios desactivados.
- `npm run build`: pasa.
- `deno check` para ambas Edge Functions: pasa.
- API remota: Auth responde; registro público deshabilitado; tablas privadas y RPC administrativos rechazan acceso anónimo; catálogo deshabilitado por defecto; invitaciones sin sesión devuelven 401; pedidos inválidos devuelven 400.
- Navegador local: guard de sesión, los once módulos, POS/IVA/vuelto, tema oscuro y ancho móvil sin desbordamiento general. `tests/fixtures/ui.html` es una fixture local y no está en `dist`.

Los ensayos SQL usan una base local descartable. No se insertaron productos, ventas, pagos ni pedidos de demostración en producción. Las pruebas locales no sustituyen una prueba de concurrencia multiusuario en infraestructura real ni la aceptación de un correo real. La validación de login y recorrido administrativo productivos requiere que el destinatario defina su contraseña e ingrese personalmente.

## Alcance y límites actuales

Se conserva una única fuente persistente para los módulos. No se importó el antiguo localStorage: esos datos permanecen en cada navegador y no se copiaron ni borraron. La instancia arranca sin datos operativos.

Catálogo y pedidos web arrancan apagados; sólo el comercio decide cuándo publicar. Pasarela online permanece deshabilitada hasta integrar un proveedor real. El módulo empresarial empieza en presupuestos y puede cambiarse desde Configuración. No se agregaron compras, proveedores, CRM, contabilidad, facturación electrónica, IA ni automatizaciones.

El cliente carga los datos autorizados por páginas y calcula las métricas sobre ellos. Es adecuado para la primera instancia; para historiales grandes conviene paginación visible y agregaciones SQL, conservando las mismas reglas de negocio. Las confirmaciones entre distintas cajas siempre se revalidan en el servidor; la vista se actualiza al completar operaciones o recargar.
