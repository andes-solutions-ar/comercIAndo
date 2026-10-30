# Escáner móvil para cargar productos desde Stock

## Flujo
1. Administración → Stock → Nuevo producto.
2. En el campo **Código de barras**, pulsar **Escanear con celular** (opción distinta de Cámara de PC).
3. La PC genera QR temporal de 3 minutos mediante el lector remoto preexistente.
4. Abrir el enlace en el teléfono, autorizar la solicitud en la PC e iniciar la cámara del celular.
5. Escanear EAN, UPC o Code 128. Únicamente el valor del código viaja por WebRTC y aparece en `#npBarcode` en el formulario abierto.
6. Completar nombre, categoría, precio y existencias; guardar **desde la PC**. La lectura no crea productos ni altera existencias.

## Seguridad
- La PC exige aceptación manual y un token temporal de vinculación.
- No se envían imágenes ni video. La sesión se limita al propósito elegido: **producto** o **punto de venta**.
- La PC rechaza escaneos en modo producto cuando el formulario se cierra, el código es inválido o pertenece a otro artículo/presentación.
- El POS mantiene su flujo anterior, independiente del de carga de productos.
- La cámara de PC, la entrada manual y los lectores HID siguen funcionando.
- PeerJS utiliza señalización pública; antes de comercializar masivamente, evaluar señalización propia, aislamiento por cuenta y permisos validados por servidor.

## Validaciones
- Analizador de sintaxis: scripts inline del remake + scripts de vinculación PC/móvil.
- Preview Vercel compilada en la rama antes del merge.
- Simulación de PeerJS: autorización `purpose=product`, escaneo `0001234567890`, código ingresado a `#npBarcode`, ninguna invocación al POS.
- Pendiente: prueba física PC + celular (iOS/Android), cámara, QR, bloqueo de terceros y reconexión en redes separadas.
