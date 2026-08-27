/* ===========================================================
   Guardado en la nube · El Alpendre
   -----------------------------------------------------------
   Habla con Upstash Redis por REST (es lo que monta Vercel KV
   y también Upstash directo). No hace falta ninguna librería:
   solo fetch, que ya viene en Node 18+.

   Variables de entorno que busca, en este orden:
     KV_REST_API_URL        + KV_REST_API_TOKEN         (Vercel KV)
     UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN  (Upstash)
     REDIS_URL              + REDIS_TOKEN               (genérico)

   Si no hay ninguna, guarda en memoria: sirve para probar en
   local, pero se pierde en cuanto se apaga el servidor.
   =========================================================== */

import { gzipSync, gunzipSync } from "node:zlib";

const CLAVE       = "alpendre:estado";       /* el documento vivo */
const CLAVE_HIST  = "alpendre:historial";    /* copias anteriores */
const HIST_MAX    = 40;                      /* cuántas copias se guardan */

function credenciales(){
  const url = process.env.KV_REST_API_URL
           || process.env.UPSTASH_REDIS_REST_URL
           || process.env.REDIS_URL
           || "";
  const token = process.env.KV_REST_API_TOKEN
             || process.env.UPSTASH_REDIS_REST_TOKEN
             || process.env.REDIS_TOKEN
             || "";
  if(!url || !token) return null;
  return {url: url.replace(/\/+$/, ""), token};
}

export function hayNube(){ return credenciales() !== null; }

/* ---------- memoria, solo para desarrollo local ---------- */
const MEM = globalThis.__alpendreMem || (globalThis.__alpendreMem = {estado:null, hist:[]});

/* ---------- comprimir ----------
   El plan entero puede pesar varios cientos de kB. Comprimido baja
   a unas decenas, así entra de sobra en el límite de Upstash y
   viaja mucho más rápido desde el móvil.                          */
function empaquetar(obj){
  const txt = JSON.stringify(obj);
  const z = gzipSync(Buffer.from(txt, "utf8")).toString("base64");
  /* si comprimir no compensa (planes diminutos), va tal cual */
  return z.length < txt.length ? JSON.stringify({z}) : txt;
}
function desempaquetar(crudo){
  if(crudo == null) return null;
  let txt = typeof crudo === "string" ? crudo : JSON.stringify(crudo);
  try{
    const d = JSON.parse(txt);
    if(d && typeof d.z === "string"){
      return JSON.parse(gunzipSync(Buffer.from(d.z, "base64")).toString("utf8"));
    }
    return d;
  }catch(e){ return null; }
}

/* ---------- una orden de Redis por REST ---------- */
async function redis(partes){
  const c = credenciales();
  if(!c) throw new Error("sin-nube");
  const r = await fetch(c.url, {
    method: "POST",
    headers: {
      "Authorization": "Bearer " + c.token,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(partes)
  });
  if(!r.ok){
    const t = await r.text().catch(() => "");
    throw new Error("redis " + r.status + " " + t.slice(0, 200));
  }
  const j = await r.json();
  if(j && j.error) throw new Error("redis " + j.error);
  return j ? j.result : null;
}

/* ===========================================================
   LEER
   =========================================================== */
export async function leerEstado(){
  if(!hayNube()) return MEM.estado;
  const crudo = await redis(["GET", CLAVE]);
  return desempaquetar(crudo);
}

/* ===========================================================
   GUARDAR  ·  control de versión para que dos móviles no se pisen
   -----------------------------------------------------------
   Se guarda solo si la revisión que trae el móvil es la misma que
   hay en el servidor. Si no, se devuelve conflicto y el móvil
   decide (normalmente: recarga lo del servidor y vuelve a mandar).
   =========================================================== */
export async function guardarEstado({rev, data, quien, cliente, forzar}){
  const actual = await leerEstado();
  const revActual = actual ? (+actual.rev || 0) : 0;

  if(!forzar && actual && +rev !== revActual){
    return {ok:false, conflicto:true, estado:actual};
  }

  const nuevo = {
    rev: revActual + 1,
    guardadoEn: new Date().toISOString(),
    quien: String(quien || "").slice(0, 80),
    cliente: String(cliente || "").slice(0, 60),
    data
  };

  if(!hayNube()){
    MEM.estado = nuevo;
    MEM.hist.unshift(resumen(nuevo));
    MEM.hist = MEM.hist.slice(0, HIST_MAX);
    return {ok:true, estado:nuevo};
  }

  await redis(["SET", CLAVE, empaquetar(nuevo)]);
  /* copia de seguridad de la versión anterior, por si hay que volver atrás */
  if(actual){
    try{
      await redis(["LPUSH", CLAVE_HIST, empaquetar(actual)]);
      await redis(["LTRIM", CLAVE_HIST, "0", String(HIST_MAX - 1)]);
    }catch(e){ /* que un fallo del historial no tire el guardado */ }
  }
  return {ok:true, estado:nuevo};
}

/* ===========================================================
   HISTORIAL  ·  las copias anteriores, para recuperar
   =========================================================== */
export async function leerHistorial(){
  if(!hayNube()) return MEM.hist.slice();
  let filas = [];
  try{ filas = await redis(["LRANGE", CLAVE_HIST, "0", String(HIST_MAX - 1)]) || []; }
  catch(e){ return []; }
  return filas.map(x => {
    const d = desempaquetar(x);
    return d ? resumen(d) : null;
  }).filter(Boolean);
}

export async function leerCopia(rev){
  if(!hayNube()) return null;
  let filas = [];
  try{ filas = await redis(["LRANGE", CLAVE_HIST, "0", String(HIST_MAX - 1)]) || []; }
  catch(e){ return null; }
  for(const x of filas){
    const d = desempaquetar(x);
    if(d && +d.rev === +rev) return d;
  }
  return null;
}

function resumen(e){
  return {rev:e.rev, guardadoEn:e.guardadoEn, quien:e.quien || "", cliente:e.cliente || ""};
}
