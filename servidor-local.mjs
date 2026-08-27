/* ===========================================================
   Servidor para probar en tu ordenador  ·  node servidor-local.mjs
   -----------------------------------------------------------
   Hace lo mismo que Vercel pero en local: sirve la carpeta public
   y manda /api/loquesea al archivo api/loquesea.js.

   Sin base de datos conectada guarda en memoria: sirve para probar,
   pero se borra al parar el servidor.
   =========================================================== */
import http from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = fileURLToPath(new URL(".", import.meta.url));
const PUERTO = process.env.PORT || 3000;

const TIPOS = {
  ".html":"text/html; charset=utf-8", ".js":"text/javascript; charset=utf-8",
  ".json":"application/json; charset=utf-8", ".css":"text/css; charset=utf-8",
  ".png":"image/png", ".svg":"image/svg+xml", ".ico":"image/x-icon",
  ".webmanifest":"application/manifest+json"
};

const servidor = http.createServer(async (req, res) => {
  let ruta;
  try{ ruta = new URL(req.url, "http://localhost").pathname; }
  catch(e){ res.statusCode = 400; return res.end("mal"); }

  /* ---------- API ---------- */
  if(ruta.startsWith("/api/")){
    const nombre = ruta.slice(5).replace(/[^a-zA-Z0-9_-]/g, "");
    try{
      const mod = await import("./api/" + nombre + ".js");
      return mod.default(req, res);
    }catch(e){
      res.statusCode = 404;
      res.setHeader("Content-Type", "application/json");
      return res.end(JSON.stringify({error:"no-existe", ruta, detalle:String(e.message || e)}));
    }
  }

  /* ---------- archivos ---------- */
  if(ruta === "/" || ruta === "") ruta = "/index.html";
  const archivo = join(RAIZ, "public", normalize(ruta).replace(/^(\.\.[/\\])+/, ""));
  try{
    const s = await stat(archivo);
    if(!s.isFile()) throw new Error("no es archivo");
    const datos = await readFile(archivo);
    res.statusCode = 200;
    res.setHeader("Content-Type", TIPOS[extname(archivo)] || "application/octet-stream");
    res.setHeader("Cache-Control", "no-store");
    return res.end(datos);
  }catch(e){
    res.statusCode = 404;
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    return res.end("No está: " + ruta);
  }
});

servidor.listen(PUERTO, () => {
  console.log("El Alpendre en http://localhost:" + PUERTO);
});
