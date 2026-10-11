# ComercIAndo

Sistema de punto de venta y gestión comercial para almacenes y comercios minoristas.

Producto de Andes Solutions.

## Planes

- **Start**: tienda/catálogo + panel + ventas/reservas + stock básico + 1 usuario.
- **Commerce**: todo Start + pasarela de pagos + hasta 3 usuarios + stock básico.
- **Premium**: stock Pro + entrega segura + POS + pasarela de pagos + hasta 3 usuarios + nómina/turnos o presupuestos/cotizaciones.

## Principio de arquitectura

ComercIAndo mantiene una sola base de código. Las funciones se habilitan por plan mediante feature flags, evitando tres aplicaciones separadas y reduciendo el costo de mantenimiento.

## Base funcional

El producto toma como referencia conceptual Burger Control para reutilizar patrones ya validados de ventas, inventario, compras, proveedores, trazabilidad, usuarios y multi-sucursal, pero ComercIAndo se desarrolla en este repositorio de forma independiente.
