/* ===========================================================
   /api/historial  ·  las copias anteriores
   -----------------------------------------------------------
   GET                → lista de las últimas 40 copias (rev, fecha, quién)
   GET ?rev=12        → devuelve esa copia entera, para recuperarla
   =========================================================== */
import { leerHistorial, leerCopia, hayNube } from "./_store.js";
import { claveOk, json } from "./_comun.js";

export default async function handler(req, res){
  if(!claveOk(req)) return json(res, 401, {error:"clave"});
  if(req.method !== "GET"){
    res.setHeader("Allow", "GET");
    return json(res, 405, {error:"metodo"});
  }
  try{
    const url = new URL(req.url, "http://x");
    const rev = url.searchParams.get("rev");
    if(rev){
      const c = await leerCopia(rev);
      if(!c) return json(res, 404, {error:"no-esta", mensaje:"Esa copia ya no está guardada."});
      return json(res, 200, {rev:c.rev, guardadoEn:c.guardadoEn, quien:c.quien || "", data:c.data});
    }
    return json(res, 200, {nube:hayNube(), copias: await leerHistorial()});
  }catch(err){
    return json(res, 500, {error:"leer", mensaje:String(err.message || err)});
  }
}
