# Entorno de Everything para desarrollo

Guía de HU-133 (#133, épica E11). Sirve para desarrollar y probar la integración con *Everything* sin el equipo ni la red del CLENA: un árbol de **documentos simulados** con la misma forma que el del CLENA, un **Everything real** (portable) que lo indexa en Windows, las **respuestas reales** guardadas como fixtures y un **mock** en Python para quien no tiene Windows. La sección 7 explica cómo se sincroniza el backend (HU-137) y «Sincronizar ahora» (HU-138).

| Pieza | Dónde | Para qué |
|---|---|---|
| Convención y generador | `dev/simulador/` | Genera `dev/docs_simulados/` y `dev/manifiesto.json` |
| Manifiesto | `dev/manifiesto.json` | Lo que el parseo (HU-136) debe sacar de cada carpeta hoja |
| Everything portable | `dev/everything-portable/` | Plantilla del `.ini` para indexar solo `docs_simulados` |
| Fixtures | `dev/fixtures/everything_*.json` | Respuestas reales del servidor HTTP, para las pruebas del adaptador (HU-135) |
| Mock | `dev/everything-mock/` | Responde igual que Everything, sin Windows |
| Scripts | `dev/scripts/` | Capturar los fixtures y comparar cualquier servidor con ellos |
| Pruebas | `dev/tests/` | Generador, manifiesto y mock frente a los fixtures; corren en el CI en Linux y Windows |
| Agente | `agent/` | Programa del PC del CLENA que consulta Everything y envía las páginas al backend (HU-166, sección 7) |

No contiene imágenes reales ni datos personales del CLENA: las imágenes son archivos vacíos y los nombres solo copian la forma de las carpetas.

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

### Parseo en el backend (HU-136)

`LeafFolderParser` (`backend/src/everything/application/services/`) aplica esas reglas en TypeScript. Recibe los `DocumentRecord` de HU-135 (nunca el JSON de Everything) y devuelve una `ParsedLeaf` por carpeta hoja: ruta, código, título, colección, tipo y si queda para revisión. Necesita todas las carpetas de las raíces a la vez, porque una carpeta es hoja cuando ninguna otra cuelga de ella y un código se repite cuando lo dan dos hojas.

Nada de la convención está en el código: sale de [`backend/config/catalog-convention.json`](../backend/config/catalog-convention.json), que `CatalogConventionMapper` valida al cargarlo (un error lanza `InvalidCatalogConventionError` y no se sincroniza nada):

| Clave | Qué configura |
|---|---|
| `base` | Dónde están los fondos en este despliegue (`C:\trackhive\docs_simulados`, `Z:\`, `\\servidor\Multimedia`). Se puede reemplazar al cargarlo sin tocar el resto. |
| `funds[]` | Raíz (relativa a `base`), colección, prefijo del código y, si se conoce, el patrón. Un fondo sin `pattern` usa siempre el respaldo. |
| `materialTypes`, `defaultMaterialType` | Tabla colección → tipo de material; cualquier otra colección es `DOCUMENTO`. |
| `excluded` | Expresiones regulares de nombres de carpeta que no son materiales, sin distinguir mayúsculas. Se quitan con todo lo que tienen dentro antes de calcular las hojas. |
| `patterns.<nombre>` | Un nivel por carpeta bajo la raíz (`levels`). Cada nivel tiene su patrón con grupos con nombre (se compila como `^(?:…)$`), sus `ignoredMarks` (marcas que se borran antes de comparar: `(n)` en la notaría y `(n)`, `+` y `ptes` en el año, nunca en la hoja) y, si sirve en el respaldo, su `title`. Además: `ranges` (inicio ≤ fin), `values` (Ene → enero) y las plantillas `code` y `title` con `{grupo}` o `{grupo:N}` (N dígitos con ceros). Los números pierden los ceros a la izquierda antes de aplicar N. |

Al cargarlo se rechazan las claves desconocidas (una errata no se ignora), dos fondos con la misma raíz o una dentro de otra, una colección de `materialTypes` que no es de ningún fondo, un prefijo de más de 23 caracteres y una plantilla `code` que no usa ningún grupo de los niveles. Un código parseado solo vale si tiene letras mayúsculas, dígitos y guiones y no pasa de 40.

El código es la clave con la que la sincronización (HU-137) reconoce el material, así que el parseo garantiza que no se repite: si dos hojas acaban con el mismo código (dos hashes cortos iguales, o un código parseado igual a un hash), las dos toman 16 dígitos del hash en vez de 8 y quedan para revisión (`DUPLICATE_CODE`).

Para agregar la regla de otro fondo (por ejemplo, periódicos) se añade un patrón en `patterns` y se pone su nombre en el fondo. Sus pruebas (`leaf-folder-parser.spec.ts`) recorren las 117 hojas del manifiesto con las páginas reales de los fixtures y comparan cada campo.

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
- El servidor HTTP escucha solo en `127.0.0.1`: lo consulta el agente (HU-166) en el mismo equipo y el backend nunca llega a él (sección 7). No hace falta abrir puertos ni reglas de firewall de entrada.
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

## 7. Sincronización con el backend (HU-137)

El backend **no tiene cliente HTTP hacia Everything** y ya no usa `EVERYTHING_URL`, `EVERYTHING_USER` ni `EVERYTHING_PASSWORD`: esos datos están en la configuración del agente (`agente.toml`, claves `everything.url`, `user` y `password`; HU-166). Everything solo responde peticiones y el PC del CLENA no se alcanza desde los servidores de la universidad, así que el agente, instalado en ese PC, consulta Everything en `localhost` y envía al backend cada página **sin transformarla** (por HTTPS en producción, HU-42). El navegador nunca llama a Everything. El código del agente está en [`agent/`](../agent/) ([agente.md](agente.md)), y su instalación en el CLENA en el [manual de operación](manual-operacion.md), sección 10.

### Endpoints de ingesta

Todos llevan `Authorization: Bearer <EVERYTHING_AGENT_TOKEN>`. Los protege un guard propio (`EverythingAgentGuard`), separado del inicio de sesión de los usuarios, que compara el token en tiempo constante. Sin el token o con otro responden **401** y no guardan nada.

| Paso | Endpoint | Cuerpo | Respuesta |
|---|---|---|---|
| 1. Iniciar corrida | `POST /api/v1/everything/sync-runs` | — | 201, con el `id` de la corrida |
| 2. Enviar página | `PUT /api/v1/everything/sync-runs/{id}/pages/{n}` | la respuesta de Everything, tal cual | 200 |
| 3. Cerrar corrida | `POST /api/v1/everything/sync-runs/{id}/close` | `{"result":"OK","pageCount":N}` o `{"result":"ERROR","errorMessage":"…"}` | 200, con el resultado |

- El agente busca solo carpetas bajo cada raíz de `backend/config/catalog-convention.json` (`folder:` + la raíz con la barra final, sección 5), con `json=1&path_column=1&size_column=1&date_modified_column=1`, por páginas con `offset` y `count`. Numera las páginas de la corrida desde 1, seguidas aunque cambie de raíz. Reenviar un número reemplaza esa página, así que puede reintentarla.
- Una página puede traer hasta **500 resultados** y pesar hasta **100 kB**, el límite de JSON de toda la API. Si no, responde **413** (`EVERYTHING_PAGE_TOO_LARGE` o `PAYLOAD_TOO_LARGE`) y no guarda nada. Con `count=200` cabe con holgura: cada carpeta ocupa unos 300 bytes.
- La página se valida con el mapeo de HU-135. Si no tiene la forma de Everything responde 400 `INVALID_EVERYTHING_PAGE` y tampoco guarda nada. Si pasa, sus carpetas se guardan en su propia transacción en `sync_run_pages` hasta que la corrida se cierre.
- Swagger (`/docs`) documenta los tres endpoints con el esquema de seguridad `everything-agent`.

### Por qué los materiales se guardan al cerrar

El parseo de HU-136 necesita **todas** las carpetas a la vez: una carpeta es hoja cuando ninguna cuelga de ella, y un código se repite cuando lo dan dos hojas. Everything ordena por nombre y mezcla niveles entre páginas. En los fixtures, el año `1930 - Esc 1-0640 (12)` de la notaría segunda llega en la página 1 y sus meses en la 2, y los duplicados `1ra-1940 - Esc 0001-0161 - Ene` y `1ra-1940 - Esc 1-161 - Ene` llegan en páginas distintas. Parseando página por página, 8 carpetas de año o de notaría quedarían como materiales, que nunca se borran, y los dos duplicados se fundirían en uno solo, sin marca de revisión.

Por eso, al **cerrar una corrida completa** (`result: "OK"`):

1. Comprueba que llegaron exactamente las páginas 1..`pageCount`. Si falta o sobra alguna, la corrida termina en `ERROR` y no se marca nada.
2. Parsea todas las carpetas de la corrida con la convención. Si no queda ninguna carpeta hoja (por ejemplo, Everything no ve la unidad de red), termina en `ERROR` y no se marca nada.
3. Guarda los materiales **de cada página en su propia transacción**, con *upsert* por **código de catalogación**, nunca por ruta. Si el material no existe lo crea, disponible. Si existe, actualiza `source = EVERYTHING`, `digital_path` (la ruta de la carpeta hoja), `last_seen_at`, el título, la colección, el tipo y `review_reason`; su estado, autor, datos de publicación y solicitudes no cambian. Una carpeta renombrada o movida con el mismo código actualiza el mismo material.
4. Una hoja sin código válido usa el código derivado de su ruta y queda con `review_reason = NO_PATTERN`. Si dos hojas dan el mismo código, las dos usan el de su ruta y quedan con `DUPLICATE_CODE`. HU-140 lo muestra al personal.
5. En una sola transacción, deja como **«copia digital no encontrada»** (`digital_path = NULL`) cada material de Everything que esta corrida no vio, y cierra la corrida en `OK`. **Ningún material se borra**: puede tener solicitudes. Sin copia, HU-139 deja de ofrecer su paso directo a Disponible.

Una corrida cerrada con `result: "ERROR"`, cortada (el agente dejó de enviar páginas) o incompleta no cambia ningún material ni marca nada.

### Corridas y bloqueo

- Cada corrida queda en `sync_runs` con su inicio, su última actividad, su fin, el resultado (`PEDIDA`, `EN_CURSO`, `OK` o `ERROR`), los resultados recibidos (`files_count`) y el motivo del error.
- Dos sincronizaciones no corren a la vez, aunque haya dos instancias del backend: lo impide el índice único parcial `sync_runs_single_open_idx` de PostgreSQL, que cubre las corridas `PEDIDA` y `EN_CURSO` (HU-138). Iniciar otra mientras hay una abierta responde **409** `SYNC_RUN_ALREADY_RUNNING`; si la abierta es una `PEDIDA`, el inicio la toma.
- Una corrida que lleva más de `EVERYTHING_RUN_TIMEOUT_MINUTES` sin recibir páginas vence: cuando se inicia otra, o si el agente vuelve a escribirle (409 `SYNC_RUN_EXPIRED`), queda en `ERROR`, se borran sus páginas y no se marca nada.

### «Sincronizar ahora» (HU-138)

El servidor no puede llamar al PC del CLENA, así que «Sincronizar ahora» deja una corrida **pedida** y el agente la toma la próxima vez que pregunta:

1. El administrador abre **Sincronización** (`/admin/sincronizacion`, WF-14), pulsa «Sincronizar ahora» y confirma. El backend crea en `sync_runs` una corrida `PEDIDA` con quién y cuándo la pidió, sin inicio. La pantalla muestra «Pedida, esperando al agente» y desde cuándo.
2. El agente, iniciado con `--vigilar` por la tarea «Atender Sincronizar ahora» mientras la sesión está iniciada, pregunta cada `trackhive.poll_seconds` (60 s) `GET /api/v1/everything/sync-runs/requested`.
3. Si hay una, hace la misma sincronización que la tarea diaria. El inicio (`POST /everything/sync-runs`) toma la corrida pedida (la misma fila pasa a `EN_CURSO`), y sigue con páginas y cierre como siempre. La corrida diaria también la toma si llega antes.
4. La pantalla se actualiza sola, cada 5 s mientras hay una corrida pedida o en curso y cada 30 s si no. Cuando el agente termina, muestra el resultado nuevo: cuándo, cuántas carpetas, si terminó bien o con error y el motivo.

| Quién | Endpoint | Respuesta |
|---|---|---|
| Administrador (`@Roles('ADMIN')`) | `GET /api/v1/everything/sync-status` | 200: `enabled` (hay `EVERYTHING_AGENT_TOKEN`), `currentRun` (la `PEDIDA` o `EN_CURSO`, con `expired`), `lastRun` (la última `OK` o `ERROR`) y `agentLastContactAt` |
| Administrador (`@Roles('ADMIN')`) | `POST /api/v1/everything/sync-requests` | 201 con la corrida `PEDIDA`. **409** `SYNC_RUN_ALREADY_REQUESTED` o `SYNC_RUN_ALREADY_RUNNING` si ya hay una (no se pide otra). **503** `EVERYTHING_SYNC_DISABLED` sin token |
| Agente (su token) | `GET /api/v1/everything/sync-runs/requested` | 200: `{"requested": true, "requestedAt": "…"}` o `{"requested": false, "requestedAt": null}` |

- `PERSONAL` y `PUBLICO` reciben **403** en los dos endpoints del administrador; sin sesión, **401**. El token del agente no sirve como sesión, ni la sesión de un usuario como token del agente.
- Una corrida pedida **no vence**: si el PC del CLENA está apagado, sigue pedida y la pantalla dice desde cuándo. Una corrida `EN_CURSO` que el agente abandonó (más de `EVERYTHING_RUN_TIMEOUT_MINUTES` sin páginas) sale en la pantalla como «sin noticias del agente». Pedir otra la cierra con error, sin marcar nada como no encontrado, y deja la nueva pedida.
- **Último contacto del agente:** cada llamada que pasa `EverythingAgentGuard` (la pregunta y los endpoints de ingesta) guarda la hora en la tabla de una sola fila `sync_agent`. La pantalla la muestra para saber si el PC del CLENA está encendido.
- Sin `EVERYTHING_AGENT_TOKEN`, la pantalla dice que la integración está desactivada y el botón no está disponible.
- `trackhive-agente.exe` es un lanzador de PyInstaller con el agente como proceso hijo. Cuando Windows detiene la tarea (al reinstalarla o terminarla a mano) solo termina el lanzador, así que el agente espera sobre él y termina en ese momento («La tarea que inició al agente terminó…» en `logs\vigilancia.log`). Al cerrar sesión Windows termina los dos.

### Configuración

| Variable | Qué hace |
|---|---|
| `EVERYTHING_AGENT_TOKEN` | Token del agente, de al menos 32 caracteres (`openssl rand -hex 32`). Va en el `.env` del servidor y en la configuración del agente. `.env.example` y `agent/agente.example.toml` traen el mismo token público, solo para desarrollo: con `RUN_SEED=false` el backend no arranca con él. Un token real **nunca va en el repositorio**. Vacío: la integración está desactivada y los endpoints responden **503** `EVERYTHING_SYNC_DISABLED` sin aceptar nada. Un token más corto detiene el arranque. |
| `EVERYTHING_RUN_TIMEOUT_MINUTES` | Minutos sin páginas tras los que una corrida vence. Por defecto, 30. |

La convención de carpetas (raíces, patrones, tipos y exclusiones) se lee de `backend/config/catalog-convention.json` al arrancar. Un error en ese archivo detiene el arranque (sección 2).

### Probar con el agente

El agente (HU-166) hace la corrida completa contra el backend y el mock en Docker. `.env.example` y `agent/agente.example.toml` traen el mismo token de desarrollo, y el ejemplo del agente apunta al mock (`127.0.0.1:8081`, con su usuario y contraseña) y al backend de Docker (`http://127.0.0.1:3000`), así que basta copiarlos:

```bash
docker compose --profile everything up -d --build backend everything-mock   # con el .env copiado de .env.example

pip install -r agent/requirements.txt
cp agent/agente.example.toml agent/agente.toml   # agente.toml no se sube (.gitignore)
python agent/agente.py
```

Escribe cada paso en la consola y en `agent/logs/agente.log`, y termina con `Corrida … completa con 3 páginas: 117 carpetas hoja: …` y el código de salida 0.

Para probar «Sincronizar ahora» (HU-138) de punta a punta, con el frontend de Docker:

```bash
docker compose --profile everything up -d --build   # backend, frontend y mock
python agent/agente.py --vigilar                    # pregunta cada trackhive.poll_seconds (60 s); Ctrl+C lo detiene
```

En `http://localhost:8080`, con `admin@example.com`, abre **Sincronización**, pulsa «Sincronizar ahora» y confirma. La pantalla muestra «Pedida, esperando al agente». En el siguiente minuto el agente la toma: en `agent/logs/vigilancia.log` aparece `Un administrador pidió «Sincronizar ahora»…` y luego la corrida completa. La pantalla muestra sola el resultado nuevo. Si detienes el agente antes de pedirla, que es como tener el PC del CLENA apagado, la corrida sigue pedida y la pantalla dice desde cuándo. Con `poll_seconds = 10` en `agente.toml` se espera menos. `http://` solo se acepta contra este mismo PC (`localhost`, `127.0.0.1`); en el CLENA la URL es `https://`. En Windows sirve igual, también el `.exe`, contra el Everything portable de la sección 3, que escucha en `127.0.0.1:8081` (con el mock detenido) y el backend de Docker. Ahí conviene `http://127.0.0.1:3000`: con `localhost`, Windows prueba primero `::1` y cada petición tarda unos 2 s más.

Para probar los endpoints sin el agente, su trabajo se puede hacer con `curl`:

```bash
set -a; . ./.env; set +a   # EVERYTHING_AGENT_TOKEN
API=http://localhost:3000/api/v1/everything/sync-runs
AUTH="Authorization: Bearer $EVERYTHING_AGENT_TOKEN"
RUN=$(curl -s -X POST -H "$AUTH" "$API" | python3 -c 'import json, sys; print(json.load(sys.stdin)["id"])')

# Una página por raíz, tal como la responde el mock (count=200 basta para el árbol simulado)
n=0
for raiz in 'Aha\Fondo - Notarías\Notarías\' 'Aha\Fondo - Periódicos\' 'Aha\Fondo - Correspondencia\'; do
  n=$((n+1))
  curl -s -u trackhive:trackhive-dev -G http://localhost:8081/ \
    --data-urlencode "search=folder: \"C:\trackhive\docs_simulados\\$raiz\"" \
    -d json=1 -d path_column=1 -d size_column=1 -d date_modified_column=1 -d offset=0 -d count=200 |
    curl -s -X PUT -H "$AUTH" -H 'Content-Type: application/json' --data-binary @- "$API/$RUN/pages/$n"
  echo
done

curl -s -X POST -H "$AUTH" -H 'Content-Type: application/json' \
  -d "{\"result\":\"OK\",\"pageCount\":$n}" "$API/$RUN/close"
```

El cierre devuelve qué hizo (`leaves`, `created`, `updated`, `notFound`, `forReview`). Con la semilla recién cargada responde `leaves: 117` y `forReview: 11`, como el manifiesto, más `updated: 33` (los materiales de la semilla, reconocidos por su código) y `created: 84` (el resto del árbol simulado). `NOT4-1956-0001-0180` no está en el árbol y ya viene sin copia, así que sigue igual: `notFound` solo cuenta los materiales que tenían copia y esta corrida no vio. Para ver el resultado en la base:

```bash
docker compose exec postgres sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "SELECT status, files_count, error_message, finished_at FROM sync_runs ORDER BY started_at DESC LIMIT 3;"'
docker compose exec postgres sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "SELECT catalog_code, review_reason, digital_path IS NOT NULL AS con_copia FROM materials ORDER BY catalog_code;"'
```

## 8. Pruebas

### Mapeo en el backend (HU-135)

`EverythingPageMapper.toDocumentRecords` (`backend/src/everything/application/mappers/`) convierte una página cruda (`totalResults`, `results`) en `DocumentRecord[]`: une la carpeta y el nombre con `\` (salvo la raíz del índice, que llega con `path` vacío), pasa `size` a número (sin tamaño en carpetas) y `date_modified` de FILETIME a `Date`. Si la página no tiene la forma de Everything (falta `results` o una columna, un campo con otro tipo, una fecha que no es número) lanza `INVALID_EVERYTHING_PAGE` (400) y no devuelve nada. Sus pruebas usan los fixtures de la sección 5:

```bash
cd backend && pnpm exec jest src/everything
```

### Sincronización (HU-137)

- `src/everything/application/services/everything-synchronizer.spec.ts` prueba el servicio con un repositorio en memoria, el parseo y la convención reales y las páginas de los fixtures. Cubre la corrida completa, el renombre, los duplicados entre páginas, el vencimiento, el 409, el 413, el cierre con error, el cierre incompleto y el fallo a mitad del cierre. Junto a ella están las pruebas de la entidad `SyncRun`, del guard del agente, de la configuración y de los DTOs.
- `test/flows/everything-sync-flow.e2e-spec.ts` envía las páginas reales de los fixtures a los endpoints contra PostgreSQL. Cubre una corrida completa, una carpeta renombrada, una corrida cortada que no marca nada, llamadas sin token o con el de un usuario que no guardan nada, el 503 sin `EVERYTHING_AGENT_TOKEN`, dos inicios a la vez (409) y las páginas que se rechazan (413 y 400).

```bash
cd backend && pnpm exec jest src/everything
cd backend && pnpm test:e2e -- everything-sync   # borra y recrea la base trackhive_e2e
```

### Sincronizar ahora (HU-138)

- Unitarias: `sync-run.entity.spec.ts` (estado `PEDIDA`, tomarla, que no vence), los casos de uso `request-sync-run`, `get-sync-status`, `get-requested-sync-run` y `record-agent-contact`, el `SyncRunExpirer`, el `AgentContactInterceptor` y el inicio que toma la corrida pedida en `everything-synchronizer.spec.ts`.
- `test/flows/everything-sync-now-flow.e2e-spec.ts`, contra PostgreSQL: pedir y ver «pedida», el 409 al pedir otra (pedida o en curso), que el agente la toma y la cierra y el estado muestra el resultado nuevo, una pedida que espera días, dos administradores a la vez, una corrida abandonada que no bloquea, el 403 de `PERSONAL` y `PUBLICO`, el 401 sin token o sesión, el 503 sin `EVERYTHING_AGENT_TOKEN` y las reglas de `sync_runs` (índice y `CHECK`).
- Frontend: `EverythingSyncPage.spec.tsx` y, con Docker, `frontend/e2e-docker/everything-sync.spec.ts` a través de nginx (`localhost:8080`).
- Agente: `agent/tests/test_vigilar.py` (el caso de uso con fakes) y la clase `WatchTest` de `test_agente.py` (el agente como proceso con `--vigilar`).

```bash
cd backend && pnpm exec jest src/everything
cd backend && pnpm test:e2e -- everything-sync      # borra y recrea la base trackhive_e2e
```

### Agente (HU-166)

```bash
pip install -r dev/requirements.txt -r agent/requirements.txt
python -m unittest discover -s agent/tests -t agent -v
```

Prueban las reglas de la corrida (numeración, nunca completa tras un fallo), la configuración (`http://` solo contra `localhost`, token de 32 caracteres o más, raíces iguales a las de `backend/config/catalog-convention.json`), el caso de uso con fakes (reintentos con espera creciente, Everything caído o lento) y el agente como proceso contra el **mock de esta guía** y un Trackhive falso, también por HTTPS con un certificado de prueba. La consulta del agente es la misma de los fixtures (`carpetas_notarias_p1`), y la página que envía es, byte a byte, la que responde Everything. El job `agente` del CI las corre en Ubuntu y Windows; en Windows además construye `trackhive-agente.exe`, lo prueba igual y revisa la tarea programada ([agente.md](agente.md)).

### Árbol, mock y fixtures

```bash
pip install -r dev/requirements.txt
python -m unittest discover -s dev/tests -t dev/tests -v
```

El job `dev-everything` del CI las corre en Ubuntu y en Windows. Comprueban:

- que los dos sistemas generan el mismo árbol y el manifiesto subido;
- los casos raros, las imágenes vacías y que no haya contenido real;
- el ejemplo de HU-136 y los códigos de la semilla;
- el mock frente a los fixtures del Everything real.
