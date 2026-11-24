# agent: agente de sincronización con Everything (HU-166)

Programa de consola que se instala en el PC del CLENA. Consulta el servidor HTTP de *Everything* en ese mismo PC y envía cada página, **tal como la respondió Everything**, a los endpoints de ingesta de Trackhive (HU-137). Solo hace conexiones salientes por HTTPS: los servidores de Trackhive nunca tienen que llegar al PC del CLENA (decisión en [D-17](../docs/arquitectura.md#d-17-sin-integración-automática-con-everything-ni-lectura-de-buzón-imap)).

- **Instalación y operación en el CLENA:** [docs/manual-operacion.md, sección 10](../docs/manual-operacion.md#10-agente-de-sincronización-con-everything-hu-166).
- **Endpoints de ingesta y desarrollo con el mock:** [docs/everything-desarrollo.md, sección 7](../docs/everything-desarrollo.md#7-sincronización-con-el-backend-hu-137).

## Qué hace en cada ejecución

1. Lee `agente.toml` (junto al `.exe`) y se niega a correr si algo está mal o no es seguro: `trackhive.url` con `http://` que no sea `localhost`, un token de menos de 32 caracteres, Everything fuera de este PC, raíces que no son rutas de Windows…
2. Espera a Everything hasta `startup_wait_seconds` si todavía no responde o si responde con el índice vacío: recién abierto, Everything contesta antes de cargar su base de datos (la tarea corre al encender el PC).
3. Inicia una corrida en Trackhive.
4. Por cada raíz pide a Everything **solo carpetas** (`folder:` + la raíz con la barra final) por páginas, con `offset` y `count=200`, y envía cada página sin transformarla. Las páginas se numeran desde 1 en toda la corrida, aunque cambie de raíz.
5. Cierra la corrida **completa** (`{"result":"OK","pageCount":N}`) solo si llegaron todas las páginas de todas las raíces. Si Everything no responde o tarda más que `timeout_seconds`, la cierra **con error** y lo deja en el log: Trackhive no marca nada como no encontrado.

Si Trackhive no responde (red, tiempo de espera, 5xx), cada petición se reintenta hasta `attempts` veces con una espera que se duplica (5, 10, 20, 40 s). Una página se reenvía con el mismo número, que la reemplaza. Un error que reintentar no arregla (401, 409, 413, certificado inválido…) no se reintenta. Si no lo logra, termina con error y la siguiente ejecución vuelve a intentarlo.

| Código de salida | Significado |
|---|---|
| 0 | Corrida completa |
| 1 | La sincronización falló (Everything o Trackhive). El motivo está en el log y, si la corrida alcanzó a iniciarse, en Trackhive |
| 2 | Configuración inválida o insegura: no se conectó a nada |

El log queda en `logs\agente.log`, junto a `agente.toml`. Rota a 1 MB y guarda 5 archivos anteriores. Nunca escribe el token ni la contraseña de Everything.

## Estructura

Las mismas capas del backend (D-25), con la regla de dependencia verificada en `tests/test_arquitectura.py`:

```text
agent/
├── agente.py                 # punto de entrada (python agent/agente.py y el .exe)
├── agente.example.toml       # configuración de ejemplo, sin secretos
├── construir_exe.py          # trackhive-agente.exe con PyInstaller
├── instalar-tarea.ps1        # la tarea diaria del Programador de tareas
├── requirements.txt          # truststore (certificados con el almacén de Windows)
├── requirements-build.txt    # + PyInstaller
├── trackhive_agent/
│   ├── domain/               # AgentRun (reglas del cierre), EverythingPage, política de conexión, errores
│   ├── application/          # SynchronizeUseCase, Retrier, puertos (IEverythingClient, ITrackhiveClient, IClock) y DTOs
│   ├── infrastructure/       # clientes HTTP, TLS, agente.toml, log y reloj
│   └── presentation/         # cli.py: argumentos, composición y códigos de salida
└── tests/
```

## Probar

Desde la raíz del repositorio, con Python 3.11 o superior:

```bash
pip install -r dev/requirements.txt -r agent/requirements.txt
python -m unittest discover -s agent/tests -t agent -v
```

| Archivo | Qué prueba |
|---|---|
| `test_dominio.py` | Numeración de páginas, que una corrida con un fallo nunca cierra completa, paginación y la política HTTPS |
| `test_configuracion.py` | `agente.toml`: valores por defecto, rechazos (http://, token corto, raíces), el ejemplo sin secretos y con las raíces de `backend/config/catalog-convention.json` |
| `test_sincronizar.py` | El caso de uso con fakes en memoria y un reloj falso: corrida completa, Everything caído o lento, reintentos con espera creciente, errores que no se reintentan |
| `test_clientes.py` | Los clientes HTTP contra el mock de Everything (HU-133) y los fixtures del real, un Trackhive falso y HTTPS con un certificado de prueba |
| `test_agente.py` | El agente como proceso, igual que lo ejecuta el Programador de tareas, contra el mock y el Trackhive falso |
| `test_tarea_windows.py` | `instalar-tarea.ps1` crea una tarea real y revisa su XML. Solo en Windows con `TRACKHIVE_PROBAR_TAREA=1` |
| `test_arquitectura.py` | Ninguna capa importa una exterior; el dominio y la aplicación no hacen E/S |

Las pruebas de HTTPS crean una CA y un certificado de prueba con `openssl` en cada ejecución; sin `openssl` se omiten.

El job `agente` del CI las corre en Ubuntu y en Windows. En Windows además construye el `.exe`, repite `test_agente.py` contra el `.exe` (`TRACKHIVE_AGENTE_EXE`), prueba la tarea programada y publica el artefacto `trackhive-agente` con el `.exe`, `agente.example.toml` e `instalar-tarea.ps1`.

## Probar contra el backend y el mock en Docker

```bash
# En la raíz, con EVERYTHING_AGENT_TOKEN en el .env (openssl rand -hex 32)
docker compose --profile everything up -d --build backend everything-mock

cp agent/agente.example.toml agent/agente.toml   # agente.toml no se sube (.gitignore)
# En agent/agente.toml: [trackhive] url = 'http://127.0.0.1:3000' y token = el del .env
python agent/agente.py
```

## Construir el .exe

En Windows:

```powershell
pip install -r agent\requirements-build.txt
python agent\construir_exe.py
```

`agent\dist\` queda con `trackhive-agente.exe`, `agente.example.toml` e `instalar-tarea.ps1`: lo que se copia al PC del CLENA. El `.exe` lleva Python dentro, así que el PC no necesita nada instalado. Se construye con `--hide-console`: si lo inicia el Programador de tareas no abre ninguna ventana, y si se ejecuta desde una consola escribe en ella.
