/* ===========================================================
   SINCRONIZACIÓN · El Alpendre
   -----------------------------------------------------------
   La app sigue funcionando exactamente igual: guarda en el propio
   dispositivo, al instante y sin esperar a nadie. Este archivo se
   pone por encima y hace tres cosas:

     1. Cuando algo cambia acá, lo sube al servidor.
     2. Cada pocos segundos pregunta si alguien subió algo nuevo.
     3. Si lo hay, lo baja y actualiza la pantalla.

   No toca ni una línea de la app: se engancha a localStorage, que
   es por donde la app ya guardaba. Si se cae internet, todo sigue
   funcionando en local y se sube solo en cuanto vuelve.
   =========================================================== */
(function(){
"use strict";

/* ---------- las llaves donde vive todo ---------- */
const LS_PLAN   = "alpendre.timing.v1";      /* el plan · la usa la app */
const LS_REV    = "alpendre.sync.rev";       /* qué revisión tenemos bajada */
const LS_CUERPO = "alpendre.sync.cuerpo";    /* huella de lo último que subimos */
const LS_YO     = "alpendre.sync.cliente";   /* identificador de este dispositivo */
const LS_CLAVE  = "alpendre.sync.clave";     /* clave de acceso, si la pusieron */
const LS_RESCATE= "alpendre.sync.rescate";   /* copia de lo que se pisó, por si acaso */

const ESPERA_SUBIR   = 1800;    /* ms que se espera tras un cambio antes de subir */
const CADA_MIRAR     = 12000;   /* ms entre consulta y consulta al servidor */
const IDLE_SEGURO    = 5000;    /* ms sin tocar nada para poder refrescar sin molestar */
const REINTENTO_MAX  = 60000;   /* tope de la espera cuando no hay conexión */

/* ---------- utilidades mínimas ---------- */
const ls = {
  get(k){ try{ return localStorage.getItem(k); }catch(e){ return null; } },
  set(k, v){ try{ localStorage.setItem(k, v); return true; }catch(e){ return false; } },
  del(k){ try{ localStorage.removeItem(k); }catch(e){} }
};

function nuevoId(){
  return "d" + Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);
}
const YO = ls.get(LS_YO) || (function(){ const x = nuevoId(); ls.set(LS_YO, x); return x; })();

/* la clave puede llegar por la dirección: .../?clave=loquesea (se guarda y se limpia) */
(function tomarClaveDeLaUrl(){
  try{
    const u = new URL(location.href);
    const c = u.searchParams.get("clave") || u.searchParams.get("key");
    if(c){
      ls.set(LS_CLAVE, c);
      u.searchParams.delete("clave"); u.searchParams.delete("key");
      history.replaceState(null, "", u.pathname + (u.search || "") + (u.hash || ""));
    }
  }catch(e){}
})();

function cabeceras(){
  const h = {"Content-Type":"application/json"};
  const c = ls.get(LS_CLAVE);
  if(c) h["x-alpendre-key"] = c;
  return h;
}

const rev    = () => +(ls.get(LS_REV) || 0);
const ponRev = r => ls.set(LS_REV, String(r));

/* la huella del plan sin la marca de hora: así 20 segundos sin tocar
   nada no cuentan como cambio y no se sube al servidor porque sí     */
function cuerpoDe(crudo){
  if(!crudo) return "";
  const i = crudo.indexOf('"S":');
  return i < 0 ? crudo : crudo.slice(i);
}
function planLocal(){ return ls.get(LS_PLAN); }
function horaDe(crudo){
  if(!crudo) return 0;
  const m = /"t"\s*:\s*(\d+)/.exec(crudo.slice(0, 120));
  return m ? +m[1] : 0;
}
function quienSoy(){
  /* el nombre que se ve en la barra: sirve para saber quién guardó */
  try{
    const n = document.getElementById("qN");
    return n && n.textContent ? n.textContent.trim() : "";
  }catch(e){ return ""; }
}

/* ===========================================================
   EL CARTELITO DE ESTADO
   Se pone al lado del de «GUARDADO», con la misma pinta, para no
   cambiar el diseño. Dice si está en la nube, subiendo o sin señal.
   =========================================================== */
let pill = null;
function ponerPill(){
  if(pill || !document.body) return;
  const ref = document.getElementById("estGuard");
  pill = document.createElement("button");
  pill.id = "estNube";
  pill.className = "guard";
  pill.style.cssText = "cursor:pointer;font:inherit;text-align:left";
  pill.innerHTML = "<b>NUBE</b><small>…</small>";
  pill.addEventListener("click", () => { mirarServidor(true); subirYa(); });
  if(ref && ref.parentNode) ref.parentNode.insertBefore(pill, ref.nextSibling);
  else{
    const t = document.querySelector(".tools");
    if(t) t.appendChild(pill);
  }
}
function pintar(clase, titulo, detalle, ayuda){
  ponerPill();
  if(!pill) return;
  pill.className = "guard" + (clase ? " " + clase : "");
  pill.innerHTML = "<b>" + titulo + "</b><small>" + detalle + "</small>";
  pill.title = ayuda || "";
}
function hhmm(iso){
  try{
    const d = iso ? new Date(iso) : new Date();
    return ("0" + d.getHours()).slice(-2) + ":" + ("0" + d.getMinutes()).slice(-2);
  }catch(e){ return "—"; }
}

/* ===========================================================
   AVISO DE CAMBIOS NUEVOS
   Si alguien guardó desde otro móvil mientras acá se está
   escribiendo, no se refresca de golpe: aparece una barra abajo
   y se actualiza cuando la persona quiera, o sola en cuanto
   deje de tocar la pantalla unos segundos.
   =========================================================== */
let aviso = null;
function mostrarAviso(quien){
  if(aviso) return;
  aviso = document.createElement("button");
  aviso.type = "button";
  aviso.style.cssText =
    "position:fixed;left:50%;transform:translateX(-50%);bottom:calc(16px + env(safe-area-inset-bottom));" +
    "z-index:400;background:#0B3FA8;color:#fff;border:none;border-radius:999px;padding:11px 18px;" +
    "font:700 12.5px/1.2 Arial,Helvetica,sans-serif;letter-spacing:.03em;cursor:pointer;" +
    "box-shadow:0 8px 24px rgba(11,63,168,.35);max-width:calc(100% - 24px)";
  aviso.textContent = "↻ Hay cambios nuevos" + (quien ? " de " + quien : "") + " · tocá para verlos";
  aviso.addEventListener("click", () => bajarYAplicar(true));
  document.body.appendChild(aviso);
}
function quitarAviso(){ if(aviso){ aviso.remove(); aviso = null; } }

/* ---------- ¿se puede refrescar sin fastidiar a nadie? ---------- */
let ultimoToque = Date.now();
["pointerdown","keydown","input","wheel","touchstart"].forEach(ev => {
  document.addEventListener(ev, () => { ultimoToque = Date.now(); }, {passive:true, capture:true});
});
function momentoTranquilo(){
  if(Date.now() - ultimoToque < IDLE_SEGURO) return false;
  const m = document.getElementById("modalBg");
  if(m && m.classList.contains("on")) return false;
  const a = document.getElementById("acceso");
  if(a && a.classList.contains("on")) return false;
  const f = document.activeElement;
  if(f && /^(INPUT|TEXTAREA|SELECT)$/.test(f.tagName)) return false;
  if(document.body.classList.contains("arrastrando")) return false;
  return true;
}

/* ===========================================================
   SUBIR
   =========================================================== */
let subiendo = false, pendiente = false, tSubir = null, esperaFallo = 4000;
/* Mientras se está aplicando lo que bajó del servidor y recargando la
   página, la app NO puede volver a escribir el plan: si lo hiciera
   (al descargarse guarda una última vez) pisaría lo recién bajado y el
   cambio del otro dispositivo se perdería.                            */
let congelado = false;

function marcarCambio(){
  clearTimeout(tSubir);
  tSubir = setTimeout(subirYa, ESPERA_SUBIR);
}

async function subirYa(){
  clearTimeout(tSubir);
  if(subiendo){ pendiente = true; return; }
  const crudo = planLocal();
  if(!crudo) return;
  const huella = cuerpoDe(crudo);
  if(huella === ls.get(LS_CUERPO)) return;      /* nada cambió de verdad */

  let paquete;
  try{ paquete = JSON.parse(crudo); }catch(e){ return; }

  subiendo = true;
  pintar("save", "SUBIENDO", "…", "Mandando los cambios al servidor");
  try{
    const r = await fetch("/api/estado", {
      method:"PUT", headers:cabeceras(),
      body: JSON.stringify({rev:rev(), data:paquete, quien:quienSoy(), cliente:YO})
    });

    if(r.status === 409){
      /* otro dispositivo guardó primero: nos ponemos al día y volvemos a probar */
      const j = await r.json().catch(() => null);
      subiendo = false;
      if(j && j.data) await resolver(j, crudo);
      return;
    }
    if(r.status === 401){
      subiendo = false;
      pintar("off", "SIN CLAVE", "tocá acá", "Este servidor pide clave. Abrí la dirección con ?clave=TU_CLAVE");
      return;
    }
    if(!r.ok) throw new Error("HTTP " + r.status);

    const j = await r.json();
    ponRev(j.rev);
    ls.set(LS_CUERPO, huella);
    esperaFallo = 4000;
    pintar("", "EN LA NUBE", hhmm(j.guardadoEn), "Guardado en el servidor · lo ven todos los dispositivos");
  }catch(e){
    pintar("off", "SIN CONEXIÓN", "se guarda acá", "No hay señal. Todo queda guardado en este dispositivo y se sube solo cuando vuelva.");
    setTimeout(subirYa, esperaFallo);
    esperaFallo = Math.min(REINTENTO_MAX, esperaFallo * 2);
  }finally{
    subiendo = false;
    if(pendiente){ pendiente = false; marcarCambio(); }
  }
}

/* ===========================================================
   BAJAR
   =========================================================== */
async function bajarYAplicar(aunqueEstenEscribiendo){
  let j;
  try{
    const r = await fetch("/api/estado", {headers:cabeceras()});
    if(!r.ok) throw new Error("HTTP " + r.status);
    j = await r.json();
  }catch(e){
    pintar("off", "SIN CONEXIÓN", "se guarda acá", "No se pudo consultar el servidor.");
    return false;
  }
  if(j.vacio || !j.data) return false;
  if(!aunqueEstenEscribiendo && !momentoTranquilo()){
    mostrarAviso(j.quien);
    return false;
  }
  return aplicar(j);
}

function aplicar(j){
  const crudo = JSON.stringify(j.data);
  congelado = true;                 /* a partir de acá la app ya no pisa nada */
  clearTimeout(tSubir);
  ls.crudo(LS_PLAN, crudo);
  ponRev(j.rev);
  ls.set(LS_CUERPO, cuerpoDe(crudo));
  quitarAviso();
  pintar("", "ACTUALIZANDO", hhmm(j.guardadoEn), "Bajando lo último");
  /* la app lee el plan al arrancar: la forma limpia y segura de que
     todo (pantallas, listas y totales) quede al día es volver a cargarla */
  setTimeout(() => { try{ location.reload(); }catch(e){} }, 60);
  return true;
}

/* ===========================================================
   CUANDO LOS DOS LADOS CAMBIARON
   Se queda el más reciente, pero el otro NO se tira: se guarda
   en este dispositivo por si hubiera que recuperarlo.
   =========================================================== */
async function resolver(delServidor, crudoLocal){
  const tLocal    = horaDe(crudoLocal);
  const tServidor = horaDe(JSON.stringify(delServidor.data));

  if(tServidor > tLocal){
    ls.set(LS_RESCATE, crudoLocal);
    if(!momentoTranquilo()){ mostrarAviso(delServidor.quien); ponRev(delServidor.rev); return; }
    aplicar(delServidor);
    return;
  }
  /* lo nuestro es más nuevo: nos quedamos con la revisión del servidor
     para que la próxima subida encaje, y volvemos a mandar             */
  ponRev(delServidor.rev);
  ls.set(LS_CUERPO, "");
  setTimeout(subirYa, 300);
}

/* ===========================================================
   MIRAR SI HAY NOVEDADES
   =========================================================== */
let mirando = false;
async function mirarServidor(forzar){
  if(mirando) return;
  if(!forzar && document.hidden) return;
  mirando = true;
  try{
    const r = await fetch("/api/version", {headers:cabeceras()});
    if(r.status === 401){
      pintar("off", "SIN CLAVE", "tocá acá", "Este servidor pide clave. Abrí la dirección con ?clave=TU_CLAVE");
      return;
    }
    if(!r.ok) throw new Error("HTTP " + r.status);
    const j = await r.json();

    if(!j.nube){
      pintar("save", "SIN BASE", "modo prueba",
             "El servidor no tiene base de datos conectada: los cambios no se guardan de verdad. Mirá el README.");
    }
    if(+j.rev > rev()){
      if(j.cliente === YO){ ponRev(j.rev); return; }   /* fuimos nosotros */
      await bajarYAplicar(false);
      return;
    }
    if(esperaFallo !== 4000){ esperaFallo = 4000; }
    if(!subiendo && j.nube){
      pintar("", "EN LA NUBE", hhmm(j.guardadoEn), "Al día con el servidor" + (j.quien ? " · último cambio de " + j.quien : ""));
    }
  }catch(e){
    pintar("off", "SIN CONEXIÓN", "se guarda acá", "No hay señal. Todo queda guardado en este dispositivo.");
  }finally{ mirando = false; }
}

/* ===========================================================
   ENGANCHE A localStorage
   La app guarda con localStorage.setItem: nos ponemos delante,
   dejamos que guarde como siempre y además avisamos para subir.
   =========================================================== */
(function engancharGuardado(){
  const original = Storage.prototype.setItem;
  Storage.prototype.setItem = function(k, v){
    /* congelado: se ignora cualquier intento de guardar el plan */
    if(congelado && this === window.localStorage && k === LS_PLAN) return;
    const r = original.apply(this, arguments);
    if(this === window.localStorage && k === LS_PLAN) marcarCambio();
    return r;
  };
  /* para poder escribir nosotros aunque esté congelado */
  ls.crudo = (k, v) => { try{ original.call(window.localStorage, k, v); return true; }
                         catch(e){ return false; } };
})();

/* si hay dos pestañas abiertas en el mismo dispositivo, que se enteren */
window.addEventListener("storage", e => {
  if(e.key === LS_PLAN) marcarCambio();
});

/* ===========================================================
   ARRANQUE
   =========================================================== */
async function arrancar(){
  ponerPill();
  pintar("save", "NUBE", "conectando…", "Conectando con el servidor");

  let j = null;
  try{
    const r = await fetch("/api/estado", {headers:cabeceras()});
    if(r.status === 401){
      pintar("off", "SIN CLAVE", "tocá acá",
             "Este servidor pide clave. Abrí la dirección con ?clave=TU_CLAVE una sola vez.");
      return;
    }
    if(r.ok) j = await r.json();
  }catch(e){}

  const crudo = planLocal();

  if(!j){
    pintar("off", "SIN CONEXIÓN", "se guarda acá",
           "Sin señal ahora mismo. La app funciona igual y sube los cambios cuando vuelva.");
    setTimeout(arrancar, 8000);
    return;
  }

  if(j.vacio || !j.data){
    /* servidor recién estrenado: se sube lo que haya en este dispositivo */
    ponRev(0); ls.set(LS_CUERPO, "");
    if(crudo) await subirYa();
    else pintar("", "EN LA NUBE", hhmm(), "Listo · en cuanto cargues algo se sube");
  }else if(!crudo){
    /* dispositivo nuevo: se baja todo lo que hay */
    aplicar(j);
    return;
  }else{
    const tLocal = horaDe(crudo), tServidor = horaDe(JSON.stringify(j.data));
    const bajadaAlDia = rev() >= j.rev;
    const localTocado = cuerpoDe(crudo) !== ls.get(LS_CUERPO);

    if(!bajadaAlDia && tServidor >= tLocal){
      if(localTocado) ls.set(LS_RESCATE, crudo);
      aplicar(j);
      return;
    }
    if(!bajadaAlDia && tLocal > tServidor){
      ponRev(j.rev); ls.set(LS_CUERPO, "");
      await subirYa();
    }else{
      ponRev(j.rev);
      pintar("", "EN LA NUBE", hhmm(j.guardadoEn),
             "Al día con el servidor" + (j.quien ? " · último cambio de " + j.quien : ""));
      if(localTocado) await subirYa();
    }
  }

  setInterval(mirarServidor, CADA_MIRAR);
  document.addEventListener("visibilitychange", () => { if(!document.hidden) mirarServidor(true); });
  window.addEventListener("online", () => { mirarServidor(true); subirYa(); });
  window.addEventListener("offline", () =>
    pintar("off", "SIN CONEXIÓN", "se guarda acá", "Sin señal. Todo queda en este dispositivo."));
  /* al cerrar, un último intento de dejarlo todo subido */
  window.addEventListener("pagehide", () => {
    const c = planLocal();
    if(!c || cuerpoDe(c) === ls.get(LS_CUERPO)) return;
    try{
      const b = new Blob([JSON.stringify({rev:rev(), data:JSON.parse(c), quien:quienSoy(), cliente:YO})],
                         {type:"application/json"});
      navigator.sendBeacon("/api/estado", b);
    }catch(e){}
  });
}

/* una manito para diagnosticar desde la consola del navegador */
window.AlpendreSync = {
  subir: subirYa,
  bajar: () => bajarYAplicar(true),
  estado: () => ({yo:YO, rev:rev(), clave: !!ls.get(LS_CLAVE)}),
  rescate: () => ls.get(LS_RESCATE),
  ponerClave: c => { ls.set(LS_CLAVE, c); location.reload(); }
};

if(document.readyState === "loading") document.addEventListener("DOMContentLoaded", arrancar);
else arrancar();

})();
