# Bugs encontrados y corregidos

Repaso del HTML original. **No se tocó ni el diseño ni el funcionamiento**: solo
cosas que estaban rotas o que no hacían lo que decían hacer.

---

## 1 · Se caía la app al soltar un producto en «Sin ubicar»

**Dónde:** `cajaSinUbicar()`, en Neveras y almacenaje.

Al arrastrar un producto y soltarlo encima de otro de la lista «Sin ubicar», el
código llamaba a `soltarEnCam(q, p, k)` con una variable `k` **que no existía en
esa parte**. El navegador cortaba el JavaScript ahí mismo: la pantalla se quedaba
a medio dibujar hasta recargar.

**Arreglado:** las dos listas (la de dentro de una nevera y la de «Sin ubicar»)
pasan por la misma función. Soltar en «Sin ubicar» ahora deja el producto sin
sitio, que es lo que se espera.

---

## 2 · Los botones «Guardar» y «Cargar» se salían de la pantalla

**Dónde:** `anclarCaja()` — afectaba a todas las ventanas.

Las ventanas se colocan pegadas al botón que las abrió. El sitio se calculaba
**una sola vez, al abrirlas**. Las que crecen después —*Pegar las ventas* cuando
aparece la vista previa, la ficha del distribuidor al ir añadiendo productos,
«Más ajustes» al desplegarse— crecían hacia abajo y el pie con **Cancelar** y
**Guardar** se iba por debajo del borde. En el móvil no había forma de tocarlo.

Medido antes del arreglo (pantalla de 844 px de alto):

```
recién abierta:      botón OK termina en 819 px  ✅ dentro
con la vista previa: botón OK termina en 947 px  ❌ fuera
```

**Arreglado:** un vigilante de tamaño (`ResizeObserver`) recoloca la ventana en
cuanto cambia de alto. Ahora, en el mismo caso, el botón termina en 614 px.

---

## 3 · «Traer conteo de los almacenes» no hacía nada

**Dónde:** botón `#btnCargarProd` en Sala, Limpieza y Menaje.

Escribía el resultado en `p.conteo`, un campo que **la app no lee en ningún
sitio**. El conteo de verdad vive en `p.cnt.contadoBase`. El botón decía «12
productos actualizados» y no cambiaba ni un número.

**Arreglado:** escribe donde corresponde, con `ponerConteo()`.

---

## 4 · «Cargar la producción de hoy» perdía los bultos en Pizza y Cocina

**Dónde:** el mismo botón, rama de Pizza y Cocina.

Creaba los bultos en unas cámaras llamadas `"frio"` y `"pase"` que **ya no
existen** en esos departamentos (ahora son `pzpase1`, `pan`, `cocpase1`…). Los
bultos se guardaban con un sitio inexistente y no aparecían en ninguna nevera:
se perdían.

**Arreglado:** usa la primera cámara real del departamento.

---

## 5 · La app decía que pulsaras un botón que no existe

**Dónde:** texto de la caja «Enviar al Controller».

Decía: *«tocá 📲 Mandar el conteo para que le llegue al Controller — si no, él no
lo ve»*. Ese botón **no estaba en ninguna parte**: las funciones que lo hacían
(`compartirConteo`, `codigoConteo`) existían pero no estaban conectadas a nada.
El encargado contaba, leía eso y no encontraba cómo mandarlo.

**Arreglado:** con el servidor, el conteo le llega al Controller solo, y el texto
lo dice así. La forma manual sigue estando, como salida de emergencia, dentro de
**Enviar al Controller → «📲 Pasarlo a mano»** (por si un móvil se queda sin
internet), y **📥 Recibir conteo** sigue funcionando igual.

---

## 6 · Una puesta al día que fallaba tumbaba a todas las demás

**Dónde:** `aplicarPaquete()` y el arranque.

Las 19 funciones que ponen al día los planes viejos iban dentro de un solo
`try{ … }catch{}`. Si una fallaba —por ejemplo con datos a medias de una versión
anterior— **las siguientes ni se ejecutaban**, y el plan quedaba a medio migrar
sin que nadie se enterara.

**Arreglado:** cada paso va en su propio `try/catch` y, si algo falla, lo avisa
por consola. Las demás siguen.

