# comercIAndo · Remake v2.0 con escáner móvil

**Andes Solutions — entrega de desarrollo/prototipo.**

## Contenido

- `index.html`: portada para seleccionar experiencias.
- `administracion/index.html`: administración y Punto de Venta con lectura USB/BT, cámara integrada y botón «Vincular celular».
- `administracion/scanner-movil.html`: pantalla de escáner para el celular vinculada al POS.
- `tienda/index.html`: tienda multirubro del paquete v2.0.
- `demo/index.html`: presentación de la demo comercial.
- `demo/admin/index.html`: administración demostrativa **restringida**.
- `demo/admin/scanner-movil.html`: lector móvil **en modo demostración**, sin modificar carrito.
- `demo/tienda/index.html`: tienda de demostración, sin confirmar pedidos.
- `assets/`, `demo/assets/`: estilos y scripts de vinculación; conservar las rutas.

## Cómo probar la interfaz en una PC (sin publicar)

1. Descargá el ZIP y extraé su contenido completo.
2. Abrí `index.html` y elegí Administración.
3. Entrá al **Punto de Venta**. Encontrarás «Vincular celular» junto a «Cámara» y «Identificar».
4. Podés explorar el modal y continuar usando el lector USB o Bluetooth como teclado HID; el vínculo **entre PC y celular** requiere HTTPS y señalización por Internet.

## Cómo probar dos dispositivos de verdad

1. Publicá **toda** la carpeta de la versión que quieras compartir bajo un origen **HTTPS** (por ejemplo en Vercel). Los archivos deben mantener las rutas relativas tal como vienen en el ZIP. No basta con subir solo el HTML principal.
2. Abrí `https://TU-DOMINIO/administracion/index.html` en la PC, ingresá al **Punto de Venta** y hacé clic en **Vincular celular**.
3. La PC genera un enlace y un QR temporal (3 minutos) usando PeerJS para negociación de conexión entre navegadores.
4. Con el celular, escaneá el QR con su cámara o copiá el enlace. El teléfono debe tener Internet; no necesariamente estar en la misma red Wi-Fi.
5. La PC muestra una solicitud de conexión: seleccioná **Autorizar celular**.
6. En el teléfono, elegí **Iniciar cámara** y aceptá el permiso. También podés escribir el SKU o código de barras a mano.
7. Al reconocer el artículo, se envía **solo su código** a la PC. El POS valida el producto y la disponibilidad autorizada antes de agregarlo al carrito.
8. El teléfono muestra el resultado y te permite pulsar **Escanear siguiente**. Desconectá la sesión al terminar.

Si el QR no aparece por una falla del proveedor externo de biblioteca, podés copiar el enlace textual. Si el enlace no existe, revisá acceso HTTPS y señalización.

## Seguridad y restricciones

- **El código leído no cobra, no descuenta inventario ni crea un producto.** Solo intenta agregar una unidad al carrito en el POS completo.
- Un código desconocido, una presentación del proveedor o un producto sin cupo autorizado no agrega unidades.
- La demo comercial reconoce códigos pero **NO modifica el carrito ni permite registrar ventas o modificar stock**. Para clientes, distribuí solo el ZIP restringido.
- Cada conexión usa una clave aleatoria temporal y **autorización manual desde la PC**. El QR caduca en 3 minutos; la sesión aprobada permanece activa hasta la desconexión. Usá siempre un equipo propio y una red confiable.
- La cámara funciona localmente en el celular: el video **no se transmite** a la PC. Solo se envían códigos y resultados básicos de producto.
- Los datos de esta maqueta están en almacenamiento local del navegador. **No es un SaaS listo para producción**; no hay autenticación centralizada, aislamiento real de inquilinos, licenciamiento ni registro confiable de auditoría.
- El enlace puede contener la clave temporal de vinculación. No lo compartas con desconocidos; cualquier dispositivo con el enlace podría solicitar permiso, aunque la PC debe autorizarlo.
- Este prototipo usa el servicio público de señalización de **PeerJS**, no una infraestructura propia de Andes Solutions. Puede fallar por bloqueos de red, firewalls, NAT o indisponibilidad del servicio. Para comercializar se recomienda señalización propia y permisos/autorizaciones de servidor.

## Bibliotecas de red

- PeerJS `1.5.5` (cliente WebRTC, CDN jsDelivr).
- QRCode.js `1.0.0` (generación QR, CDN cdnjs).
- ZXing Browser `0.2.1` (alternativa de lectura de cámara, CDN jsDelivr).

Estas bibliotecas se cargan cuando se usan las funciones correspondientes y necesitan conexión a Internet. La API nativa BarcodeDetector se prioriza en navegadores compatibles.

## Validación efectuada

- Se comprobó la sintaxis JavaScript de los complementos.
- Pruebas automatizadas **con emulación del canal de conexión**: QR y panel de autorización; envío de código desde teléfono; unidad añadida al carrito de administración; código no encontrado sin alta; demo sin mutaciones; respuesta y confirmación visual en viewport de 390 px.
- Se comprobó la presencia y estructura de los archivos en los ZIP.
- **Pendiente:** vinculación real con dos dispositivos físicos sobre HTTPS, permisos de cámara, lector USB/BT físico, conectividad WebRTC en redes heterogéneas, Safari/iOS/Android, pruebas de carga y seguridad antes de comercialización.

**No usar este prototipo para cobros o inventarios reales.**
