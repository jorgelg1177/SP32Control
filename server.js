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
const MAX_SESSION_TIME = 2 * 60 * 1000; // 2 minutos
const INACTIVITY_LIMIT = 30 * 1000;     // 30 segundos

// Panel de administración
app.get("/admin", (req, res) => {
  if (req.query.pass !== ADMIN_PASSWORD) return res.status(403).send("Acceso denegado");
  res.send(`<!DOCTYPE html><html><head><meta charset="UTF-8">
  <title>Panel Admin</title>
  <style>
    body { font-family: Arial; background: #111; color: #00ffcc; padding: 20px; }
    button { padding: 10px 20px; margin: 5px; background: #00ffcc; color: black; font-weight: bold; border: none; border-radius: 5px; cursor: pointer; }
    .token-list { background: #222; padding: 10px; border-radius: 5px; margin-top: 10px; }
    code { background: #000; padding: 3px 6px; border-radius: 3px; }
  </style>
  </head><body>
    <h1>Panel de Administración Micro Smart</h1>
    <p>🧑 Usuario activo: <strong id="usuario">Cargando...</strong></p>
    <p>🔐 Token activo: <strong id="token">Cargando...</strong></p>

    <form action="/release" method="get">
      <input type="hidden" name="pass" value="${ADMIN_PASSWORD}">
      <button type="submit">🔓 Liberar control</button>
    </form>

    <form action="/token" method="get">
      <input type="hidden" name="pass" value="${ADMIN_PASSWORD}">
      <button type="submit">➕ Generar nuevo token</button>
    </form>

    <div class="token-list">
      <h3>🧾 Tokens generados:</h3>
      <ul id="listaTokens"></ul>
    </div>

    <script>
      function actualizarEstado() {
        fetch("/estado?pass=${ADMIN_PASSWORD}")
          .then(res => res.json())
          .then(data => {
            document.getElementById("usuario").textContent = data.usuario || "Ninguno";
            document.getElementById("token").textContent = data.token || "Ninguno";
            const ul = document.getElementById("listaTokens");
            ul.innerHTML = "";
            Object.entries(data.tokens).forEach(([clave, valor]) => {
              const li = document.createElement("li");
              li.innerHTML = \`<code>\${clave}</code> → \${valor.usado ? "🛑 Bloqueado" : "🟢 Disponible"}\`;
              ul.appendChild(li);
            });
          });
      }
      setInterval(actualizarEstado, 1000);
      actualizarEstado();
    </script>
  </body></html>`);
});

// Ver estado desde panel
app.get("/estado", (req, res) => {
  if (req.query.pass !== ADMIN_PASSWORD) return res.status(403).send("Acceso denegado");
  res.json({
    usuario: activeUser,
    token: activeToken,
    tokens: validTokens
  });
});

// Generar token
app.get("/token", (req, res) => {
  if (req.query.pass !== ADMIN_PASSWORD) return res.status(403).send("Acceso denegado");
  const newToken = Math.random().toString(36).substring(2, 8).toUpperCase();
  validTokens[newToken] = { usado: false };
  res.redirect(`/admin?pass=${ADMIN_PASSWORD}`);
});

// Liberar control manual
app.get("/release", (req, res) => {
  if (req.query.pass !== ADMIN_PASSWORD) return res.status(403).send("Acceso denegado");
  activeToken = null;
  activeUser = null;
  lastAccessTime = null;
  res.redirect(`/admin?pass=${ADMIN_PASSWORD}`);
});

// Autenticación del usuario
app.get("/auth", (req, res) => {
  const { token, user } = req.query;
  if (!token || !user) return res.status(400).send("Faltan datos");

  const now = Date.now();
  if (!validTokens[token]) return res.status(403).send("Token inválido");
  if (validTokens[token].usado) return res.status(403).send("Este token ya fue usado");

  if (!activeUser || now - lastAccessTime > MAX_SESSION_TIME || now - lastAccessTime > INACTIVITY_LIMIT) {
    activeToken = token;
    activeUser = user;
    lastAccessTime = now;
    validTokens[token].usado = true;
    return res.send("Acceso concedido");
  }

  return res.status(403).send("El control está siendo usado por otro usuario");
});

// Recibir comando del usuario autorizado
app.get("/comando", (req, res) => {
  const { servo, angle, token, user } = req.query;
  if (!servo || !angle || !token || !user) return res.status(400).send("Faltan parámetros");

  const now = Date.now();
  if (token !== activeToken || user !== activeUser) return res.status(403).send("No tienes permiso");

  lastAccessTime = now;
  lastCommand = { servo: parseInt(servo), angle: parseInt(angle) };
  res.send("OK");
});

// Obtener siguiente comando
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
