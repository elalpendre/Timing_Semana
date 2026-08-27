# El Alpendre · Timing semanal

Timing semanal, conteo de stock y pedidos a distribuidores, para **web y móvil**.
La misma app que ya usabas, ahora con los datos en un servidor: se cuenta desde
cualquier teléfono y el Controller lo ve al momento.

---

## Qué cambia respecto al archivo HTML

Nada de lo que se ve. El diseño, los colores, los botones y las cuentas son los
mismos. Lo que se añade va por debajo:

| | Antes (archivo HTML) | Ahora |
|---|---|---|
| Dónde viven los datos | Solo en ese teléfono | En el servidor, y también en cada teléfono |
| Verlo desde otro móvil | Había que pasar un código a mano | Se ve solo, a los pocos segundos |
| Sin internet | Funcionaba | Funciona igual, y sube los cambios cuando vuelve la señal |
| Instalarlo en el móvil | No | Sí, como una app más (pantalla completa, con su icono) |
| Copias de seguridad | A mano | Las 40 últimas versiones, guardadas solas |

---

## Ponerlo en marcha (unos 10 minutos)

### 1 · Subir el proyecto a Vercel

1. Entrá en [vercel.com](https://vercel.com) y creá una cuenta (con GitHub es lo más rápido).
2. **Add New → Project** y elegí este repositorio.
3. No hay que configurar nada: ni framework, ni comando de build. **Deploy**.

Te queda una dirección tipo `https://timing-semana.vercel.app`.

### 2 · Conectar la base de datos

Sin base de datos la app abre, pero **los cambios no se guardan de verdad**:
el cartelito de arriba dirá `SIN BASE · modo prueba`.

1. En tu proyecto de Vercel: pestaña **Storage → Create Database**.
2. Elegí **Upstash for Redis** (tiene un plan gratuito de sobra para esto).
3. **Connect** al proyecto. Vercel añade solo las variables que hacen falta.
4. Pestaña **Deployments → ⋯ → Redeploy** para que las tome.

Listo: el cartelito pasa a `EN LA NUBE`.

> Si preferís Upstash por fuera de Vercel, creá la base en
> [upstash.com](https://upstash.com) y añadí a mano, en **Settings → Environment
> Variables**, `UPSTASH_REDIS_REST_URL` y `UPSTASH_REDIS_REST_TOKEN`.

### 3 · Poner una clave de acceso (recomendado)

Sin esto, cualquiera que sepa la dirección puede ver y cambiar los datos.

1. **Settings → Environment Variables** → añadí `ALPENDRE_KEY` con la clave que quieras
   (por ejemplo `alpendre2026`).
2. **Redeploy**.
3. Cada dispositivo entra **una sola vez** por
   `https://tu-direccion.vercel.app/?clave=alpendre2026`.
   La clave queda guardada en ese teléfono; después ya se entra por la dirección normal.

Las claves de los departamentos (Controller `0785`, Carne `1001`…) son otra cosa:
son las de dentro de la app, y se cambian en **Controller → Equipo y claves**.

### 4 · Instalarlo en los móviles

- **Android (Chrome):** abrí la dirección → menú ⋮ → *Instalar aplicación*.
- **iPhone (Safari):** abrí la dirección → Compartir → *Añadir a pantalla de inicio*.

Queda con su icono, a pantalla completa, y abre aunque no haya cobertura.

---

## Cómo funciona la sincronización

- Cada cambio se guarda **al instante en el propio teléfono** y, un segundo y medio
  después, se sube al servidor.
- Cada dispositivo pregunta al servidor cada 12 segundos si hay algo nuevo.
- Si lo hay y **no estás escribiendo**, se actualiza solo.
  Si estás escribiendo, aparece abajo un botón *«Hay cambios nuevos · tocá para verlos»*
  y se actualiza cuando vos quieras.
- Si dos personas guardan a la vez, se queda el cambio más reciente y el otro
  no se tira: queda guardado en ese teléfono por si hiciera falta recuperarlo.
- **Sin internet:** todo sigue funcionando y el cartel de arriba dice `SIN CONEXIÓN`.
  En cuanto vuelve la señal, sube solo.

El cartelito de arriba, al lado de «GUARDADO», dice siempre cómo está:

| Dice | Significa |
|---|---|
| `EN LA NUBE` | Al día con el servidor |
| `SUBIENDO` | Mandando los últimos cambios |
| `SIN CONEXIÓN` | Sin señal · se guarda en el teléfono y sube después |
| `SIN CLAVE` | El servidor pide clave · entrá una vez con `?clave=…` |
| `SIN BASE` | Falta conectar la base de datos (paso 2) |

---

## Probarlo en tu ordenador

```bash
node servidor-local.mjs      # http://localhost:3000
```

Sin base de datos conectada guarda en memoria: sirve para probar, pero se borra
al parar el servidor.

---

## Cómo está montado

```
public/
  index.html        la app entera (igual que el HTML de siempre)
  sync.js           la capa que sube y baja los datos
  sw.js             para que se instale y abra sin internet
  manifest.json     nombre e iconos de la app
  icono-*.png       iconos
api/
  estado.js         GET lee el plan · PUT lo guarda (con control de versión)
  version.js        solo el número de revisión (es lo que se consulta cada 12 s)
  historial.js      las 40 copias anteriores, para recuperar
  _store.js         habla con Upstash Redis · comprime con gzip
  _comun.js         clave de acceso y lectura del cuerpo
servidor-local.mjs  para probar en tu ordenador
vercel.json         cabeceras y caché
```

`sync.js` **no toca la app**: se engancha a `localStorage`, que es por donde la app
ya guardaba. Por eso el HTML se pudo dejar tal cual.

### Recuperar una versión anterior

```
https://tu-direccion.vercel.app/api/historial          → lista de copias
https://tu-direccion.vercel.app/api/historial?rev=12   → esa copia entera
```

(Si pusiste `ALPENDRE_KEY`, hace falta la cabecera `x-alpendre-key`.)

---

## Bugs corregidos

Ver [`docs/CORRECCIONES.md`](docs/CORRECCIONES.md).
