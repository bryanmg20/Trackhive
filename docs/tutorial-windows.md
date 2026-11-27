# Tutorial: Trackhive desde cero en Windows

Este tutorial lleva un PC con Windows 10 u 11 desde cero (sin el repositorio, sin `.env` y sin ningún token) hasta tener Trackhive funcionando y **sincronizando su catálogo con un Everything real** a través del agente. Al final habrás hecho una sincronización a mano, una con «Sincronizar ahora» desde la web y otra con las tareas programadas, igual que en el CLENA.

Se puede seguir con cualquiera de los dos Everything:

| | **Everything portable** | **Everything instalado** |
|---|---|---|
| Para qué | Desarrollo. Es la opción recomendada | Probar como en el CLENA, donde Everything está instalado |
| Qué indexa | Solo `C:\trackhive\docs_simulados` | Todo tu disco `C:` (y con él, la carpeta simulada) |
| Configuración | Viene lista en el repositorio (un `.ini`) | A mano, en Herramientas → Opciones |
| Servidor HTTP | `127.0.0.1:8081`, usuario `trackhive`, contraseña `trackhive-dev` | `127.0.0.1:8082`, usuario y contraseña que tú elijas |
| ¿Toca tu Everything personal? | No: es una instancia aparte | Sí: le enciende el servidor HTTP mientras pruebas |

Los pasos 0 a 4 y 6 a 11 son iguales para los dos. El paso 5 tiene una parte para cada uno (**5A** portable, **5B** instalado). Puedes hacer los dos y cambiar de uno a otro (paso 10).

## Contenido