---

## 7 · Cargar una copia de seguridad se saltaba las puestas al día

**Dónde:** `#fileIn`, al abrir un archivo de copia.

Metía el archivo directamente sin pasar por las migraciones, y dejaba el
contador de identificadores en 5000, que podía **chocar con identificadores que
ya venían en el archivo** (dos productos con el mismo id).

**Arreglado:** pasa por `aplicarPaquete()`, igual que el arranque normal.

---

## 8 · `confirm()` en un sitio donde el resto de la app no lo usa

**Dónde:** `pasarDeArea()`, al mandar un producto a otro departamento.

Toda la app evita `confirm()` a propósito (hay un comentario que lo dice: algunos
navegadores lo bloquean). Este sitio se había quedado con el `confirm()` del
navegador. Además calculaba la posición del producto **antes** de preguntar, así
que si mientras tanto cambiaba algo, borraba el que no era.

**Arreglado:** usa la ventana propia de la app y recalcula la posición después de
confirmar.

---

## 9 · El acento se comía a sí mismo

**Dónde:** `norm()`.

La expresión que quita tildes llevaba los caracteres de acento **escritos
sueltos** dentro de los corchetes. Según con qué editor o codificación se
guardara el archivo, podía llegar rota y entonces «Picaña» dejaba de encontrar a
«picana»: los productos no se emparejaban al pegar las ventas ni al recibir un
conteo.

**Arreglado:** se documenta el rango y se deja `norm2()` (que ya lo hacía bien)
como referencia. Mismo comportamiento, sin depender del editor.

---

## 10 · Código muerto que habría reventado si alguien lo llamaba

Cinco funciones (`renderTabla`, `renderTablaPar`, `renderPedidos`,
`renderGrafico`, `revisarPedidos`) buscaban elementos (`#tProd`, `#peds`,
`#selGraf`, `#grafBox`) **que ya no están en la página**. No las llamaba nadie,
pero cualquiera que las conectara a un botón se encontraría con la app rota.
Lo mismo con el control de temperaturas, que ya se había quitado de la pantalla
pero seguía a medias en el código.

**Arreglado:** fuera. La hoja para firmar las temperaturas a mano **sigue
saliendo en el PDF**, que es donde de verdad se usaba.

---

## 11 · Detalles menores

- **Nombres de ventas sin escapar** en la vista previa de *Pegar ventas*: un
  producto con `<` o `&` en el nombre descuadraba el recuadro. Ahora se escapan.
- **`editarLote()`** llamaba `C` a la lista de cámaras, tapando la función `C()`
  que usa toda la app para leer la ficha de un producto. No daba error porque
  dentro no se usaba, pero era una trampa esperando. Renombrada.
- **Al imprimir la hoja** lo escrito en las casillas salía en blanco: los campos
  de formulario no imprimen su contenido. Ahora se convierten a texto antes de
  imprimir.
- **Candados al abrir la app:** el del timing ya arrancaba cerrado; el del stock
  de seguridad y el de congelación se quedaban como estuvieran. Ahora los tres
  arrancan cerrados, que es lo coherente.
- **La barra «Producción según las ventas»**, una vez oculta en conteo rápido,
  se volvía a mostrar al cambiar de vista: se dejó explícito para que no dependa
  del orden en que se dibuja.

---

## Lo que se dejó tal cual, a propósito

- **CSS duplicado** dentro del bloque `@media print` del cartel: unas 100 líneas
  repetidas por un copiar y pegar. Es redundante pero **no cambia nada** de cómo
  se ve, porque son copias exactas de reglas que ya están arriba. Se quitó la
  repetición y se dejó la única línea que sí era distinta (el tamaño de letra de
  la columna de gramos al imprimir).
- **Pizza y Cocina arrancan con la lista entera de productos** de los dos
  departamentos. Es a propósito, viene así del original: la idea es que en cada
  uno se borre lo que no le toca.
- **No hay botón de «Descargar copia»** en la pantalla (la función existe pero
  nunca estuvo conectada). Con el servidor ya no hace falta: guarda solo las 40
  últimas versiones y se recuperan por `/api/historial`.
