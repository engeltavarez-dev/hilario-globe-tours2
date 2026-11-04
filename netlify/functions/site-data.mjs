
import { getStore } from "@netlify/blobs";
import { timingSafeEqual } from "node:crypto";

const STORE = getStore("hilario-globe-tour");
const KEY = "public-site-data";
const MAX_SIZE = 5500000;

function reply(status, data) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store"
    }
  });
}

function samePin(a, b) {
  const x = Buffer.from(String(a || ""));
  const y = Buffer.from(String(b || ""));
  return x.length === y.length && timingSafeEqual(x, y);
}

export default async (request) => {
  if (request.method === "GET") {
    try {
      const data = await STORE.get(KEY, { type: "json" });
      return reply(200, { data: data || null });
    } catch {
      return reply(500, { error: "Error leyendo los datos." });
    }
  }

  if (request.method !== "POST") {
    return reply(405, { error: "Método no permitido." });
  }

  const expectedPin = process.env.HGT_ADMIN_PIN;

  if (!expectedPin) {
    return reply(503, {
      error: "Falta configurar HGT_ADMIN_PIN en Netlify."
    });
  }

  const suppliedPin = request.headers.get("x-admin-pin") || "";

  if (!samePin(suppliedPin, expectedPin)) {
    return reply(401, { error: "PIN incorrecto." });
  }

  const raw = await request.text();

  if (Buffer.byteLength(raw, "utf8") > MAX_SIZE) {
    return reply(413, { error: "El contenido es demasiado grande." });
  }

  let body;

  try {
    body = JSON.parse(raw);
  } catch {
    return reply(400, { error: "JSON inválido." });
  }

  if (body?.action === "auth") {
    return reply(200, { ok: true });
  }

  if (!body?.data || !Array.isArray(body.data.tours)) {
    return reply(400, { error: "Datos de excursiones inválidos." });
  }

  try {
    await STORE.setJSON(KEY, body.data);
    return reply(200, { ok: true, saved: true });
  } catch {
    return reply(500, { error: "No se pudieron guardar los cambios." });
  }
};

