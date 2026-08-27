/* ===========================================================
   /api/version  ·  solo el número de revisión
   -----------------------------------------------------------
   Es lo que consultan los móviles cada pocos segundos para saber
   si alguien guardó algo nuevo. Devuelve cuatro datos, no el plan
   entero: así preguntar sale casi gratis.
   =========================================================== */
import { leerEstado, hayNube } from "./_store.js";
import { claveOk, json } from "./_comun.js";

export default async function handler(req, res){
  if(!claveOk(req)) return json(res, 401, {error:"clave"});
  try{
    const e = await leerEstado();
    return json(res, 200, {
      rev: e ? e.rev : 0,
      guardadoEn: e ? e.guardadoEn : null,
      quien: e ? (e.quien || "") : "",
      cliente: e ? (e.cliente || "") : "",
      nube: hayNube()
    });
  }catch(err){
    return json(res, 500, {error:"leer", mensaje:String(err.message || err)});
  }
}
