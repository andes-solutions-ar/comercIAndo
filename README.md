> **Publicación actual: Remake v2.0.** La portada `/` y las rutas
> `/administracion/`, `/tienda/`, `/demo/`, `/demo/admin/` y `/demo/tienda/`
> corresponden al paquete HTML suministrado. Su administración y tienda usan
> almacenamiento local y no están conectadas al backend anterior. La demo conserva
> sus restricciones. El escáner móvil utiliza PeerJS y requiere HTTPS e Internet.
> Guía original: [LEEME_PRIMERO.md](public/LEEME_PRIMERO.md).
>
> El panel autenticado anterior se conserva en `/panel/`, y su catálogo en
> `/catalogo`. Los enlaces de invitación/recuperación emitidos para `/` se derivan
> al panel conservando sus parámetros. Supabase, sus datos y sus permisos no se
> modifican en esta publicación. Las secciones siguientes documentan ese panel.
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
