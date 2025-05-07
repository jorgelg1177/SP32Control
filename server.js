// server.js con control exclusivo, tokens únicos e inactividad
const express = require("express");
const cors = require("cors");
const app = express();
const port = process.env.PORT || 3000;

app.use(cors());

let validTokens = {}; // tokens generados y su estado
let activeUser = null;
let activeToken = null;
let lastAccessTime = null;
let lastCommand = null;

const ADMIN_PASSWORD = "microsmart";
const MAX_SESSION_TIME = 2 * 60 * 1000; // 2 minutos
const INACTIVITY_LIMIT = 30 * 1000;     // 30 segundos

// Ruta de administración
app.get("/admin", (req, res) => {
  if (req.query.pass !== ADMIN_PASSWORD) return res.status(403).send("Acceso denegado");

  let tokensHtml = Object.entries(validTokens).map(([token, data]) => {
    return `<li>${token} → ${data.usado ? "🟡 Usado" : "🟢 Disponible"}</li>`;
  }).join("");

  res.send(`
    <html><body style="background:#111;color:#0f0;font-family:sans-serif;padding:2em">
    <h2>Panel de Administración</h2>
    <p><strong>Usuario activo:</strong> ${activeUser || "Ninguno"}</p>
    <p><strong>Token activo:</strong> ${activeToken || "Ninguno"}</p>
    <form action="/release" method="get"><input type="hidden" name="pass" value="${ADMIN_PASSWORD}">
    <button type="submit">Liberar control</button></form>
    <form action="/token" method="get"><input type="hidden" name="pass" value="${ADMIN_PASSWORD}">
    <button type="submit">Generar nuevo token</button></form>
    <h3>Tokens generados:</h3><ul>${tokensHtml}</ul>
    </body></html>
  `);
});

app.get("/release", (req, res) => {
  if (req.query.pass !== ADMIN_PASSWORD) return res.status(403).send("Acceso denegado");
  activeToken = null;
  activeUser = null;
  lastAccessTime = null;
  res.send("Control liberado");
});

app.get("/token", (req, res) => {
  if (req.query.pass !== ADMIN_PASSWORD) return res.status(403).send("Acceso denegado");
  const newToken = Math.random().toString(36).substring(2, 8).toUpperCase();
  validTokens[newToken] = { usado: false };
  res.send(`Nuevo token generado: <strong>${newToken}</strong><br><a href='/admin?pass=${ADMIN_PASSWORD}'>Volver</a>`);
});

app.get("/auth", (req, res) => {
  const { token, user } = req.query;
  if (!token || !user) return res.status(400).send("Faltan datos");

  const now = Date.now();

  // Si token no existe en lista
  if (!validTokens[token]) return res.status(403).send("Token inválido");

  // Si el token ya fue usado por otro usuario
  if (validTokens[token].usado && activeUser !== user) {
    return res.status(403).send("Token ya fue usado");
  }

  // Si está libre o expirado
  if (!activeUser || now - lastAccessTime > MAX_SESSION_TIME || now - lastAccessTime > INACTIVITY_LIMIT) {
    activeToken = token;
    activeUser = user;
    validTokens[token].usado = true;
    lastAccessTime = now;
    return res.send("Acceso concedido");
  }

  // Si el mismo usuario renueva sesión
  if (activeUser === user && activeToken === token) {
    lastAccessTime = now;
    return res.send("Renovado");
  }

  return res.status(403).send("Otro usuario tiene el control");
});

app.get("/comando", (req, res) => {
  const { servo, angle, token, user } = req.query;
  if (!servo || !angle || !token || !user) return res.status(400).send("Faltan parámetros");

  const now = Date.now();
  if (token !== activeToken || user !== activeUser) return res.status(403).send("No tienes permiso");

  lastAccessTime = now;
  lastCommand = { servo: parseInt(servo), angle: parseInt(angle) };
  res.send("OK");
});

app.get("/next", (req, res) => {
  if (lastCommand) {
    res.json(lastCommand);
    lastCommand = null;
  } else {
    res.json({});
  }
});

app.listen(port, () => {
  console.log(`Servidor escuchando en http://localhost:${port}`);
});
