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

## Arquitectura

ComercIAndo mantiene **una sola base de código**. Las funciones y límites se habilitan según el plan contratado mediante configuración de capacidades (feature flags/entitlements), evitando mantener tres aplicaciones diferentes.

## Reglas de alcance

No incorporar funciones no aprobadas al producto. En particular, no agregar compras, proveedores, contabilidad, facturación, CRM, inteligencia artificial, automatizaciones ni recursos humanos avanzados salvo incorporación explícita posterior.

Stock Básico y Stock Pro son capacidades distintas. START y COMMERCE utilizan Stock Básico; PREMIUM utiliza Stock Pro.

## Base técnica

Burger Control puede utilizarse como referencia técnica para patrones de interfaz y flujos ya resueltos, pero ComercIAndo es un producto independiente y no debe heredar automáticamente módulos gastronómicos ni funcionalidades fuera del alcance comercial definido.

Ver `docs/product-context.md` y `src/config/plans.js`.

## Configuración de Supabase

El cliente único está en `src/lib/supabase.js` y consume exclusivamente
`VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY` mediante `import.meta.env`.
Si falta alguna variable, emite un aviso y exporta `supabase = null` junto con
`hasSupabaseConfig = false`, evitando llamar a `createClient` con valores vacíos.

Para desarrollo local:

1. Ejecutar `npm ci`.
2. Copiar `.env.example` a `.env.local`.
3. Completar `VITE_SUPABASE_PUBLISHABLE_KEY` en `.env.local` con la publishable key del proyecto.
4. Ejecutar `npm run dev`. Reiniciar Vite si se modifican las variables.
5. Ejecutar `npm run build` para verificar la compilación.

Los archivos `.env`, `.env.local` y `.env.*` se excluyen de Git; solamente
`.env.example` se versiona. Las variables `VITE_*` son públicas en el navegador:
usar únicamente la publishable key, nunca credenciales privadas.

En el proyecto Vercel `comerciando`, configurar ambas variables para
**Production**, **Preview** y **Development**:

- `VITE_SUPABASE_URL`: `https://ilvdzyhpnhgkkcyptxtf.supabase.co`.
- `VITE_SUPABASE_PUBLISHABLE_KEY`: configurar manualmente en Vercel, sin agregarla al repositorio.

Vite incorpora estas variables al compilar. Un cambio en Vercel requiere un nuevo
build y despliegue para aplicarse al frontend.

`src/main.js` importa el cliente centralizado para que Vite incluya su
configuración por variables de entorno. La autenticación y las operaciones
remotas todavía no están conectadas. El build de la página por sí solo no
confirma una conexión remota a Supabase.

## Frontend aceptado

La interfaz aceptada proviene del archivo suministrado `index (2).html`.
`index.html` contiene la estructura, `src/styles.css` conserva la tipografía
Instrument Sans, las paletas y los temas claro/oscuro, y `src/main.js` contiene
la navegación y las interacciones del diseño. `public/favicon.svg` utiliza
el símbolo de marca del mismo archivo.

Se corrigieron el arranque con tema oscuro del sistema y el desborde horizontal
de las tablas en móvil, conservando la apariencia de escritorio.

Inicio, Punto de venta, Ventas y pedidos y Stock Pro muestran los datos de
demostración del archivo aceptado. El carrito, las cantidades, las categorías,
los métodos de pago y los avisos del POS son simulaciones locales en memoria:
no registran ventas, no procesan pagos ni modifican stock real. Las restantes
secciones conservan los placeholders del diseño; no se agregaron módulos.
Los datos anteriores de localStorage no se borran ni se migran.

Las variables `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY` están
configuradas en el proyecto Vercel `comerciando` para Production, Preview y
Development. La clave se mantiene fuera del repositorio y el ejemplo permanece
vacío. El cliente se inicializa con esas variables; se verificó una consulta
de solo lectura al endpoint de configuración de autenticación de Supabase.
Los flujos de login, membresías y datos del negocio siguen pendientes de las
próximas etapas; esta conexión no crea ni modifica tablas.

## Próximas etapas de la arquitectura multiempresa

Orden aprobado: autenticación, negocios/tenants, usuarios, membresías y permisos,
productos, stock, ventas/POS y pagos.

La relación será **Usuario → Membresía → Negocio → Datos del negocio**.
Productos, ventas, movimientos de stock y accesos administrativos deberán
pertenecer a un negocio. El acceso se comprobará mediante membresías y políticas
RLS en Supabase; los límites del plan no sustituyen esa autorización.
En esta etapa no se crean tablas, políticas ni migraciones y no se trasladan
datos de localStorage.
