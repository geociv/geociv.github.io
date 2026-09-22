# GeoCiv Cuentas

Aplicación para llevar el control de **ingresos y egresos** de GeoCiv, con **reportes diarios, semanales y mensuales**, gráficas y exportación a PDF/Excel.

Es una **PWA** (Progressive Web App): una sola app que corre igual en **PC y celular**, se instala desde el navegador sin pasar por Play Store / App Store, y **funciona sin internet**.

## Filosofía: local-first

- Todos los datos se guardan en el **dispositivo** (IndexedDB). La app funciona 100% offline.
- La **sincronización en la nube** (PC ↔ celular) viene **horneada por el desarrollador** (no la configura el cliente): las credenciales de Supabase se ponen en `.env` al compilar. Es automática (al abrir, al cambiar datos, al volver online y cada 45s). Si no se configura `.env`, la app corre 100% local y los datos se pasan con **Exportar / Restaurar respaldo**.

## Logo de la empresa

Coloca el logo de GeoCiv en `public/logo.png` (PNG cuadrado, idealmente 512×512). Aparece en el encabezado. Si no existe, se usa el emblema `public/icon.svg` como respaldo.

## Requisitos

- Node.js 20 o superior.

## Desarrollo

```bash
npm install
npm run dev
```

Abre la URL que muestra la terminal (ej. `http://localhost:5173`). El comando `dev` también expone la app en la red local (línea "Network:"), útil para probar en el celular por WiFi.

## Compilar para producción

```bash
npm run build
```

Genera la carpeta `dist/` con archivos estáticos. Formas de entregarla al cliente:

1. **Hosting estático gratis** (recomendado para que se instale como PWA en el celular): subir `dist/` a Netlify, Cloudflare Pages o GitHub Pages. La PWA solo se puede "instalar" y sincronizar el service worker desde **https** o `localhost`.
2. **En la PC del cliente:** servir la carpeta localmente, por ejemplo `npx serve dist`, y crear un acceso directo.

## Instalar como app en el celular

1. Abrir la URL (https) en Chrome/Safari del celular.
2. Menú del navegador → **"Agregar a pantalla de inicio" / "Instalar app"**.
3. Queda como un ícono normal y abre a pantalla completa.

## Sincronización PC ↔ celular (Supabase — la configura el desarrollador)