- [Cómo encajan las piezas](#cómo-encajan-las-piezas)
- [Qué secretos vas a necesitar](#qué-secretos-vas-a-necesitar)
- [Paso 0. Instalar las herramientas](#paso-0-instalar-las-herramientas)
- [Paso 1. Clonar el repositorio](#paso-1-clonar-el-repositorio)
- [Paso 2. Crear el `.env`](#paso-2-crear-el-env)
- [Paso 3. Levantar Trackhive con Docker](#paso-3-levantar-trackhive-con-docker)
- [Paso 4. Generar las carpetas simuladas con el script](#paso-4-generar-las-carpetas-simuladas-con-el-script)
- [Paso 5A. Everything portable](#paso-5a-everything-portable)
- [Paso 5B. Everything instalado](#paso-5b-everything-instalado)
- [Paso 6. Preparar el agente](#paso-6-preparar-el-agente)
- [Paso 7. Primera sincronización, a mano](#paso-7-primera-sincronización-a-mano)
- [Paso 8. «Sincronizar ahora» desde la web](#paso-8-sincronizar-ahora-desde-la-web)
- [Paso 9. Las tareas programadas, como en el CLENA](#paso-9-las-tareas-programadas-como-en-el-clena)
- [Paso 10. Cambiar de Everything](#paso-10-cambiar-de-everything)
- [Paso 11. Ver cómo reacciona a cambios en las carpetas](#paso-11-ver-cómo-reacciona-a-cambios-en-las-carpetas)
- [Apagar todo y volver a empezar](#apagar-todo-y-volver-a-empezar)
- [Problemas frecuentes](#problemas-frecuentes)

## Cómo encajan las piezas

```text
 Navegador ──► http://localhost:8080  frontend (Docker)
                        │ /api
                        ▼
                  backend :3000 (Docker) ──► PostgreSQL (Docker)
                        ▲
                        │  HTTP + EVERYTHING_AGENT_TOKEN
                        │
             trackhive-agente.exe  (en Windows, fuera de Docker)
                        │  HTTP + usuario y contraseña, solo 127.0.0.1
                        ▼
             Everything: portable :8081  o  instalado :8082
                        │  indexa
                        ▼
             C:\trackhive\docs_simulados   ◄── lo crea generar_docs.py
```

- El **backend nunca llama a Everything**. El agente le pregunta a Everything qué carpetas hay y le envía cada página al backend, tal cual.
- Cada **carpeta hoja** (la carpeta de un mes, con sus imágenes) es un material con copia digital. Al cerrar la sincronización, el backend crea o actualiza esos materiales y marca como «copia digital no encontrada» los que ya no están.
- En el CLENA las carpetas están en una unidad de red (`Z:`). Aquí se simulan con un **árbol de carpetas falso** que genera un script del repositorio: mismos nombres de carpeta, imágenes vacías y ningún dato real.

En tu PC quedará esto:

```text
%USERPROFILE%\Trackhive\       ← el repositorio (paso 1)
C:\trackhive\
├── docs_simulados\           ← el árbol simulado (paso 4)
├── manifiesto.json           ← lo que el parseo debe sacar de cada carpeta (paso 4)
├── everything-portable\      ← solo si usas el portable (paso 5A)
└── agente\                   ← trackhive-agente.exe, agente.toml y logs\ (paso 6)
```

> **`C:\trackhive\docs_simulados` no se puede cambiar.** Es la ruta que usan la convención de carpetas del backend (`backend/config/catalog-convention.json`), los datos de la semilla y las respuestas reales de Everything guardadas en el repositorio. Con otra ruta, la sincronización termina con error porque no encuentra ninguna carpeta hoja.

## Qué secretos vas a necesitar

Nadie tiene que pasarte ningún secreto ni hay que generar ninguno: vienen en las plantillas del repositorio, con valores **solo para desarrollo**, o los eliges tú:

| Secreto | De dónde sale | Dónde va |
|---|---|---|
| `EVERYTHING_AGENT_TOKEN` | Ya viene en `.env.example` y en `agente.example.toml`: el mismo valor en los dos, público y solo para desarrollo. Si prefieres, generas uno propio en el paso 2 | En el `.env` (backend) **y** en `trackhive.token` del `agente.toml`. Tiene que ser **el mismo valor** en los dos: si cambias uno, cambia el otro |
| Usuario y contraseña de Everything | Portable: ya vienen en el `.ini` del repositorio (`trackhive` / `trackhive-dev`). Instalado: los eliges tú en el paso 5B | En Everything y en `everything.user` / `everything.password` del `agente.toml` |
| Contraseñas de la base de datos, secretos JWT, usuarios de prueba | Ya vienen en `.env.example`, con valores **solo para desarrollo** | En el `.env` |

No hace falta ninguna cuenta ni token de GitHub: el repositorio es público. El `.env` y el `agente.toml` nunca se suben al repositorio (están en `.gitignore`).

## Paso 0. Instalar las herramientas

Necesitas Windows 10 u 11 de 64 bits, permisos de administrador para instalar y la virtualización activada en la BIOS (Docker la necesita; casi todos los PC la traen activada).

| Herramienta | Versión | Para qué |
|---|---|---|
| [Git para Windows](https://git-scm.com/download/win) | cualquiera reciente | Clonar el repositorio |
| [Docker Desktop](https://www.docker.com/products/docker-desktop/) | Docker Compose 2.24 o superior | Levantar PostgreSQL, backend, frontend y Mailpit |
| [Python](https://www.python.org/downloads/windows/) | **3.11 o superior** (recomendado 3.12) | El script de las carpetas y construir el agente |
| [Everything](https://www.voidtools.com/downloads/) | 1.4.1 (las respuestas guardadas son de la 1.4.1.1032) | Se descarga en el paso 5A o 5B |

No hace falta instalar Node.js, pnpm ni PostgreSQL: Docker los trae dentro.

La forma más rápida es con `winget`, en una ventana de **PowerShell**:

```powershell
winget install --id Git.Git -e
```

```powershell
winget install --id Python.Python.3.12 -e
```

```powershell
winget install --id Docker.DockerDesktop -e
```

También puedes descargar los instaladores de los enlaces de la tabla. Con el instalador de Python, marca **«Add python.exe to PATH»** en la primera pantalla.

Después:

1. **Reinicia el PC** si el instalador de Docker lo pide (activa WSL 2).
2. **Abre Docker Desktop**, acepta los términos y espera a que diga *Engine running*. Si se queja de WSL, en PowerShell como administrador ejecuta `wsl --install` (o `wsl --update`) y reinicia. Docker Desktop tiene que estar abierto cada vez que uses Trackhive.
3. Abre una ventana **nueva** de PowerShell (para que vea el PATH nuevo) y comprueba:

   ```powershell
   git --version
   ```

   ```powershell
   python --version          # 3.11 o superior
   ```

   ```powershell
   docker compose version    # v2.24 o superior
   ```

   Si `python` no se reconoce o abre la Microsoft Store, desactiva los alias en **Configuración → Aplicaciones → Configuración avanzada de aplicaciones → Alias de ejecución de aplicaciones** (`python.exe` y `python3.exe`), o usa `py` en lugar de `python` en todo el tutorial.

## Paso 1. Clonar el repositorio

En PowerShell:

```powershell
cd $HOME
```

```powershell
git clone https://github.com/bryanmg20/Trackhive.git
```

```powershell
cd Trackhive
```

> Git para Windows cambia por defecto los finales de línea a los de Windows (CRLF). Los scripts `.sh`, que corren dentro de los contenedores de Linux, no se cambian: `.gitattributes` los deja siempre con LF. Con CRLF, el contenedor del frontend no arrancaría.

A partir de aquí, «la carpeta del repositorio» es `%USERPROFILE%\Trackhive` (en PowerShell, `$HOME\Trackhive`).

## Paso 2. Crear el `.env`

En PowerShell, en la carpeta del repositorio, crea el `.env` a partir de la plantilla:

```powershell
Copy-Item .env.example .env
```

No hay que cambiar nada: los valores de la plantilla sirven tal cual para desarrollo, también el token del agente.

> **El token del agente ya viene puesto** (`EVERYTHING_AGENT_TOKEN=trackhive-dev-token-…`) y es el mismo que trae `agente.example.toml`, así que el agente funciona sin tocarlo. Es público y solo sirve en desarrollo: con `RUN_SEED=false` (producción) el backend se niega a arrancar con él. Si borras la línea, Trackhive funciona, pero la sincronización queda **desactivada**: los endpoints del agente responden 503 y la pantalla Sincronización lo dice.

### Opcional: generar tu propio token

Si prefieres no usar el token de la plantilla, genera uno. Si no, salta al paso 3.

1. Genera el token (64 caracteres hexadecimales al azar) y cópialo al portapapeles. Ejecuta estos cinco comandos uno tras otro, en la misma ventana:

   Reserva 32 bytes:

   ```powershell
   $b = New-Object byte[] 32
   ```

   Llénalos al azar con el generador criptográfico de Windows:

   ```powershell
   [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($b)
   ```

   Conviértelos en 64 caracteres hexadecimales:

   ```powershell
   $token = -join ($b | ForEach-Object { $_.ToString('x2') })
   ```

   Cópialo al portapapeles:

   ```powershell
   $token | Set-Clipboard
   ```

   Muéstralo en pantalla:

   ```powershell
   $token
   ```

2. Abre el `.env` con el Bloc de notas:

   ```powershell
   notepad .env
   ```

   Busca la línea `EVERYTHING_AGENT_TOKEN=`, borra el valor de la plantilla y pega el token justo después del `=`, sin espacios ni comillas. Guarda y cierra:

   ```text
   EVERYTHING_AGENT_TOKEN=3f9c0a…(64 caracteres)…e41b
   ```

3. **El mismo valor va en `trackhive.token` del `agente.toml`** en el paso 6.2: si no lo cambias ahí también, el backend rechaza al agente (401). Si cierras la ventana, no lo pierdes: siempre puedes copiarlo del `.env`.

## Paso 3. Levantar Trackhive con Docker

En la carpeta del repositorio, con Docker Desktop abierto:

```powershell
docker compose up -d --build
```

La primera vez construye las imágenes y tarda varios minutos. Al arrancar, el backend aplica las migraciones, carga la semilla de demostración y crea el administrador.

**Comprueba:**

```powershell
docker compose ps
```

Deben aparecer cuatro servicios: `postgres` y `mailpit` en `healthy`, y `backend` y `frontend` en `Up`. Después:

```powershell
curl.exe http://127.0.0.1:3000/api/v1/health
# {"status":"ok","database":"up"}
```

(En PowerShell escribe `curl.exe`, no `curl`: `curl` es otro comando de PowerShell.)

Abre <http://localhost:8080> e inicia sesión como administrador:

| Rol | Correo | Contraseña |
|---|---|---|
| Administrador | `admin@example.com` | `admin12345678` |
| Personal | `personal1@example.com` | `public12345678` |
| Público | `publico1@example.com` | `public12345678` |

(Son `ADMIN_PASSWORD` y `SEED_DEMO_PASSWORD` del `.env`.)

En el menú, abre **Sincronización**. Debe decir que todavía no hay sincronizaciones y tener el botón «Sincronizar ahora» disponible. Si dice que la integración con Everything está **desactivada**, el backend no recibió el token: revisa que el `.env` tenga la línea `EVERYTHING_AGENT_TOKEN=` con el valor de `.env.example` (un `.env` copiado antes de que la plantilla lo trajera la tiene vacía) y ejecuta `docker compose up -d` para que el backend lo tome.

Otras direcciones útiles:

| Servicio | URL |
|---|---|
| Aplicación web | <http://localhost:8080> |
| Swagger de la API | <http://localhost:3000/docs> |
| Mailpit (correos de desarrollo) | <http://localhost:8025> |

> No levantes el perfil `everything` (`docker compose --profile everything …`). Es un **mock** de Everything para quien no tiene Windows, y usa el puerto 8081, el mismo del Everything portable. En este tutorial se usa el Everything real.

## Paso 4. Generar las carpetas simuladas con el script

El script [`dev/simulador/generar_docs.py`](../dev/simulador/generar_docs.py) crea un árbol de carpetas con la misma forma que el del CLENA, a partir de [`dev/simulador/convencion.yaml`](../dev/simulador/convencion.yaml). En la carpeta del repositorio:

Instala sus dependencias:

```powershell
python -m pip install -r dev\requirements.txt
```

Genera el árbol:

```powershell
python dev\simulador\generar_docs.py --salida C:\trackhive\docs_simulados --manifiesto C:\trackhive\manifiesto.json
```

Debe responder:

```text
Árbol: C:\trackhive\docs_simulados (142 carpetas, 377 archivos)
Huella SHA-256: 8f7cbac17e4e5a109f33d53e2fe8a27d681aa796588bb440fe3e78a5b3077fbe
Manifiesto: C:\trackhive\manifiesto.json (117 hojas: 106 válidas, 11 para revisión; 4 carpetas de trabajo excluidas)
```

Qué hacen las opciones:

| Opción | Qué es |
|---|---|
| `--salida` | Dónde crea el árbol. Tiene que ser `C:\trackhive\docs_simulados` (ver [Cómo encajan las piezas](#cómo-encajan-las-piezas)) |
| `--manifiesto` | Dónde escribe el manifiesto: la lista de carpetas hoja con el código, el título y el tipo que debe sacar el backend de cada una. Se escribe fuera del repositorio para no modificar `dev/manifiesto.json` |
| `--convencion` | Otro archivo de convención. Normalmente no se usa |

Lo que queda en disco:

```text
C:\trackhive\docs_simulados\
├── LEEME.txt
├── Aha\
│   ├── Fondo - Notarías\
│   │   ├── Notarías\                                          ← raíz del fondo
│   │   │   └── 1ra - Notaria Primera de Barranquilla - 1815 a 1979\   ← notaría
│   │   │       └── 1931 - Esc 1-1290 (12) +\                  ← año
│   │   │           └── 1ra-1931 - Esc 0001-0109 - Ene\        ← mes = carpeta hoja = un material
│   │   │               └── 001 - 1ra - 1931 - Esc 0001.jpg    ← imagen vacía (0 bytes)
│   │   └── Esc en PDF\                                        ← carpeta de trabajo: no es material
│   ├── Fondo - Periódicos\                                    ← raíz del fondo
│   └── Fondo - Correspondencia\                               ← raíz del fondo
├── 3ra-1950 - Esc 0051-0160 - Ene\                            ← carpetas de trabajo fuera de las raíces:
├── Empaste 2026\                                                 el agente no las pide
└── Escritura 1577\
```

- Las **tres raíces de los fondos** son las que el agente le pide a Everything, y las mismas que tiene el backend en `backend/config/catalog-convention.json`.
- El árbol trae **casos raros a propósito**: carpetas que no siguen el patrón, un mismo código en dos carpetas y meses partidos en dos. Por eso 11 de las 117 hojas quedan «para revisión».
- **Puedes volver a ejecutarlo cuando quieras**: borra y recrea el árbol completo, siempre igual. Solo borra una carpeta que él mismo creó (la reconoce por `LEEME.txt`); si `C:\trackhive\docs_simulados` existe y no la creó él, no la toca.
- Las imágenes son archivos vacíos: no hay ninguna imagen real ni dato personal del CLENA.

Más detalles del árbol y de las reglas del parseo: [everything-desarrollo.md](everything-desarrollo.md), secciones 1 y 2.

## Paso 5A. Everything portable

Una instancia de Everything aparte, llamada `trackhive`, con su propio `.ini`. Si ya tienes Everything instalado, no lo toca.

1. En <https://www.voidtools.com/downloads/> descarga el **Portable Zip** de 64 bits y descomprímelo en `C:\trackhive\everything-portable`, de modo que quede `C:\trackhive\everything-portable\Everything.exe`.

2. Copia la configuración del repositorio a esa carpeta. En la carpeta del repositorio:

   ```powershell
   Copy-Item dev\everything-portable\Everything-trackhive.ini C:\trackhive\everything-portable\
   ```

   Ese `.ini` ya deja todo listo: indexa solo `C:\trackhive\docs_simulados` (ningún disco), enciende el servidor HTTP en `127.0.0.1:8081` con usuario `trackhive` y contraseña `trackhive-dev`, y **no** permite descargar archivos.

3. Arranca la instancia:

   ```powershell
   C:\trackhive\everything-portable\Everything.exe -instance trackhive -config C:\trackhive\everything-portable\Everything-trackhive.ini -db C:\trackhive\everything-portable\Everything-trackhive.db -startup
   ```

   Queda en segundo plano, con su icono en la bandeja del sistema. Si abres su ventana, solo verás las carpetas simuladas. Si Windows pregunta por el firewall, puedes cancelar: solo escucha en `127.0.0.1`.

4. **Comprueba** que responde con usuario y contraseña:

   ```powershell
   curl.exe -u trackhive:trackhive-dev "http://127.0.0.1:8081/?search=folder:%20Ene&json=1&count=1"
   # Un JSON con "totalResults" mayor que 0 y, en "results", una carpeta de enero
   ```

   Y que sin ellos responde 401:

   ```powershell
   curl.exe -i "http://127.0.0.1:8081/?json=1"
   # HTTP/1.1 401 Unauthorized
   ```

Para detenerla:

```powershell
C:\trackhive\everything-portable\Everything.exe -instance trackhive -exit
```

> La instancia portable **no arranca sola con Windows**. Después de reiniciar el PC, vuelve a ejecutar el comando del punto 3 antes de sincronizar.

Credenciales para el `agente.toml` (paso 6): `url = 'http://127.0.0.1:8081'`, `user = 'trackhive'`, `password = 'trackhive-dev'`.

## Paso 5B. Everything instalado

El Everything normal del PC, como el del CLENA. Indexa todo el disco `C:`, así que ya ve `C:\trackhive\docs_simulados` sin agregar nada.

1. **Instálalo** desde <https://www.voidtools.com/downloads/> (*Download Installer 64-bit*) o con:

   ```powershell
   winget install --id voidtools.Everything -e
   ```

   Las opciones por defecto del instalador sirven (incluido el *Everything Service*).

2. **Ábrelo** desde el menú Inicio y busca `docs_simulados`: debe aparecer la carpeta. Si no aparece (tu Everything no indexa `C:`), agrégala en **Tools → Options → Indexes → Folders → Add…** (Herramientas → Opciones → Índices → Carpetas → Agregar…) con `C:\trackhive\docs_simulados`.

3. **Enciende su servidor HTTP** en **Tools → Options → HTTP Server** (Herramientas → Opciones → Servidor HTTP):

   | Opción | Valor |
   |---|---|
   | Enable HTTP server (Habilitar servidor HTTP) | ✔ |
   | Bind to interfaces (escuchar en) | `127.0.0.1` |
   | Listen on port (puerto) | `8082`, para no chocar con el portable |
   | Username (usuario) | `trackhive`, por ejemplo |
   | Password (contraseña) | una que elijas, que no sea la de Windows |
   | Allow file download (Permitir la descarga de archivos) | **desmarcado** |

   Pulsa **OK**. La configuración queda guardada en `%APPDATA%\Everything\Everything.ini`.

4. **Comprueba** que responde (cambia `TU-CLAVE` por tu contraseña). La consulta pide las carpetas bajo `C:\trackhive\docs_simulados\`, como hace el agente:

   ```powershell
   curl.exe -u "trackhive:TU-CLAVE" "http://127.0.0.1:8082/?search=folder:%20%22C:%5Ctrackhive%5Cdocs_simulados%5C%22&json=1&count=1"
   # Un JSON con "totalResults" mayor que 0 y, en "results", una carpeta del árbol
   ```

   Y que sin usuario y contraseña responde 401:

   ```powershell
   curl.exe -i "http://127.0.0.1:8082/?json=1"
   # HTTP/1.1 401 Unauthorized
   ```

   Para comparar sus respuestas con las del Everything con el que se capturaron las de referencia (24 consultas):

   ```powershell
   python dev\scripts\comparar_everything.py --url http://127.0.0.1:8082 --usuario trackhive --contrasena "TU-CLAVE"
   # 23 de 24 respuestas iguales a las de Everything real; 1 diferencia(s) esperada(s)
   ```

   La diferencia esperada es la de la raíz del índice: un Everything que indexa el disco por NTFS la informa distinto que uno que indexa una carpeta. Al agente no le afecta. Con otra versión de Everything puede haber más diferencias; el script dice cuáles.

> **Si `curl.exe` dice que no se pudo conectar**, lo más probable es que solo esté corriendo el *Everything Service* y no la aplicación. El servidor HTTP lo da la aplicación, no el servicio. Ábrela (menú Inicio, o `Start-Process 'C:\Program Files\Everything\Everything.exe' -ArgumentList '-startup'`) y comprueba que su icono esté en la bandeja. Para que se abra sola con Windows: **Tools → Options → General → Start Everything on system startup**.

> **Mientras el servidor HTTP está encendido, cualquier programa de tu PC puede buscar en todo lo que indexa tu Everything** (con el usuario y la contraseña). Cuando termines de probar, desmárcalo (ver [Apagar todo y volver a empezar](#apagar-todo-y-volver-a-empezar)).

Credenciales para el `agente.toml` (paso 6): `url = 'http://127.0.0.1:8082'`, `user` y `password` los que pusiste.

## Paso 6. Preparar el agente

El agente es `trackhive-agente.exe`: lleva Python dentro, así que en el PC del CLENA no hace falta instalar nada. Se puede conseguir de dos formas.

### 6.1 Conseguir el `.exe`

**Opción A, construirlo** (en la carpeta del repositorio):

Instala las dependencias de construcción:

```powershell
python -m pip install -r agent\requirements-build.txt
```

Construye el `.exe`:

```powershell
python agent\construir_exe.py
```

Termina con `Paquete del agente en …\agent\dist: agente.example.toml, instalar-tarea.ps1, trackhive-agente.exe`. Crea la carpeta `C:\trackhive\agente`:

```powershell
New-Item -ItemType Directory -Force C:\trackhive\agente | Out-Null
```

Y copia el paquete en ella:

```powershell
Copy-Item agent\dist\* C:\trackhive\agente\
```

**Opción B, descargarlo del CI.** En GitHub (con tu cuenta iniciada), **Actions → CI**, la última ejecución correcta en `main`, artefacto **`trackhive-agente`**. Descomprímelo en `C:\trackhive\agente`.

En los dos casos, `C:\trackhive\agente` queda con `trackhive-agente.exe`, `agente.example.toml` e `instalar-tarea.ps1`.

> Windows Defender u otro antivirus puede bloquear el `.exe` porque no tiene firma digital. Si pasa, agrega una exclusión para `C:\trackhive\agente\`.

### 6.2 Configurar `agente.toml`

Entra en la carpeta del agente:

```powershell
cd C:\trackhive\agente
```

Crea el `agente.toml` a partir del ejemplo:

```powershell
Copy-Item agente.example.toml agente.toml
```

**Con el Everything portable (5A) y el token de la plantilla, ya está listo**, sin abrirlo: el ejemplo trae su servidor HTTP (`127.0.0.1:8081`, `trackhive` / `trackhive-dev`), las raíces del árbol simulado, el backend de Docker (`http://127.0.0.1:3000`) y el mismo token que el `.env.example`. Pasa al paso 7.

Si usas el **Everything instalado (5B)** o **generaste tu propio token** en el paso 2, ábrelo con el Bloc de notas:

```powershell
notepad agente.toml
```

Los textos van **entre comillas simples** (`'...'`), así la barra invertida de Windows se lee tal cual. Cambia solo lo que te toca:

- **Everything instalado (5B):** en `[everything]`, el puerto y la contraseña que elegiste en el paso 5B.

  ```toml
  [everything]
  url = 'http://127.0.0.1:8082'
  user = 'trackhive'
  password = 'TU-CLAVE'
  # roots: no se cambian (ver abajo)
  ```

- **Token propio (paso 2):** en `[trackhive]`, el mismo valor que pusiste en `EVERYTHING_AGENT_TOKEN` del `.env`.

  ```toml
  [trackhive]
  token = 'EL-MISMO-TOKEN-DEL-.env'
  ```

Qué trae el ejemplo:

| Clave | Valor | Por qué |
|---|---|---|
| `everything.url` | `http://127.0.0.1:8081` (portable). Con el instalado, `:8082` | El servidor HTTP de Everything. El agente solo acepta este mismo PC |
| `everything.user`, `everything.password` | `trackhive` / `trackhive-dev`, los del portable | Sin los del servidor HTTP de Everything, responde 401 |
| `everything.roots` | **Déjalas como vienen**: las tres raíces bajo `C:\trackhive\docs_simulados\Aha\…` | Son las mismas que espera el backend. Valen para los dos Everything porque el árbol está en la misma ruta. En el CLENA cambian a `Z:\Aha\…` o a la ruta de red |
| `trackhive.url` | `http://127.0.0.1:3000` | El backend de Docker. Usa `127.0.0.1`, no `localhost`: con `localhost` Windows prueba primero IPv6 y cada petición tarda unos 2 s más. `http://` solo se acepta contra este PC; en el CLENA es `https://` |
| `trackhive.token` | El mismo de `.env.example` | El backend rechaza (401) cualquier otro: si cambiaste el del `.env`, pon aquí el mismo |
| `trackhive.poll_seconds` | `60` | Cada cuánto pregunta si alguien pidió «Sincronizar ahora». Opcional: con `10` la demo del paso 8 espera menos |

El resto de claves tiene valores por defecto que sirven; el archivo explica cada una.

## Paso 7. Primera sincronización, a mano

Con Docker arriba (paso 3), el árbol generado (paso 4) y tu Everything respondiendo (5A o 5B):

```powershell
cd C:\trackhive\agente
```

```powershell
.\trackhive-agente.exe
```

Cuando termine, mira con qué código salió:

```powershell
$LASTEXITCODE
```

Escribe cada paso en la consola y en `C:\trackhive\agente\logs\agente.log`:

```text
… INFO Everything en http://127.0.0.1:8081, Trackhive en http://127.0.0.1:3000; 3 raíces, 200 resultados por página
… INFO Everything responde
… INFO Corrida 654d5b3a-… iniciada en Trackhive
… INFO Página 1 enviada: 124 carpetas (124 de 124 bajo C:\trackhive\docs_simulados\Aha\Fondo - Notarías\Notarías)
… INFO Página 2 enviada: …
… INFO Página 3 enviada: …
… INFO Corrida 654d5b3a-… completa con 3 páginas: 117 carpetas hoja: 84 materiales creados, 33 actualizados, 0 copias no encontradas y 11 para revisión
0
```

- `$LASTEXITCODE` = `0`: corrida completa. `1`: la sincronización falló (el motivo está en el log). `2`: el `agente.toml` está mal y no se conectó a nada.
- Con la base recién creada salen **84 creados y 33 actualizados**: 33 materiales de la semilla ya tenían el código de una carpeta y se reconocen por él. Desde la segunda vez: `0 materiales creados, 117 actualizados`.

**Comprueba en la web** (como `admin@example.com`):

- **Sincronización:** la última sincronización terminó correctamente, cuántas carpetas recibió y cuándo se comunicó el agente por última vez.
- **Archivo:** busca `1931`. Aparecen los materiales de la Notaría Primera de Barranquilla con **Copia digital: Sí** y el nombre de su carpeta. Los materiales de las 11 carpetas raras llevan la marca **Para revisión**.

## Paso 8. «Sincronizar ahora» desde la web

El servidor no puede llamar al PC del CLENA, así que «Sincronizar ahora» deja la sincronización **pedida** y el agente, que pregunta cada `poll_seconds`, la toma. Para eso el agente tiene que estar **vigilando** (`--vigilar`).

1. En una ventana de PowerShell que dejarás abierta:

   ```powershell
   cd C:\trackhive\agente
   ```

   ```powershell
   .\trackhive-agente.exe --vigilar
   ```

   Dice `Atendiendo «Sincronizar ahora»: se pregunta a Trackhive cada 60 s si hay una sincronización pedida` (o `cada 10 s`, si pusiste `poll_seconds = 10` en el paso 6.2) y se queda esperando.

2. En <http://localhost:8080>, como administrador, abre **Sincronización**, pulsa **«Sincronizar ahora»** y confirma con **«Sí, sincronizar ahora»**. La pantalla muestra **«Pedida, esperando al agente»**.

3. En menos de `poll_seconds`, la consola del agente muestra `Un administrador pidió «Sincronizar ahora» en Trackhive (pedida el … UTC): se sincroniza` y la corrida completa. La pantalla se actualiza sola, sin recargar, con el resultado nuevo.

4. Detén el agente con **Ctrl+C**.

Prueba también qué pasa con el «PC del CLENA apagado»: con el agente detenido, pide «Sincronizar ahora». La sincronización queda pedida, la pantalla dice desde cuándo, y no se puede pedir otra. Cuando vuelves a arrancar `--vigilar`, la toma.

Lo que escribe la vigilancia queda en `C:\trackhive\agente\logs\vigilancia.log`, aparte del log de la sincronización diaria.

## Paso 9. Las tareas programadas, como en el CLENA

En el CLENA nadie deja una consola abierta: el script [`instalar-tarea.ps1`](../agent/instalar-tarea.ps1) crea dos tareas en el Programador de tareas de Windows.

| Tarea | Cuándo corre | Qué hace |
|---|---|---|
| **Sincronizar con Everything** | Una vez al día (por defecto a las 12:00). Si el PC estaba apagado a esa hora, al encenderlo e iniciar sesión | Una sincronización completa y termina |
| **Atender Sincronizar ahora** | Al iniciar sesión, y sigue mientras la sesión está iniciada | `trackhive-agente.exe --vigilar` |

Antes, **detén el `--vigilar` de la consola** (Ctrl+C) para no tener dos agentes vigilando a la vez.

1. Instálalas (no hace falta ser administrador):

   ```powershell
   cd C:\trackhive\agente
   ```

   ```powershell
   powershell -ExecutionPolicy Bypass -File .\instalar-tarea.ps1
   ```

   O, si quieres otra hora para la diaria:

   ```powershell
   powershell -ExecutionPolicy Bypass -File .\instalar-tarea.ps1 -Hora 13:30
   ```

   Corren con tu usuario, solo mientras tienes la sesión iniciada, y no abren ninguna ventana. La de «Sincronizar ahora» queda iniciada de inmediato.

2. **Comprueba** que la vigilancia está corriendo:

   ```powershell
   (Get-ScheduledTask -TaskPath '\Trackhive\' -TaskName 'Atender Sincronizar ahora').State
   # Running
   ```

   Lanza la diaria a mano:

   ```powershell
   Start-ScheduledTask -TaskPath '\Trackhive\' -TaskName 'Sincronizar con Everything'
   ```

   Espera unos segundos y mira cómo terminó:

   ```powershell
   (Get-ScheduledTaskInfo -TaskPath '\Trackhive\' -TaskName 'Sincronizar con Everything').LastTaskResult
   # 0 = corrida completa (267009 = todavía está corriendo: espera y vuelve a preguntar)
   ```

   También se ven en `taskschd.msc`, **Biblioteca del Programador de tareas → Trackhive**.

3. Pide **«Sincronizar ahora»** desde la web, como en el paso 8. Esta vez la atiende la tarea. Para seguirla en vivo:

   ```powershell
   Get-Content C:\trackhive\agente\logs\vigilancia.log -Tail 20 -Wait
   ```

Cosas que conviene saber:

- **Si cambias `agente.toml`, vuelve a ejecutar `instalar-tarea.ps1`**: la vigilancia ya está corriendo y no relee la configuración sola. El script la detiene y la vuelve a iniciar.
- Las tareas solo sirven si Everything está abierto: el instalado arranca con Windows si tiene marcado «Start Everything on system startup» (paso 5B), pero el portable hay que arrancarlo después de cada reinicio (paso 5A, punto 3).
- Para quitarlas: `powershell -ExecutionPolicy Bypass -File .\instalar-tarea.ps1 -Quitar`.

## Paso 10. Cambiar de Everything

Las raíces y el token no cambian; solo la sección `[everything]` del `agente.toml`.

**Para una prueba rápida sin tocar las tareas**, guarda la configuración del otro Everything en otro archivo y pásala con `--config`:

```powershell
cd C:\trackhive\agente
```

```powershell
Copy-Item agente.toml agente-instalado.toml
```

En el archivo nuevo, cambia `[everything]` por los datos del instalado (url `:8082`, `user` y `password`):

```powershell
notepad agente-instalado.toml
```

Y sincroniza con él:

```powershell
.\trackhive-agente.exe --config .\agente-instalado.toml
```

**Para que las tareas usen el otro Everything**, cambia `[everything]` en `agente.toml` (las tareas siempre leen ese) y vuelve a ejecutar `instalar-tarea.ps1`.

Con los dos Everything debe salir lo mismo: `117 carpetas hoja: 0 materiales creados, 117 actualizados, 0 copias no encontradas y 11 para revisión`. Los dos pueden estar abiertos a la vez, porque usan puertos distintos (8081 y 8082).

## Paso 11. Ver cómo reacciona a cambios en las carpetas

Sirve para ver que el catálogo sigue a las carpetas, como en el CLENA cuando se digitaliza o se mueve algo.

1. **Borra una carpeta de mes**, por ejemplo la de febrero de 1931 de la Notaría Primera (en el Explorador, o en PowerShell):

   ```powershell
   Remove-Item -Recurse -LiteralPath 'C:\trackhive\docs_simulados\Aha\Fondo - Notarías\Notarías\1ra - Notaria Primera de Barranquilla - 1815 a 1979\1931 - Esc 1-1290 (12) +\1ra-1931 - Esc 0110-0206 - Feb'
   ```

2. Pide **«Sincronizar ahora»**. El resultado ahora es:

   ```text
   116 carpetas hoja: 0 materiales creados, 116 actualizados, 1 copias no encontradas y 11 para revisión
   ```

   En **Archivo**, «Notaría Primera de Barranquilla · 1931 · Escrituras 110–206 (febrero)» pasa a **Copia digital: No**. El material **no se borra**: ningún material se borra, porque puede tener solicitudes (este tiene una en la semilla).

3. **Restáuralo** volviendo a ejecutar el script (en la carpeta del repositorio), espera unos segundos a que Everything vea los cambios y sincroniza otra vez:

   ```powershell
   python dev\simulador\generar_docs.py --salida C:\trackhive\docs_simulados --manifiesto C:\trackhive\manifiesto.json
   ```

   Vuelve a `117 … actualizados` y el material recupera su copia digital.

Una sincronización que termina **con error** (Everything apagado, una raíz sin carpetas…) nunca marca nada como «copia digital no encontrada»: eso solo lo hace una corrida completa. Puedes comprobarlo deteniendo Everything y pidiendo «Sincronizar ahora». El agente espera hasta 5 minutos por si Everything está arrancando (`everything.startup_wait_seconds`) y después cierra la corrida con error: la pantalla muestra el error y el motivo («Everything no responde…»), y el catálogo no cambia.

## Apagar todo y volver a empezar

| Qué | Cómo |
|---|---|
| Detener Trackhive, sin borrar datos | `docker compose down` (en la carpeta del repositorio) |
| Borrar también la base de datos (la semilla se vuelve a cargar al levantar) | `docker compose down -v` y luego `docker compose up -d --build` |
| Quitar las tareas programadas | `powershell -ExecutionPolicy Bypass -File C:\trackhive\agente\instalar-tarea.ps1 -Quitar` |
| Detener el Everything portable | `C:\trackhive\everything-portable\Everything.exe -instance trackhive -exit` |
| Everything instalado | **Tools → Options → HTTP Server:** desmarca «Enable HTTP server». Si agregaste la carpeta en **Indexes → Folders**, quítala |
| Borrar lo de Windows | Borra `C:\trackhive` (después de quitar las tareas y detener el portable) |

## Problemas frecuentes

| Síntoma | Causa y solución |
|---|---|
| El contenedor `frontend` se reinicia sin parar y `docker compose logs frontend` dice `40-trackhive-tls.sh: not found` | El script quedó con finales de línea de Windows (CRLF), en un clon anterior a la regla de `.gitattributes`. Actualiza el repositorio (`git pull`), borra el script con `Remove-Item frontend\nginx\40-trackhive-tls.sh`, vuelve a sacarlo con `git checkout -- frontend/nginx/40-trackhive-tls.sh` y reconstruye: `docker compose up -d --build frontend` |
| `docker compose` dice `Missing … in .env` | Falta el `.env`: `Copy-Item .env.example .env` (paso 2) |
| `docker compose` no conecta con Docker | Docker Desktop no está abierto o no terminó de arrancar (*Engine running*) |
| La pantalla Sincronización dice que la integración está desactivada | La línea `EVERYTHING_AGENT_TOKEN=` del `.env` está vacía (un `.env` copiado antes de que la plantilla trajera el token): copia el valor de `.env.example` y ejecuta `docker compose up -d` |
| El backend no arranca y su log habla del token | El token tiene menos de 32 caracteres, o es el de `.env.example` con `RUN_SEED=false`. En desarrollo deja `RUN_SEED=true` y el token de la plantilla (paso 2) |
| `python` no se reconoce o abre la Microsoft Store | Paso 0, punto 3: desactiva los alias o usa `py` |
| El agente termina con código 2: `El agente no se ejecuta: …` | El `agente.toml` está mal. El mensaje dice qué: token de menos de 32 caracteres, `http://` contra algo que no es `127.0.0.1`, un texto sin comillas simples… |
| `Everything no responde en …: rechazó la conexión` | Everything no está abierto, su servidor HTTP está apagado o el puerto de `everything.url` no es el suyo. Con el instalado, mira la nota del paso 5B sobre el servicio |
| `Everything rechazó el usuario o la contraseña (401)` | `everything.user` / `password` no coinciden con los del servidor HTTP de Everything |
| `Everything no devolvió ninguna carpeta bajo <raíz>` | El árbol no está en `C:\trackhive\docs_simulados` (paso 4), Everything no lo indexa (5B, punto 2) o cambiaste `everything.roots` |
| `Trackhive rechazó el token del agente (401 …)` | `trackhive.token` no es igual a `EVERYTHING_AGENT_TOKEN` del `.env`: pon el mismo en los dos (o vuelve a copiar las dos plantillas). Si cambiaste el `.env`, ejecuta `docker compose up -d` |
| `Trackhive no responde en https://trackhive.example.org/: no se encontró el servidor (DNS)` | El `agente.toml` salió de un ejemplo anterior, que traía esa dirección. Vuelve a copiar `agente.example.toml` (paso 6.2) o cambia `trackhive.url` por `http://127.0.0.1:3000` |
| `Trackhive no responde …` (otra dirección) | Docker no está arriba (`docker compose ps`) o `trackhive.url` no es `http://127.0.0.1:3000` |
| Cada paso del agente tarda unos 2 s | `trackhive.url` usa `localhost`; cámbialo por `127.0.0.1` |
| El puerto 8081 está ocupado al arrancar el portable | Está corriendo el mock de Docker: `docker compose stop everything-mock` |
| La pantalla se queda en «Pedida, esperando al agente» | Ningún agente está vigilando: arranca `--vigilar` (paso 8) o revisa que la tarea esté `Running` (paso 9) |
| `instalar-tarea.ps1` dice `Falta agente.toml` o `No se encontró …\trackhive-agente.exe` | Ejecútalo desde `C:\trackhive\agente`, después de los pasos 6.1 y 6.2 |
| PowerShell no deja ejecutar el `.ps1` | Ejecútalo con `powershell -ExecutionPolicy Bypass -File …`, como en el paso 9 |
| El antivirus borra o bloquea `trackhive-agente.exe` | Exclusión para `C:\trackhive\agente\` (paso 6.1) |

## Para seguir leyendo

- [everything-desarrollo.md](everything-desarrollo.md): el árbol simulado, el parseo, los dos Everything, el mock y los endpoints de la sincronización.
- [agente.md](agente.md): qué hace el agente en cada ejecución, sus pruebas y cómo se construye.
- [manual-operacion.md, sección 10](manual-operacion.md#10-agente-de-sincronización-con-everything-hu-166): instalar el agente en el PC real del CLENA (unidad `Z:`, HTTPS, permisos de la carpeta, rotar el token).
- [manual-usuario.md, sección 8](manual-usuario.md#8-sincronización-con-everything-solo-administrador): la pantalla Sincronización para el administrador.
