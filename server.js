// server.js - versión mejorada con logs, liberación automática y administración mejorada

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
let gameStartTime = null;

const logs = []; // Para guardar historial de partidas

const ADMIN_PASSWORD = "microsmart";
const MAX_SESSION_TIME = 2 * 60 * 1000;
const INACTIVITY_LIMIT = 30 * 1000;

// --- Panel de administración ---
app.get("/admin", (req, res) => {
  if (req.query.pass !== ADMIN_PASSWORD) return res.status(403).send("Acceso denegado");
  res.send(`
    <!DOCTYPE html><html><head><meta charset='UTF-8'><title>Admin Micro Smart</title>
    <style>
      body { background: #0d1117; color: #00ffcc; font-family: Arial, sans-serif; padding: 2em; }
      h2 { color: #00ffcc; }
      button { padding: 10px 20px; margin: 5px; background: #00ffcc; border: none; color: black; font-weight: bold; border-radius: 8px; cursor: pointer; }
      button:hover { background:#00ddaa; }
      .token-list { background: #161b22; padding: 1em; border-radius: 10px; margin-top: 1em; }
      code { background: #222; padding: 2px 6px; border-radius: 4px; }
      .log-list { background: #232a39; padding: 1em; border-radius: 10px; margin-top: 1em; }
      .contador { margin: 10px 0; }
    </style></head><body>
    <h2>Panel de Administración Micro Smart</h2>
    <p><strong>👤 Usuario activo:</strong> <span id="usuario">Cargando...</span></p>
    <p><strong>🔐 Token activo:</strong> <span id="token">Cargando...</span></p>
    <p class="contador"><strong>🎮 Partidas jugadas:</strong> <span id="contador">0</span></p>
    <p><strong>Último jugador:</strong> <span id="lastPlayer">-</span></p>

    <form action="/release" method="get" style="display:inline">
      <input type="hidden" name="pass" value="${ADMIN_PASSWORD}">
      <button>🔓 Liberar control</button>
    </form>
    <form action="/token" method="get" style="display:inline">
      <input type="hidden" name="pass" value="${ADMIN_PASSWORD}">
      <button>➕ Generar nuevo token</button>
    </form>
    <form action="/cleartokens" method="get" style="display:inline">
      <input type="hidden" name="pass" value="${ADMIN_PASSWORD}">
      <button style="background:#ff4444;color:white;">🧹 Limpiar todos los tokens</button>
    </form>
    <a href="/logs?pass=${ADMIN_PASSWORD}" target="_blank">
      <button style="background:#228be6;color:white;">📄 Ver/descargar logs</button>
    </a>

    <div class="token-list">
      <h3>🧾 Tokens generados:</h3>
      <ul id="listaTokens"></ul>
    </div>

    <script>
      function copiarToken(token) {
        navigator.clipboard.writeText(token).then(() => {
          alert("Token copiado: " + token);
        }).catch(() => alert("No se pudo copiar"));
      }

      function actualizarEstado() {
        fetch("/estado?pass=${ADMIN_PASSWORD}")
          .then(res => res.json())
          .then(data => {
            document.getElementById("usuario").textContent = data.usuario || "Ninguno";
            document.getElementById("token").textContent = data.token || "Ninguno";
            document.getElementById("contador").textContent = data.logs.length;
            document.getElementById("lastPlayer").textContent = data.logs.length > 0 ? data.logs[data.logs.length-1].user : "-";
            const ul = document.getElementById("listaTokens");
            ul.innerHTML = "";
            Object.entries(data.tokens).forEach(([clave, valor]) => {
              const li = document.createElement("li");
              li.innerHTML = \`
                <code>\${clave}</code> → \${valor.usado ? "🛑 Bloqueado" : "🟢 Disponible"}
                <button onclick="copiarToken('\${clave}')">📋 Copiar</button>
                <a href="/bloquear?pass=${ADMIN_PASSWORD}&token=\${clave}"><button>🔒 Bloquear</button></a>
              \`;
              ul.appendChild(li);
            });
          });
      }
      setInterval(actualizarEstado, 1000);
      actualizarEstado();
    </script>
  </body></html>
  `);
});

// --- Estado JSON con logs ---
app.get("/estado", (req, res) => {
  if (req.query.pass !== ADMIN_PASSWORD) return res.status(403).send("Acceso denegado");
  res.json({ usuario: activeUser, token: activeToken, tokens: validTokens, logs });
});

// --- Liberar control manual ---
app.get("/release", (req, res) => {
  if (req.query.pass !== ADMIN_PASSWORD) return res.status(403).send("Acceso denegado");
  liberarControl();
  res.redirect(`/admin?pass=${ADMIN_PASSWORD}`);
});

// --- Limpiar tokens ---
app.get("/cleartokens", (req, res) => {
  if (req.query.pass !== ADMIN_PASSWORD) return res.status(403).send("Acceso denegado");
  liberarControl();
  validTokens = {};
  res.redirect(`/admin?pass=${ADMIN_PASSWORD}`);
});

