// server.js
const express = require("express");
const cors = require("cors");
const app = express();
const port = process.env.PORT || 3000;

app.use(cors());

let lastCommand = null;

// Ruta para recibir comandos desde la web
app.get("/comando", (req, res) => {
  const { servo, angle } = req.query;
  if (servo && angle) {
    lastCommand = { servo: parseInt(servo), angle: parseInt(angle) };
    console.log("Comando recibido:", lastCommand);
    res.send("OK");
  } else {
    res.status(400).send("Faltan parámetros servo o angle");
  }
});

// Ruta para el ESP32: pide el siguiente comando
app.get("/next", (req, res) => {
  if (lastCommand) {
    res.json(lastCommand);
    lastCommand = null; // se limpia después de enviar al ESP32
  } else {
    res.json({});
  }
});

app.listen(port, () => {
  console.log(`Servidor escuchando en http://localhost:${port}`);
});
