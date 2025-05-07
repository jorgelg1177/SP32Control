// Nuevo server.js con control de acceso exclusivo
const express = require("express");
const cors = require("cors");
const app = express();
const port = process.env.PORT || 3000;

app.use(cors());

let activeToken = null;
let activeUser = null;
let lastAccessTime = null;
let lastCommand = null;

const ADMIN_PASSWORD = "microsmart"; // Cambia esto por tu clave personal
const CONTROL_TIMEOUT = 60000; // 1 minuto de control máximo

// Ruta para ver estado y liberar control (solo administrador)
app.get("/admin", (req, res) => {
  if (req.query.pass !== ADMIN_PASSWORD) return res.status(403).send("Acceso denegado");

  res.send(`
    <html><head><title>Panel Admin</title></head><body style="font-family:sans-serif;background:#111;color:#0f0;padding:2em">
    <h1>Panel de Administración</h1>
    <p><strong>Usuario activo:</strong> ${activeUser || "Ninguno"}</p>
    <p><strong>Token activo:</strong> ${activeToken || "Ninguno"}</p>
    <form action="/release" method="get">
      <input type="hidden" name="pass" value="${ADMIN_PASSWORD}">
      <button type="submit" style="padding:10px 20px">Liberar control</button>
    </form>
    <form action="/token" method="get">
      <input type="hidden" name="pass" value="${ADMIN_PASSWORD}">
      <button type="submit" style="padding:10px 20px;margin-top:10px">Generar nuevo token</button>
    </form>
    </body></html>
  `);
});

// Ruta para liberar el control actual (solo admin)
app.get("/release", (req, res) => {
  if (req.query.pass !== ADMIN_PASSWORD) return res.status(403).send("Acceso denegado");
  activeToken = null;
  activeUser = null;
  lastAccessTime = null;
  res.send("Control liberado");
});

// Ruta para generar nuevo token (solo admin)
app.get("/token", (req, res) => {
  if (req.query.pass !== ADMIN_PASSWORD) return res.status(403).send("Acceso denegado");
  const newToken = Math.random().toString(36).substring(2, 8).toUpperCase();
  activeToken = newToken;
  activeUser = null;
  lastAccessTime = null;
  res.send(`Nuevo token: <strong>${newToken}</strong><br><a href='/admin?pass=${ADMIN_PASSWORD}'>Volver</a>`);
});

// Ruta para que el usuario se autentique
app.get("/auth", (req, res) => {
  const { token, user } = req.query;
  if (!token || !user) return res.status(400).send("Faltan datos");

  const now = Date.now();
  if (activeToken === null) return res.status(403).send("No hay token activo");
  if (token !== activeToken) return res.status(403).send("Token inválido");

  // si nadie está usando o el tiempo expiró
  if (!activeUser || (now - lastAccessTime > CONTROL_TIMEOUT)) {
    activeUser = user;
    lastAccessTime = now;
    return res.send("Acceso concedido");
  }

  if (activeUser === user) {
    lastAccessTime = now; // renueva el tiempo
    return res.send("Acceso renovado");
  }

  return res.status(403).send("Otro usuario tiene el control actualmente");
});

// Ruta para recibir comandos (con token)
app.get("/comando", (req, res) => {
  const { servo, angle, token, user } = req.query;
  if (!servo || !angle || !token || !user) return res.status(400).send("Faltan parámetros");

  const now = Date.now();
  if (token !== activeToken || user !== activeUser) return res.status(403).send("No tienes permiso");

  lastAccessTime = now;
  lastCommand = { servo: parseInt(servo), angle: parseInt(angle) };
  res.send("OK");
});

// Ruta para el ESP32: obtiene el próximo comando
app.get("/next", (req, res) => {
  if (lastCommand) {
    res.json(lastCommand);
    lastCommand = null;
  } else {
    res.json({});
  }
});

app.listen(port, () => {
  console.log(`Servidor activo en http://localhost:${port}`);
});
