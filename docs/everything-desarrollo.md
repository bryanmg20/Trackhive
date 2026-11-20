# Entorno de Everything para desarrollo

Guía de HU-133 (#133, épica E11). Sirve para desarrollar y probar la integración con *Everything* sin el equipo ni la red del CLENA: un árbol de **documentos simulados** con la misma forma que el del CLENA, un **Everything real** (portable) que lo indexa en Windows, las **respuestas reales** guardadas como fixtures y un **mock** en Python para quien no tiene Windows.

| Pieza | Dónde | Para qué |
|---|---|---|
| Convención y generador | `dev/simulador/` | Genera `dev/docs_simulados/` y `dev/manifiesto.json` |
| Manifiesto | `dev/manifiesto.json` | Lo que el parseo (HU-136) debe sacar de cada carpeta hoja |
| Everything portable | `dev/everything-portable/` | Plantilla del `.ini` para indexar solo `docs_simulados` |
| Fixtures | `dev/fixtures/everything_*.json` | Respuestas reales del servidor HTTP, para las pruebas del adaptador (HU-135) |
| Mock | `dev/everything-mock/` | Responde igual que Everything, sin Windows |
| Scripts | `dev/scripts/` | Capturar los fixtures y comparar cualquier servidor con ellos |
| Pruebas | `dev/tests/` | Generador, manifiesto y mock frente a los fixtures; corren en el CI en Linux y Windows |

Todo usa Python 3.10 o superior y una sola dependencia, PyYAML:

```bash
pip install -r dev/requirements.txt
```

## 1. Estructura real del CLENA

Según las respuestas del CLENA del 2026-11-20, las copias digitales están en una unidad de red (`Z:` = `\\<servidor>\Multimedia`):

```text
Z:\Aha\Fondo - Notarías\Notarías\<notaría>\<año>\<mes>\   ← imágenes escaneadas
```

| Nivel | Forma | Ejemplos reales |
|---|---|---|
| Notaría | `<n>ra - Notaria <Ordinal> de <Ciudad> - <desde> a <hasta>` y a veces `(<n>)` | `1ra - Notaria Primera de Barranquilla - 1815 a 1979`, `3ra - … - 1929 a 1950 (499)` |
| Año | `<año> - Esc 1-<fin> (<nn>)` y una marca opcional | `1931 - Esc 1-1290 (12) +`, `1932 - Esc 1-0820 (07) +`, `1940 - … (23) + ptes` |
| Mes | `<n>ra-<año> - Esc <inicio>-<fin> - <Mes>` | `1ra-1931 - Esc 0001-0109 - Ene` |
| Imagen | `<página> - <n>ra - <año> - Esc <escritura>.jpg` | `002 - 1ra - 1938 - Esc …` |

- Solo se colocan las carpetas de lo ya digitalizado, así que **cada carpeta hoja es un material con copia digital**.
- El número entre paréntesis del año coincide con el número de carpetas de mes: 1931 tiene `(12)` y 12 meses.
- Hay años con más de 12 (`(19)`, `(56)`), y la carpeta de trabajo `3ra-1950 - Esc 0051-0160 - Ene` empieza en la escritura 51. Por eso se supone que **un mes puede estar partido en varias carpetas**. **Supuesto por confirmar con el CLENA.**
- Los prefijos `#LB - …` vistos antes son de la biblioteca y no aplican.

## 2. Árbol de documentos simulados

```bash
python dev/simulador/generar_docs.py
# Árbol: dev/docs_simulados (142 carpetas, 377 archivos)
# Manifiesto: dev/manifiesto.json (117 hojas: 106 válidas, 11 para revisión; 4 carpetas de trabajo excluidas)
```

- [`convencion.yaml`](../dev/simulador/convencion.yaml) describe los fondos y sus niveles (raíz del fondo → notaría → año → mes) y la forma de cada nombre. Los nombres se pueden cambiar (otra ciudad, otros años o rangos) siempre que conserven la forma. Después se vuelve a ejecutar el generador y se sube el `manifiesto.json` nuevo.
- Usa `pathlib` y una semilla fija: en Linux y en Windows genera **exactamente** las mismas carpetas y archivos. La huella SHA-256 del árbol queda en el manifiesto y el CI la comprueba en `ubuntu-latest` y `windows-latest`.
- `dev/docs_simulados/` no se sube al repositorio (`.gitignore`): se genera. El generador solo borra una carpeta de salida que él mismo creó (tiene `LEEME.txt`), nunca otra.
- Las imágenes son archivos `.jpg` **vacíos** (0 bytes). No entra ninguna imagen real ni dato personal del CLENA, y las fotos del explorador que mandó el CLENA tampoco se suben.

Casos raros que genera a propósito:

| Caso | En el árbol simulado |
|---|---|
| Marcas en el año | `+`, `+ ptes`, `+ Ptes`, sin marca; conteo `(07)`, `(12)`, `(15)` |
| Ceros a la izquierda variables | `Esc 1-1290` (año) frente a `Esc 0001-0109` (mes) |
| Meses partidos (supuesto) | Enero, junio y octubre de 1945 y enero de 1950 en dos carpetas |
| Carpetas sin el patrón | `1080`, `1823 - 1827` y `1ra - Matrimonios` dentro de la notaría primera |
| Mismo código en dos carpetas | `1ra-1940 - Esc 0001-0161 - Ene` y `1ra-1940 - Esc 1-161 - Ene` |
| Fondo sin patrón conocido | `Aha\Fondo - Periódicos\…` (periódicos inventados) |
| Cualquier otro fondo | `Aha\Fondo - Correspondencia\…` (tipo `DOCUMENTO`) |
| Carpetas de trabajo fuera de la raíz | `Aha\Fondo - Notarías\Esc en PDF`, `Escritura 1577`, `Empaste 2026` y una copia de `3ra-1950 - Esc 0051-0160 - Ene` |

### Manifiesto y reglas del parseo (contrato con HU-136)

`dev/manifiesto.json` lista cada carpeta hoja bajo una raíz de fondo con lo que el parseo debe sacar de ella. Las pruebas del parseo (HU-136) lo recorren. Campos de cada hoja:

| Campo | Ejemplo |
|---|---|
| `path` | ruta desde `docs_simulados`, con `\` |
| `relativePath` | ruta desde la raíz del fondo: `1ra - Notaria …\1931 - Esc 1-1290 (12) +\1ra-1931 - Esc 0001-0109 - Ene` |
| `catalogCode` | `NOT1-1931-0001-0109` |
| `parsedCode` | el código que sale del patrón, o `null` si no lo sigue |
| `title` | `Notaría Primera de Barranquilla · 1931 · Escrituras 1–109 (enero)` |
| `collection`, `materialType` | `Notarías`, `PROTOCOLO_NOTARIAL` |
| `needsReview`, `reviewReason` | `false`, `null` · o `true`, `NO_PATTERN` / `DUPLICATE_CODE` |

Las reglas de referencia están en [`reglas.py`](../dev/simulador/reglas.py):

1. **Patrón por niveles:** una hoja de notarías es válida si sus tres niveles (notaría, año, mes) siguen su patrón. Se ignoran las marcas `+`, `ptes` y `(n)`.
2. **Código:** prefijo del fondo + número de la notaría, año y rango con 4 dígitos: `NOT1-1931-0001-0109` (máximo 40 caracteres). Los ceros se normalizan, así que `Esc 1-161` y `Esc 0001-0161` dan el mismo código.
3. **Título:** `Notaría <Ordinal> de <Ciudad> · <año> · Escrituras <inicio>–<fin> (<mes>)`, sin ceros a la izquierda y con la tilde de «Notaría».
4. **Tipo por fondo:** Notarías → `PROTOCOLO_NOTARIAL`, Periódicos → `PERIODICO`, cualquier otro → `DOCUMENTO`.
5. **Respaldo:** si la hoja no sigue el patrón, el título es el nombre de la carpeta, precedido de la notaría si el primer nivel la tiene (`Notaría Primera de Barranquilla · 1080`). El código es el prefijo del fondo más los 8 primeros dígitos hexadecimales, en mayúscula, del SHA-256 de la ruta relativa al fondo (UTF-8, NFC, separada con `\`): `NOT-71F384CA`. Queda **para revisión** (`NO_PATTERN`).
6. **Código duplicado:** si dos hojas dan el mismo código, las dos quedan para revisión (`DUPLICATE_CODE`) con el código de respaldo de su ruta.
7. **Raíz:** solo cuentan las hojas bajo una raíz de fondo, comparando por partes de la ruta. `Aha\Fondo - Notarías\Esc en PDF` no está bajo `Aha\Fondo - Notarías\Notarías`. Las carpetas de trabajo aparecen en `excluded`.

Algunos códigos coinciden con materiales de la semilla (`NOT1-1931-0001-0109`, `NOT1-1931-0110-0206`, `NOT3-1950-0051-0160`), con su `digital_path` en `C:\trackhive\docs_simulados\…`. `NOT4-1956-0001-0180` no está en el árbol: representa un material cuya carpeta ya no aparece.

## 3. Everything portable en Windows (desarrollo)

Para desarrollar se usa **Everything portable** como una instancia aparte (`-instance trackhive`) con su propio `.ini`. El Everything que cada uno tenga instalado no se toca: sigue indexando sus discos y su servidor HTTP sigue apagado.

1. Genera el árbol en una ruta neutral, igual para todo el equipo. Es la ruta que aparece en los fixtures y la que informa el mock:

   ```powershell
   python dev\simulador\generar_docs.py --salida C:\trackhive\docs_simulados --manifiesto C:\trackhive\manifiesto.json
   ```

2. Descarga el `.zip` portable de 64 bits desde [voidtools.com/downloads](https://www.voidtools.com/downloads/) (los fixtures se capturaron con la 1.4.1.1032) y descomprímelo en `C:\trackhive\everything-portable`.
3. Copia [`dev/everything-portable/Everything-trackhive.ini`](../dev/everything-portable/Everything-trackhive.ini) a esa carpeta y arranca la instancia:

   ```powershell
   cd C:\trackhive\everything-portable
   .\everything.exe -instance trackhive -config C:\trackhive\everything-portable\Everything-trackhive.ini -db C:\trackhive\everything-portable\Everything-trackhive.db -startup
   # Para detenerla
   .\everything.exe -instance trackhive -exit
   ```

   Si prefieres configurarlo a mano, abre la ventana de la instancia y entra en **Tools → Options** (en español, Herramientas → Opciones):
   - **Indexes → NTFS:** desmarca «Include in database» en **todos** los discos y «Automatically include new fixed volumes». Lo mismo en **Indexes → ReFS** si aparece.
   - **Indexes → Folders:** **Add…** `C:\trackhive\docs_simulados`.
   - **HTTP Server:** marca «Enable HTTP server», escucha solo en `127.0.0.1` (el campo de interfaces; en el `.ini`, `http_server_bindings`), puerto `8081`, usuario `trackhive` y una contraseña, y **desmarca «Allow file download»**. Así nadie descarga las imágenes desde el navegador.

4. Comprueba que responde con usuario y contraseña. Sin ellos debe devolver 401:

   ```powershell
   curl.exe -u trackhive:trackhive-dev "http://127.0.0.1:8081/?search=folder:%20Ene&json=1&count=1"
   curl.exe -i "http://127.0.0.1:8081/?json=1"
   ```

## 4. Probar con el Everything instalado (como en el CLENA)

En el CLENA, Everything está **instalado**, no en portable. Para comprobar que la integración funciona igual con una instalación normal:

1. Genera el árbol en `C:\trackhive\docs_simulados` (paso 1 de la sección anterior). Tiene que ser esa ruta, porque los fixtures la incluyen.
2. Si tu Everything ya indexa el disco `C:` (lo normal), ya ve la carpeta y no hay que agregar nada. Si no, agrégala en **Tools → Options → Indexes → Folders → Add…**. No hace falta quitar los discos: todas las consultas se restringen a esa carpeta.
3. **HTTP Server** (en español, Herramientas → Opciones → Servidor HTTP): actívalo solo mientras pruebas, escuchando en `127.0.0.1` y en otro puerto que el portable (por ejemplo `8082`), con usuario y contraseña y **sin «Allow file download»** («Permitir la descarga de archivos»). Mientras está encendido, cualquier programa de tu equipo puede buscar en todo lo que indexa tu Everything.
4. Compara sus respuestas con las del Everything portable:

   ```powershell
   $env:EVERYTHING_USER = "tu-usuario"; $env:EVERYTHING_PASSWORD = "tu-contraseña"
   python dev\scripts\comparar_everything.py --url http://127.0.0.1:8082
   # 23 de 24 respuestas iguales a las de Everything real; 1 diferencia(s) esperada(s)
   ```

   Con Everything 1.4.1.1032 instalado e indexando `C:` por NTFS, salieron iguales byte a byte las 23 consultas que no dependen del índice (2026-11-20). La única diferencia esperada es `raiz_del_indice`:
   - **Por NTFS**, `docs_simulados` es una carpeta normal: `name` = `docs_simulados`, `path` = `C:\trackhive`.
   - **Por Indexes → Folders** (el portable, y en el CLENA la unidad de red), llega con `name` igual a la ruta completa y `path` vacío.

   El adaptador debe aceptar las dos formas. Con `--estricto`, también esa cuenta como fallo.

   Si no hay diferencias inesperadas, el adaptador del backend funcionará igual con ese Everything. Si alguna difiere, el script dice cuál y por qué. Una versión distinta de Everything puede cambiar el formato: en ese caso se anota y se recapturan los fixtures (sección 5).
5. Al terminar, apaga el servidor HTTP y quita la carpeta del índice.

Diferencias que hay que tener en cuenta en el despliegue en el CLENA:

- Las copias están en una **unidad de red**. Las letras de unidad (`Z:`) son de cada sesión de Windows. Si Everything corre como servicio, conviene indexar la ruta UNC (`\\<servidor>\Multimedia\Aha\…`) en **Indexes → Folders**, y las rutas que devuelva serán UNC. Las raíces de los fondos del parseo (HU-136) son configurables por eso.
- En una carpeta de red, Everything no siempre ve los cambios al instante. Conviene programar una reindexación (*rescan*) periódica en **Indexes → Folders**.
- Si el backend no corre en el mismo equipo, el servidor HTTP tiene que escuchar en la IP de la red local (no solo en `127.0.0.1`), con una regla de firewall que deje entrar solo al servidor de Trackhive. Depende de la plataforma de despliegue (D-24).
- Siempre con usuario y contraseña y sin «Allow file download»: el servidor expone los nombres y las rutas de los archivos.

## 5. Fixtures del servidor HTTP

[`dev/fixtures/`](../dev/fixtures/README.md) guarda 24 respuestas **reales** de Everything 1.4.1.1032. Cada una tiene al lado el comando `curl` con el que se capturó. Incluyen:

- la búsqueda de solo carpetas bajo una raíz (`folder:` + ruta) en tres páginas;
- los parámetros cortos (`s`, `q`, `o`, `c`);
- Y, O, NO, comillas, comodines, `file:`, sin tildes ni mayúsculas;
- el orden por nombre (carpetas primero), descendente y por ruta;
- la raíz del índice;
- los 401.

Formato que devuelve Everything (y que el adaptador de HU-135 debe leer):

```text
{"totalResults":124,"results":[{"type":"folder","name":"1ra-1931 - Esc 0001-0109 - Ene",
  "path":"C:\\trackhive\\…\\1931 - Esc 1-1290 (12) +","size":"","date_modified":"134396687063922382"}, …]}
```

- `path` es la carpeta **contenedora**, con `\`. La ruta completa es `path + "\" + name`. **Excepción:** la carpeta indexada llega con `name` igual a su ruta completa y `path` vacío (`everything_raiz_del_indice.json`).
- `size` y `date_modified` son texto. `size` va vacío en las carpetas, y `date_modified` es un FILETIME de Windows (intervalos de 100 ns desde 1601-01-01).
- Sin `count`, Everything devuelve **todos** los resultados. Las columnas solo aparecen si se piden (`path_column`, `size_column`, `date_modified_column`). El JSON va con CRLF y tabulaciones.
- La raíz se busca con la barra final (`folder: "…\Notarías\"`): sin ella también llega la propia carpeta raíz.

Para volver a capturarlos, con el Everything portable arrancado y Python y `curl` en Windows:

```powershell
$env:EVERYTHING_USER = "trackhive"; $env:EVERYTHING_PASSWORD = "trackhive-dev"
python dev\scripts\capturar_fixtures.py --url http://127.0.0.1:8081 --version-everything "1.4.1.1032 x64 (portable)"
```

El script lee las consultas de [`consultas.json`](../dev/fixtures/consultas.json) y reescribe los fixtures, `capturas.json` y el `README.md` de la carpeta. **El mock se ajusta al real, nunca al revés.**

## 6. Mock de Everything (sin Windows)

```bash
python dev/simulador/generar_docs.py                 # si aún no existe dev/docs_simulados
python dev/everything-mock/everything_mock.py         # http://127.0.0.1:8081, usuario trackhive
# o con Docker, sin instalar Python:
docker compose --profile everything up -d everything-mock
```

- Indexa la misma carpeta `docs_simulados` y la informa con las rutas de Windows de `convencion.yaml` (`C:\trackhive\docs_simulados\…`), como el Everything portable.
- **Parámetros:** `search`/`s`/`q`, `offset`/`o`, `count`/`c`, `json`/`j`, `sort` (`name`, `path`, `size`, `extension`, `date_modified`), `ascending`, `path_column`, `size_column`, `date_modified_column`, y `case`, `diacritics` y `path`.
- **Búsqueda:** Y entre palabras, `|` (O), `!` (NO), comillas, `folder:`/`file:`, comodines, la restricción por ruta y sin distinguir mayúsculas ni tildes.
- **Respuesta:** los mismos bytes que el real (CRLF, tabulaciones, todos los valores como texto, la fecha en FILETIME) y las mismas cabeceras. La autenticación es básica, con `EVERYTHING_USER` y `EVERYTHING_PASSWORD` (por defecto `trackhive` / `trackhive-dev`).
- **No imita:** expresiones regulares, `wholeword` ni la página HTML de Everything (sin `json=1` responde un HTML mínimo). Trackhive no los usa.

La prueba `dev/tests/test_mock.py` levanta el mock y repite las 24 consultas de los fixtures. Falla si el código, las cabeceras o los bytes difieren, salvo `date_modified`. El mismo comparador sirve a mano:

```bash
python dev/scripts/comparar_everything.py --url http://127.0.0.1:8081 --bytes
```

## 7. Conectar el backend

El backend llega al mock o a Everything **cambiando solo `EVERYTHING_URL`** en el `.env`. El usuario y la contraseña son los del servidor HTTP. El adaptador que las usa llega con HU-135.

| Backend | Everything | `EVERYTHING_URL` |
|---|---|---|
| Docker | mock en Docker (`--profile everything`) | `http://everything-mock:8081` |
| Docker | mock o Everything en la máquina anfitriona | `http://host.docker.internal:8081` |
| `pnpm start:dev` | mock o Everything en la misma máquina | `http://localhost:8081` |

- `docker-compose.yml` agrega `host.docker.internal:host-gateway` al backend, porque en Linux ese nombre no existe por defecto. El mock en la anfitriona tiene que escuchar en todas las interfaces: `--host 0.0.0.0`.
- **Docker Desktop en Windows:** `host.docker.internal` llega a Windows, y con él al Everything que escucha en `127.0.0.1`.
- **Docker Engine dentro de WSL 2 en modo NAT:** `host.docker.internal` y `localhost` son WSL, **no** Windows, así que el Everything de Windows no se alcanza con esos nombres. Hay dos opciones:
  - usar el mock en Docker;
  - agregar a «bind to interfaces» la IP de Windows en la red de WSL (`ip route show default` dentro de WSL, por ejemplo `172.21.16.1`) con una regla de firewall para esa red, y usar `EVERYTHING_URL=http://<esa IP>:8081`. La IP cambia al reiniciar.
- El navegador nunca llama a Everything: solo el backend.

## 8. Pruebas

```bash
pip install -r dev/requirements.txt
python -m unittest discover -s dev/tests -t dev/tests -v
```

El job `dev-everything` del CI las corre en Ubuntu y en Windows. Comprueban:

- que los dos sistemas generan el mismo árbol y el manifiesto subido;
- los casos raros, las imágenes vacías y que no haya contenido real;
- el ejemplo de HU-136 y los códigos de la semilla;
- el mock frente a los fixtures del Everything real.
