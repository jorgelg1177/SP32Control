// server.js con tokens de un solo uso estrictos
const express = require("express");
const cors = require("cors");
const app = express();
const port = process.env.PORT || 3000;

app.use(cors());

let validTokens = {};
let activeUser = null;
let activeToken = null;
let lastAccessTime = null;
let lastCommand = null;

const ADMIN_PASSWORD = "microsmart";
const MAX_SESSION_TIME = 2 * 60 * 1000;
const INACTIVITY_LIMIT = 30 * 1000;

// Panel de administrador con diseño bonito
app.get("/admin", (req, res) => {
  if (req.query.pass !== ADMIN_PASSWORD) return res.status(403).send("Acceso denegado");
  let tokensHtml = Object.entries(validTokens).map(([token, data]) => {
    return `<li><code>${token}</code> → ${data.usado ? "🛑 Bloqueado" : "🟢 Disponible"}</li>`;
  }).join("");

  res.send(`
    <!DOCTYPE html><html><head><meta charset='UTF-8'><title>Admin Micro Smart</title>
    <style>
      body { background: #0d1117; color: #00ffcc; font-family: Arial, sans-serif; padding: 2em; }
      h2 { color: #00ffcc; }
      button { padding: 10px 20px; margin: 5px; background: #00ffcc; border: none; color: black; font-weight: bold; border-radius: 8px; cursor: pointer; }
      button:hover { background: #00ddaa; }
      .token-list { background: #161b22; padding: 1em; border-radius: 10px; margin-top: 1em; }
      code { background: #222; padding: 2px 6px; border-radius: 4px; }
    </style></head>
    <body>
    <h2>Panel de Administración Micro Smart</h2>
    <p><strong>👤 Usuario activo:</strong> ${activeUser || "Ninguno"}</p>
    <p><strong>🔐 Token activo:</strong> ${activeToken || "Ninguno"}</p>

    <form action="/release" method="get" style="display:inline">
      <input type="hidden" name="pass" value="${ADMIN_PASSWORD}">
      <button type="submit">🔓 Liberar control</button>
    </form>

    <form action="/token" method="get" style="display:inline">
      <input type="hidden" name="pass" value="${ADMIN_PASSWORD}">
      <button type="submit">➕ Generar nuevo token</button>
    </form>

    <div class="token-list">
      <h3>🧾 Tokens generados:</h3>
      <ul>${tokensHtml}</ul>
    </div>
    </body></html>
  `);
});

app.get("/release", (req, res) => {
  if (req.query.pass !== ADMIN_PASSWORD) return res.status(403).send("Acceso denegado");
  activeToken = null;
  activeUser = null;
  lastAccessTime = null;
  res.redirect(`/admin?pass=${ADMIN_PASSWORD}`);
});

app.get("/token", (req, res) => {
  if (req.query.pass !== ADMIN_PASSWORD) return res.status(403).send("Acceso denegado");
  const newToken = Math.random().toString(36).substring(2, 8).toUpperCase();
  validTokens[newToken] = { usado: false };
  res.redirect(`/admin?pass=${ADMIN_PASSWORD}`);
});

app.get("/auth", (req, res) => {
  const { token, user } = req.query;
  if (!token || !user) return res.status(400).send("Faltan datos");

  const now = Date.now();
  if (!validTokens[token]) return res.status(403).send("Token inválido");
  if (validTokens[token].usado) return res.status(403).send("Token ya fue usado");

  // si no hay nadie o expiró el control anterior
  if (!activeUser || now - lastAccessTime > MAX_SESSION_TIME || now - lastAccessTime > INACTIVITY_LIMIT) {
    activeToken = token;
    activeUser = user;
    lastAccessTime = now;
    validTokens[token].usado = true; // 🔐 marca como inservible
    return res.send("Acceso concedido");
  }

  return res.status(403).send("Otro usuario tiene el control actualmente");
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