1. Crear una cuenta gratuita en [supabase.com](https://supabase.com) **a nombre de GeoCiv** y un proyecto nuevo.
2. En el proyecto, abrir **SQL Editor** y ejecutar:

   ```sql
   create table if not exists transactions (
     id text primary key,
     workspace text not null,
     type text not null,
     amount numeric not null,
     "categoryId" text not null,
     date text not null,
     description text,
     note text,
     "createdAt" bigint not null,
     "updatedAt" bigint not null,
     deleted boolean default false
   );

   create table if not exists categories (
     id text primary key,
     workspace text not null,
     name text not null,
     scope text not null,
     color text not null,
     "createdAt" bigint not null,
     "updatedAt" bigint not null,
     deleted boolean default false
   );

   create index if not exists idx_tx_ws_updated on transactions (workspace, "updatedAt");
   create index if not exists idx_cat_ws_updated on categories (workspace, "updatedAt");
   ```

   Y las dos tablas auxiliares (adelantos a trabajadores y saldos por cobrar).
   Si no se crean, la app funciona igual pero esos dos registros **no se
   sincronizan** entre la PC y el celular: se quedan en cada dispositivo.

   ```sql
   create table if not exists advances (
     id text primary key,
     workspace text not null,
     account text not null,
     worker text not null,
     amount numeric not null,
     date text not null,
     note text,
     "createdAt" bigint not null,
     "updatedAt" bigint not null,
     deleted boolean default false
   );

   create table if not exists pendings (
     id text primary key,
     workspace text not null,
     account text not null,
     client text not null,
     amount numeric not null,
     date text not null,
     "categoryId" text,
     note text,
     "sourceTxId" text,
     "settledTxId" text,
     "settledAt" bigint,
     "createdAt" bigint not null,
     "updatedAt" bigint not null,
     deleted boolean default false
   );

   create index if not exists idx_adv_ws_updated on advances (workspace, "updatedAt");
   create index if not exists idx_pend_ws_updated on pendings (workspace, "updatedAt");
   ```

3. Habilitar **RLS** en ambas tablas con una política sencilla (o mantenerlas sin RLS para uso interno con la anon key). Para un solo cliente, lo más simple es una política que permita todo con la anon key.
4. En **Project Settings → API**, copiar la **Project URL** y la **anon public key**.
5. Crear el archivo `.env` (a partir de `.env.example`) con:

   ```
   VITE_SUPABASE_URL=https://TU-PROYECTO.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJhbGciOi...
   VITE_SYNC_WORKSPACE=geociv
   ```

6. Compilar con `npm run build`. La sync queda activa y automática; el cliente no configura nada.

> **Nota honesta sobre el plan gratuito:** los proyectos gratis de Supabase se pausan tras ~7 días **sin actividad** (una empresa que lo usa seguido no se pausa) y tienen 500 MB de base de datos (años de movimientos en texto). Como Supabase es open-source y los datos se pueden exportar, no hay riesgo de quedar atrapado.

## Estructura del proyecto

```
src/
  db/          Modelo de datos y acceso local (Dexie / IndexedDB)
  lib/         Lógica: dinero, fechas, reportes, exportación PDF/Excel, sync
  state/       Proveedor de datos reactivo (React Context + Dexie liveQuery)
  components/  Vistas: Dashboard, Movimientos, Reportes, Ajustes, formulario
```

## Funciones incluidas

- Registro de ingresos/egresos con categoría, fecha, descripción e **información extra opcional**.
- Categorías configurables (nombre, color, tipo) con set inicial pensado para obra civil.
- Tablero con balance total, del día y del mes, y últimos movimientos.
- Buscador y filtro de movimientos; editar y eliminar.
- Reportes **diario / semanal / mensual** con navegación por período, resumen, gráfica de barras y desglose por categoría.
- Exportación a **PDF** y **Excel**.
- **Adelantos a trabajadores**: se llevan aparte y no afectan el balance.
- **Saldos por cobrar**: cuando se cobra un abono inicial (ej. 50%), el resto queda anotado sin sumar al balance.
  Al cobrarlo se registra el ingreso real y el pendiente se liquida. El total aparece en el tablero y en los reportes.
- **Respaldo / restauración** completa en archivo JSON (incluye adelantos y saldos por cobrar).
- **Importación desde Excel** de movimientos históricos (ver abajo).
- **Borrar todos los datos** (Ajustes) para volver a importar desde cero: descarga un respaldo antes y el borrado se sincroniza a todos los dispositivos.
- Sincronización opcional en la nube.

## Importar histórico desde Excel

En _Ajustes → Importar desde Excel_:

1. **Descargar plantilla Excel** — trae las columnas exactas y una hoja *Instrucciones* que explica cada una:
   `Fecha, Tipo, Monto, Sección` (o `Proyecto`)`, Subsección, Tipo de sección, Descripción, Método, Banco, Nota`.
2. Pegar/acomodar los datos históricos en esa plantilla.
3. Elegir **cuenta por defecto** (para filas sin columna `Cuenta`) y el **formato de fecha** (Día/Mes/Año o Mes/Día/Año).
4. Subir el archivo y revisar la **vista previa**: muestra las primeras filas ya interpretadas y lista las filas con problemas (se omiten, no bloquean el resto).
5. Confirmar. Las **secciones y subsecciones que no existan se crean automáticamente**.

### De qué tipo queda cada sección

Al registrar un movimiento, el desplegable de **Sección** solo muestra las que
corresponden: si es un ingreso, no aparecen secciones de gasto como "Arriendo".
Eso lo decide el tipo de cada sección (Ingreso / Egreso / Ambos), que se
establece así:

- **Se deduce de la columna `Tipo`**: si en el archivo una sección solo tiene
  egresos, queda como Egreso; si tiene de los dos, queda como Ambos.
- **Columna opcional `Tipo de sección`** (`Ingreso`, `Egreso` o `Ambos`): sirve
  para declararlo a mano. Si contradice a las filas del archivo, la sección queda
  como **Ambos**, para que ningún movimiento se quede sin dónde registrarse.
- La **vista previa** lista las secciones detectadas con su tipo antes de importar.
- Después se puede cambiar el tipo de cualquier sección en **Ajustes → Secciones**,
  tocando la etiqueta de color.

Notas:

- Acepta `.xlsx`, `.xls` y `.csv`. Reconoce fechas reales de Excel, texto `dd/mm/aaaa` y `aaaa-mm-dd`, y montos con coma o punto decimal (`1.250,75`).
- En la cuenta **Oficina**, si no existe la columna `Tipo` se asume `Egreso` en todas las filas y la vista previa lo avisa. En **Proyectos** la columna `Tipo` es obligatoria.
- Dentro de un mismo día, los movimientos quedan en el mismo orden que traía el Excel.
- Conviene usar **Exportar respaldo** antes de importar (hay un botón para eso en la misma pantalla).
