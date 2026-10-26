# Matera Inteligente · Frontend

Cliente web estático (HTML, CSS y JavaScript sin dependencias) del proyecto
Matera Inteligente. Consume el backend del repositorio **matera-backend**
únicamente por el contrato HTTP/JSON documentado en `docs/API.md` de ese repo:
ningún archivo de este repositorio importa código del otro.

## Qué hace

- Registro e inicio de sesión. Guarda el JWT de usuario y lo envía en
  `Authorization: Bearer <token>` en cada petición autenticada.
- Vincular una planta con el código de emparejamiento del dispositivo, y mostrar
  una vez el token de dispositivo que devuelve el backend (es el que recibe el
  simulador del ESP32 en `--token`).
- Listar las plantas del usuario y mostrar el estado de la seleccionada,
  **refrescándose solo cada 5 segundos**, con el historial de las últimas lecturas.
- Evaluación manual de lecturas sueltas (el requisito R1 de la fase 1).

## Cómo ejecutarlo

Es un sitio estático: no necesita build ni npm. Hay que servirlo por HTTP
(abrirlo con doble clic como `file://` rompe las peticiones por CORS).

```bash
python3 -m http.server 5500
```

Luego abrir <http://localhost:5500>. En VS Code también sirve la extensión
*Live Server*.

## Configuración

Todo está en `config.js`; no hay URLs dentro de `app.js`.

| Clave | Para qué |
|---|---|
| `API_BASE_URL` | URL del backend, sin barra final. Local: `http://127.0.0.1:5000` |
| `REFRESCO_MS` | Cada cuánto se vuelve a pedir el estado de la planta (5000 ms) |
| `USAR_MOCKS` | `true` = el front funciona solo con las respuestas de ejemplo; `false` = habla con el backend real |
| `MOCKS` | Respuestas de ejemplo tomadas de `docs/API.md`. Son el contrato esperado |

Mientras el backend no esté listo, dejar `USAR_MOCKS: true` y desarrollar contra
esos ejemplos. Para la sustentación hay que ponerlo en `false`.

## Lo que el backend tiene que cumplir

El backend debe permitir el origen desde el que se sirve este front
(variable `MATERA_CORS_ORIGINS`, por ejemplo `http://localhost:5500`) y aceptar
la cabecera `Authorization`.

Endpoints que consume este repositorio:

| Endpoint | Auth |
|---|---|
| `POST /api/auth/registro` | pública |
| `POST /api/auth/login` | pública |
| `GET /api/especies` | JWT usuario |
| `POST /api/evaluar` | JWT usuario |
| `POST /api/plantas` | JWT usuario |
| `GET /api/plantas` | JWT usuario |
| `GET /api/plantas/{id}/estado` | JWT usuario |
| `GET /api/plantas/{id}/historial?limite=10` | JWT usuario |

`POST /api/dispositivos/{id}/lecturas` no se usa aquí: lo consume el simulador
del ESP32, que vive en el repositorio del backend.

Las respuestas de estado, historial y evaluación se esperan con la forma anidada:

```json
{
  "planta_id": "p-001",
  "nombre": "Orquídea de la sala",
  "especie": "Orquidea",
  "marca_tiempo": "2026-10-26T21:40:00Z",
  "lecturas":  { "humedad": 52.0, "luz": 15200.0, "temperatura": 21.4 },
  "estados":   { "humedad": "OPTIMO", "luz": "OPTIMO", "temperatura": "OPTIMO" },
  "vitalidad": { "porcentaje": 100.0, "nivel": "EXCELENTE" }
}
```

Los errores se esperan como `{"error": "mensaje"}` con el código HTTP que
corresponda: 400 lectura inválida, 401 credenciales o token, 403 planta ajena,
404 no encontrado, 409 correo o dispositivo repetido.

## Estructura

```
matera-frontend/
  index.html     vista de autenticación y panel
  app.js         capa de API, autenticación, refresco y render
  config.js      URL del backend, refresco y respuestas de ejemplo
  styles.css     estilos (glassmorphism)
  README.md
```

## Nota

El JWT se guarda en `localStorage` para que la sesión sobreviva a un refresco de
página. Un `401` del backend cierra la sesión automáticamente.
