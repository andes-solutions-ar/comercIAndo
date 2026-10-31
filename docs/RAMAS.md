# Versiones de ComercIAndo

El repositorio mantiene dos ramas:

| Rama | Producto | Publicación | Supabase |
| --- | --- | --- | --- |
| `main` | ComercIAndo Negocios | https://comerciando.vercel.app | `stwwnqkeiluxllfcjcje` |
| `emprendedores` | ComercIAndo Emprendedores | https://comerciando-git-emprendedores-ia-analytics-s-projects.vercel.app | `olnpcaflwmiokeuctbke` |

La segunda URL es una preview de Vercel y conserva su protección de acceso.
Cada producto tiene su propia base, sus usuarios y sus datos. Las claves se
configuran mediante variables de entorno; nunca se copian entre las versiones.

## Consolidación del 31 de octubre de 2026

Las cuatro ramas auxiliares de stock, códigos de barras, escáner móvil y sonidos
tenían árboles idénticos a los commits squash ya incorporados a `main`:

| Rama auxiliar | Commit final | Snapshot equivalente en `main` |
| --- | --- | --- |
| `feat/stock-barcode-camera-20261030` | `4dd05d6` | `ee8fe00` |
| `fix/remake-stock-barcode-form-20261030` | `4298807` | `f76f9cc` |
| `feat/stock-product-mobile-scanner-20261030` | `a70f980` | `7093337` |
| `fix/remove-legacy-stock-scan-button-20261030` | `45533a6` | `fcfbb76` |

Se comprobó la igualdad de cada árbol antes de consolidar su historial con un
merge de estrategia `ours`. Así se conservan todos los commits originales y el
código vigente de Negocios, sin volver a aplicar snapshots anteriores. Las
referencias de las ramas auxiliares pueden retirarse porque su historial queda
alcanzable desde `main`.

`emprendedores` incorpora esa consolidación conservando su configuración y la
validación que exige su Supabase exclusivo. No se fusiona la configuración de
Emprendedores hacia `main`.

Las futuras integraciones entre las dos versiones deben revisar expresamente
las diferencias de configuración y conexión a bases de datos. No usar un merge
automático que sustituya el entorno de una versión por el de la otra.
