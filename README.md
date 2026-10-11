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
