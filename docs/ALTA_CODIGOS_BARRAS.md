# Alta de productos por código de barras — Stock

## Implementación propuesta en la rama

- Stock Pro: botones **Agregar producto** y **Escanear código** para usuarios con permiso `products`.
- Formulario de productos: código principal opcional, ingreso manual, lector HID y cámara.
- Escaneo de código existente: abre la edición del producto; desconocido: abre alta con código precargado.
- `product_barcodes` conserva códigos como texto (incluyendo ceros a la izquierda), permite ampliaciones futuras a códigos secundarios y exige unicidad.
- `save_product_with_barcode` mantiene en una sola transacción el alta/edición y su asociación. Escanear no modifica stock.
- Usuarios que solo tengan permiso `stock` no pueden crear productos; las reglas del backend preservan permisos.

## Compatibilidad

- `BarcodeDetector` nativo cuando es compatible, con fallback ZXing versionado para otros navegadores.
- El fallback se obtiene por ahora de `https://esm.sh/@zxing/browser@0.2.1?bundle`. **Antes de producción**, empaquetarlo con `package-lock.json` y verificar CSP, disponibilidad y seguridad de la dependencia.
- La cámara necesita HTTPS y permiso. Entrada manual y lector USB/Bluetooth siguen disponibles.
- Las imágenes se procesan en el navegador: no se transmiten a Supabase.

## Despliegue seguro

1. Identificar el proyecto correcto de Supabase (no suponer que es `ia-analytics`).
2. Aplicar y probar `supabase/migrations/202610300001_product_barcodes.sql` en el backend correcto **antes** de desplegar el frontend.
3. Verificar RLS, permisos, la restricción UNIQUE y la atomicidad del guardado.
4. Ejecutar `npm ci`, `npm test`, `npm run build` y pruebas manuales en Preview.
5. Probar Android, iPhone, lector HID, permisos denegados, cancelación de cámara, códigos duplicados y stock inicial auditado.
6. Revisar la rama antes de integrar a `main`.

## Límites actuales

- Escanear permite identificar y asociar un código, pero no descarga automáticamente nombre, imagen o precio de un catálogo externo.
- La lectura de estos códigos desde el Punto de Venta deberá implementarse en una integración posterior.
- Esta rama no aplica migraciones ni despliega a producción.