// --- Bloquear manualmente un token ---
app.get("/bloquear", (req, res) => {
  if (req.query.pass !== ADMIN_PASSWORD || !req.query.token) return res.status(403).send("Acceso denegado");
  const t = req.query.token.toUpperCase();
  if (validTokens[t]) validTokens[t].usado = true;
  res.redirect(`/admin?pass=${ADMIN_PASSWORD}`);
});

// --- Generar token ---
app.get("/token", (req, res) => {
  if (req.query.pass !== ADMIN_PASSWORD) return res.status(403).send("Acceso denegado");
  const newToken = Math.random().toString(36).substring(2, 8).toUpperCase();
  validTokens[newToken] = { usado: false };
  res.redirect(`/admin?pass=${ADMIN_PASSWORD}`);
});

// --- Autenticación y reinicio limpio de estado ---
app.get("/auth", (req, res) => {
  const { token, user } = req.query;
  if (!token || !user) return res.status(400).send("Faltan datos");
  const now = Date.now();
  const t = token.toUpperCase();
  if (!validTokens[t]) return res.status(403).send("Token inválido");
  if (validTokens[t].usado) return res.status(403).send("Este token ya fue usado");

  // Si está libre o expiró sesión, reinicia sesión limpia
  if (!activeUser || now - lastAccessTime > MAX_SESSION_TIME || now - lastAccessTime > INACTIVITY_LIMIT) {
    activeToken = t;
    activeUser = user;
    lastAccessTime = now;
    gameStartTime = now;
    validTokens[t].usado = true;
    return res.send("Acceso concedido");
  }
  return res.status(403).send("El control está siendo usado por otro usuario");
});

// --- Comando de control ---
app.get("/comando", (req, res) => {
  const { servo, angle, token, user } = req.query;
  if (!servo || !angle || !token || !user) return res.status(400).send("Faltan parámetros");
  if (token !== activeToken || user !== activeUser) return res.status(403).send("No tienes permiso");
  lastAccessTime = Date.now();
  lastCommand = { servo: parseInt(servo), angle: parseInt(angle) };
  res.send("OK");
});

// --- Fin de juego (llamado desde el frontend cuando termina la partida) ---
app.get("/finjuego", (req, res) => {
  if (!activeUser || !activeToken) return res.status(400).send("No hay juego activo");
  const now = Date.now();
  const duracion = Math.round((now - gameStartTime) / 1000); // segundos
  logs.push({
    user: activeUser,
    token: activeToken,
    fecha: new Date(now).toISOString(),
    duracion
  });
  liberarControl();
  res.send("Juego finalizado y control liberado");
});

// --- Obtener último comando ---
app.get("/next", (req, res) => {
  if (lastCommand) {
    res.json(lastCommand);
    lastCommand = null;
  } else {
    res.json({});
  }
});

// --- Logs de partidas (admin) ---
app.get("/logs", (req, res) => {
  if (req.query.pass !== ADMIN_PASSWORD) return res.status(403).send("Acceso denegado");
  // Permite ver y descargar como JSON
  res.send(`
    <html>
    <head>
      <title>Logs Micro Smart</title>
      <style>
        body { background: #161b22; color: #00ffcc; font-family: Arial, sans-serif; }
        table { width: 100%; border-collapse: collapse; margin-top: 2em; }
        th, td { padding: 8px; border: 1px solid #00ffcc44; text-align: left; }
        th { background: #222; }
        tr:nth-child(even) { background: #232a39; }
        .boton-descargar { margin: 20px; padding: 10px 20px; background:#228be6; color:white; border:none; border-radius:8px; cursor:pointer;}
      </style>
    </head>
    <body>
      <h2>Historial de partidas</h2>
      <button class="boton-descargar" onclick="descargar()">Descargar como JSON</button>
      <table>
        <tr><th>Usuario</th><th>Token</th><th>Fecha/Hora</th><th>Duración (s)</th></tr>
        ${logs.map(l => `<tr><td>${l.user}</td><td>${l.token}</td><td>${l.fecha}</td><td>${l.duracion}</td></tr>`).join("")}
      </table>
      <script>
        function descargar() {
          const data = ${JSON.stringify(logs)};
          const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], {type:"application/json"}));
          const a = document.createElement("a");
          a.href = url;
          a.download = "logs-microsmart.json";
          a.click();
          setTimeout(()=>URL.revokeObjectURL(url),1000);
        }
      </script>
    </body>
    </html>
  `);
});

// --- Función para liberar el control y resetear estado ---
function liberarControl() {
  activeToken = null;
  activeUser = null;
  lastAccessTime = null;
  gameStartTime = null;
}

app.listen(port, () => {
  console.log(`Servidor escuchando en http://localhost:${port}`);
});
