/* ===========================================================
   /api/estado  ·  el plan compartido entre todos los dispositivos
   -----------------------------------------------------------
   GET  → devuelve lo que hay guardado, con su número de revisión.
   PUT  → guarda, siempre que la revisión coincida. Si no coincide
          quiere decir que otro móvil guardó antes: se devuelve un
          409 con lo que hay ahora y el móvil se pone al día.
   =========================================================== */
import { leerEstado, guardarEstado, hayNube } from "./_store.js";
import { claveOk, pideClave, cuerpo, json } from "./_comun.js";

export default async function handler(req, res){
  if(req.method === "OPTIONS"){
    res.setHeader("Allow", "GET, PUT, OPTIONS");
    res.statusCode = 204; return res.end();
  }

  if(!claveOk(req)){
    return json(res, 401, {error:"clave", mensaje:"Falta la clave de acceso (x-alpendre-key)."});
  }

  /* ---------- LEER ---------- */
  if(req.method === "GET"){
    try{
      const e = await leerEstado();
      if(!e) return json(res, 200, {vacio:true, rev:0, nube:hayNube(), pideClave:pideClave()});
      return json(res, 200, {
        vacio:false, rev:e.rev, guardadoEn:e.guardadoEn, quien:e.quien || "",
        cliente:e.cliente || "", nube:hayNube(), pideClave:pideClave(), data:e.data
      });
    }catch(err){
      return json(res, 500, {error:"leer", mensaje:String(err.message || err)});
    }
  }

  /* ---------- GUARDAR ---------- */
  if(req.method === "PUT" || req.method === "POST"){
    let b;
    try{ b = await cuerpo(req); }
    catch(err){
      return json(res, 413, {error:"tamaño", mensaje:"El plan pesa demasiado para enviarlo de una vez."});
    }
    if(!b || typeof b !== "object" || b.data == null){
      return json(res, 400, {error:"datos", mensaje:"Falta el campo data."});
    }
    try{
      const r = await guardarEstado({
        rev: +b.rev || 0,
        data: b.data,
        quien: b.quien,
        cliente: b.cliente,
        forzar: b.forzar === true
      });
      if(!r.ok && r.conflicto){
        return json(res, 409, {
          error:"conflicto",
          mensaje:"Otro dispositivo guardó antes. Ponete al día y volvé a intentarlo.",
          rev:r.estado.rev, guardadoEn:r.estado.guardadoEn, quien:r.estado.quien || "",
          cliente:r.estado.cliente || "", data:r.estado.data
        });
      }
      return json(res, 200, {
        ok:true, rev:r.estado.rev, guardadoEn:r.estado.guardadoEn, nube:hayNube()
      });
    }catch(err){
      return json(res, 500, {error:"guardar", mensaje:String(err.message || err)});
    }
  }

  res.setHeader("Allow", "GET, PUT, OPTIONS");
  return json(res, 405, {error:"metodo", mensaje:"Usá GET o PUT."});
}
