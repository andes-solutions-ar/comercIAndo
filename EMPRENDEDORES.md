# ComercIAndo Emprendedores

Rama independiente `emprendedores`, creada desde `origin/main` en `fcfbb76`.
Carpeta local: `C:/Users/PAPA/Desktop/ALMACEN APP/comerciando-emprendedores`.

## Base propia

El proyecto es **COMERCIANDO EMPRENDEDORES**, en ANDES SOLUTIONS, plan Free,
São Paulo, con identificador `olnpcaflwmiokeuctbke`.
No se copian usuarios, ventas, productos ni credenciales del proyecto principal.

Una vez creado, aplicar las migraciones de esta rama y publicar sus Edge Functions
en ese proyecto nuevo. Configurar Auth y `SITE_URL` con la URL de Emprendedores.
El primer administrador se habilita de forma explícita para la base nueva.

Copiar `.env.example` a `.env.local` y completar las tres variables del proyecto
nuevo. `.env.local` no se versiona. Nunca copiar el `.env.local` del checkout principal.

## Vercel

Si se utiliza el proyecto Vercel existente, configurar las tres variables como
overrides de **Preview, rama `emprendedores`**, sin modificar Production ni los
valores generales de otras ramas. El dominio productivo sigue apuntando a `main`.

Vite detiene `dev` y `build` si falta la configuración propia, si el project ref no
coincide con la URL o si corresponde al Supabase principal (actual o anterior).
Hasta completar esa configuración, una preview no debe publicarse conectada a la
base principal; el build fallará expresamente.

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
