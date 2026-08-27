/* Cosas que usan todas las rutas de la API */

/* ---------- clave compartida (opcional pero recomendada) ----------
   Si en Vercel existe la variable ALPENDRE_KEY, hay que mandarla en
   la cabecera x-alpendre-key. Si no existe, la API queda abierta:
   cómodo para empezar, pero cualquiera con la dirección podría leer
   y escribir. En el README está cómo activarla.                    */
export function claveOk(req){
  const esperada = process.env.ALPENDRE_KEY || "";
  if(!esperada) return true;
  const dada = req.headers["x-alpendre-key"] || "";
  return String(dada) === esperada;
}

export function pideClave(){ return !!(process.env.ALPENDRE_KEY || ""); }

/* ---------- leer el cuerpo de la petición ----------
   No damos por hecho que el entorno lo parsee: lo leemos a mano y
   así funciona igual en Vercel, en local y detrás de cualquier proxy. */
export async function cuerpo(req){
  if(req.body && typeof req.body === "object") return req.body;
  if(typeof req.body === "string"){
    try{ return JSON.parse(req.body); }catch(e){ return null; }
  }
  const trozos = [];
  let bytes = 0;
  for await (const t of req){
    bytes += t.length;
    if(bytes > 8 * 1024 * 1024) throw new Error("demasiado-grande");
    trozos.push(t);
  }
  if(!trozos.length) return null;
  try{ return JSON.parse(Buffer.concat(trozos).toString("utf8")); }
  catch(e){ return null; }
}

export function json(res, codigo, obj){
  res.statusCode = codigo;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store, max-age=0");
  res.end(JSON.stringify(obj));
}
