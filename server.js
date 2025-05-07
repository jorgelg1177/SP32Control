// index.html para el panel de usuario
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Micro Smart - Control de Brazo</title>
  <style>
    body {
      background-color: #0d1117;
      color: #00ffcc;
      font-family: 'Arial', sans-serif;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100vh;
      margin: 0;
    }
    h1 {
      margin-bottom: 1em;
    }
    input, button {
      padding: 10px;
      font-size: 16px;
      border-radius: 5px;
      border: none;
      margin: 5px;
    }
    input {
      width: 200px;
    }
    button {
      background-color: #00ffcc;
      color: #000;
      cursor: pointer;
      font-weight: bold;
    }
    #mensaje {
      margin-top: 20px;
      font-size: 18px;
      font-weight: bold;
      color: #ff5555;
    }
  </style>
</head>
<body>
  <h1>Ingresa tu Token</h1>
  <input type="text" id="token" placeholder="Ej: ABC123">
  <button onclick="verificarToken()">Entrar</button>
  <div id="mensaje"></div>

  <script>
    async function verificarToken() {
      const token = document.getElementById("token").value.toUpperCase();
      const nombre = prompt("Ingresa tu nombre o ID único:");
      if (!token || !nombre) return alert("Debes ingresar el token y tu nombre.");

      const res = await fetch(`/auth?token=${token}&user=${nombre}`);
      const text = await res.text();

      if (res.ok) {
        localStorage.setItem("token", token);
        localStorage.setItem("user", nombre);
        location.href = "/control.html";
      } else {
        let mensaje = "";
        if (text.includes("inválido")) mensaje = "❌ Token inválido";
        else if (text.includes("usado")) mensaje = "🚫 Este token ya fue usado. No se puede usar más";
        else if (text.includes("otro")) mensaje = "⚠️ El control está siendo usado por otro usuario";
        else mensaje = text;
        document.getElementById("mensaje").textContent = mensaje;
      }
    }
  </script>
</body>
</html>
