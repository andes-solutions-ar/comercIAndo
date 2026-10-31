# ComercIAndo Emprendedores

Rama independiente `emprendedores`, creada desde `origin/main` en `fcfbb76`.
Carpeta local: `C:/Users/PAPA/Desktop/ALMACEN APP/comerciando-emprendedores`.

El desarrollo de ComercIAndo Emprendedores se realiza en `edition-emprendedores`
y las implementaciones finales se integran en `emprendedores`. Negocios utiliza
`edition-negocios` para trabajar y `main` para publicar. Se conserva el historial
consolidado de las antiguas ramas auxiliares y el entorno propio de cada producto.
Ver [modelo de ramas y publicaciones](docs/RAMAS.md).

## Base propia

El proyecto es **COMERCIANDO EMPRENDEDORES**, en ANDES SOLUTIONS, plan Free,
São Paulo, con identificador `olnpcaflwmiokeuctbke`.
No se copian usuarios, ventas, productos ni credenciales del proyecto principal.

Se instalaron las nueve migraciones de esta rama, con 18 tablas públicas y RLS
habilitado en todas ellas. Se publicaron `remake-store` y `admin-invite-user`.
Auth y `SITE_URL` apuntan a la URL de Emprendedores. El registro público está
deshabilitado; el primer administrador fue invitado y habilitado explícitamente
en esta base nueva. El propietario completó el primer ingreso y se verificó el
panel autenticado con el rol de Superadministrador.

Copiar `.env.example` a `.env.local` y completar las tres variables del proyecto
nuevo. `.env.local` no se versiona. Nunca copiar el `.env.local` del checkout principal.

## Vercel

En el proyecto Vercel existente, las tres variables están configuradas como
overrides de **Preview, rama `emprendedores`**. El dominio productivo sigue
apuntando a `main`.

Preview: https://comerciando-git-emprendedores-ia-analytics-s-projects.vercel.app

La preview conserva la protección de acceso de Vercel; puede requerir iniciar
sesión allí antes de entrar al login propio de la aplicación. No se modificó la
protección del proyecto principal.

Vite detiene `dev` y `build` si falta la configuración propia o si el project ref
y la URL no corresponden exactamente a `olnpcaflwmiokeuctbke`. Ningún otro proyecto
Supabase puede utilizarse en esta rama sin modificar explícitamente esa validación.

## Verificación inicial

Build correcto y 15 pruebas aprobadas. Catálogo público vacío, tienda cerrada y
acceso anónimo denegado a datos privados y RPC administrativos. La función de
invitaciones rechaza peticiones sin sesión; la tienda rechaza el origen del
ComercIAndo principal. La preview se verificó con autenticación de Vercel y su
bundle referencia únicamente el Supabase nuevo.

El Security Advisor reportó cero errores; mantiene los avisos de las RPC
SECURITY DEFINER intencionales y la protección contra contraseñas filtradas
deshabilitada por defecto, como en la base de origen. No se desactivaron controles
de sesión ni de rol para silenciar avisos. No se crearon operaciones comerciales
de prueba en esta base.

Para desarrollar después de configurar la base:

```sh
npm ci
npm run dev
```

Para validar:

```sh
node --test tests/emprendedores-isolation.test.js
npm run build
```
