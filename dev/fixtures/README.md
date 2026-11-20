# Fixtures del servidor HTTP de Everything

Respuestas **reales** de Everything 1.4.1.1032 x64 (portable), capturadas el 2026-11-20 con `dev/scripts/capturar_fixtures.py` contra `http://127.0.0.1:8081`, que indexa solo `C:\trackhive\docs_simulados` (guía en [docs/everything-desarrollo.md](../../docs/everything-desarrollo.md)).

- Cada `everything_<id>.json` es el cuerpo tal cual lo envió Everything (CRLF y tabulaciones incluidos).
- [`capturas.json`](capturas.json) guarda de cada una el código HTTP, las cabeceras (menos `Date`) y la URL.
- Debajo de cada fixture está el comando `curl` con el que se capturó; las credenciales se cambian por variables.
- Para volver a capturarlos o compararlos con otro Everything, mira la guía. No se editan a mano.

## everything_carpetas_notarias_p1.json

Solo carpetas bajo la raíz del fondo de notarías (folder: + ruta), primera página. Es la consulta de la sincronización (HU-135, HU-137). Respuesta: **200**.

Búsqueda: `folder: "C:\trackhive\docs_simulados\Aha\Fondo - Notarías\Notarías\"`

```bash
curl -s -S -D - -o everything_carpetas_notarias_p1.json -u "$EVERYTHING_USER:$EVERYTHING_PASSWORD" "http://127.0.0.1:8081/?search=folder%3A%20%22C%3A%5Ctrackhive%5Cdocs_simulados%5CAha%5CFondo%20-%20Notar%C3%ADas%5CNotar%C3%ADas%5C%22&json=1&path_column=1&size_column=1&date_modified_column=1&offset=0&count=50"
```

## everything_carpetas_notarias_p2.json

La misma búsqueda, segunda página (offset 50). Respuesta: **200**.

Búsqueda: `folder: "C:\trackhive\docs_simulados\Aha\Fondo - Notarías\Notarías\"`

```bash
curl -s -S -D - -o everything_carpetas_notarias_p2.json -u "$EVERYTHING_USER:$EVERYTHING_PASSWORD" "http://127.0.0.1:8081/?search=folder%3A%20%22C%3A%5Ctrackhive%5Cdocs_simulados%5CAha%5CFondo%20-%20Notar%C3%ADas%5CNotar%C3%ADas%5C%22&json=1&path_column=1&size_column=1&date_modified_column=1&offset=50&count=50"
```

## everything_carpetas_notarias_p3.json

La misma búsqueda, última página: trae menos de count. Respuesta: **200**.

Búsqueda: `folder: "C:\trackhive\docs_simulados\Aha\Fondo - Notarías\Notarías\"`

```bash
curl -s -S -D - -o everything_carpetas_notarias_p3.json -u "$EVERYTHING_USER:$EVERYTHING_PASSWORD" "http://127.0.0.1:8081/?search=folder%3A%20%22C%3A%5Ctrackhive%5Cdocs_simulados%5CAha%5CFondo%20-%20Notar%C3%ADas%5CNotar%C3%ADas%5C%22&json=1&path_column=1&size_column=1&date_modified_column=1&offset=100&count=50"
```

## everything_carpetas_periodicos.json

Solo carpetas bajo el fondo de periódicos, sin count: Everything devuelve todas. Respuesta: **200**.

Búsqueda: `folder: "C:\trackhive\docs_simulados\Aha\Fondo - Periódicos\"`

```bash
curl -s -S -D - -o everything_carpetas_periodicos.json -u "$EVERYTHING_USER:$EVERYTHING_PASSWORD" "http://127.0.0.1:8081/?search=folder%3A%20%22C%3A%5Ctrackhive%5Cdocs_simulados%5CAha%5CFondo%20-%20Peri%C3%B3dicos%5C%22&json=1&path_column=1&size_column=1&date_modified_column=1"
```

## everything_carpetas_raiz_sin_barra.json

La raíz sin la barra final también trae la carpeta raíz: por eso la búsqueda termina en \. Respuesta: **200**.

Búsqueda: `folder: "C:\trackhive\docs_simulados\Aha\Fondo - Notarías\Notarías"`

```bash
curl -s -S -D - -o everything_carpetas_raiz_sin_barra.json -u "$EVERYTHING_USER:$EVERYTHING_PASSWORD" "http://127.0.0.1:8081/?search=folder%3A%20%22C%3A%5Ctrackhive%5Cdocs_simulados%5CAha%5CFondo%20-%20Notar%C3%ADas%5CNotar%C3%ADas%22&json=1&path_column=1&count=3"
```

## everything_carpetas_fuera_de_raiz.json

Carpeta de trabajo que cuelga de «Fondo - Notarías» pero fuera de la raíz «Notarías». Respuesta: **200**.

Búsqueda: `folder: "C:\trackhive\docs_simulados\Aha\Fondo - Notarías\" pdf`

```bash
curl -s -S -D - -o everything_carpetas_fuera_de_raiz.json -u "$EVERYTHING_USER:$EVERYTHING_PASSWORD" "http://127.0.0.1:8081/?search=folder%3A%20%22C%3A%5Ctrackhive%5Cdocs_simulados%5CAha%5CFondo%20-%20Notar%C3%ADas%5C%22%20pdf&json=1&path_column=1"
```

## everything_raiz_del_indice.json

La carpeta indexada (Indexes → Folders) llega con name = ruta completa y path vacío: el adaptador no debe unirlas con \. Respuesta: **200**.

Búsqueda: `"C:\trackhive\docs_simulados" !"C:\trackhive\docs_simulados\"`

```bash
curl -s -S -D - -o everything_raiz_del_indice.json -u "$EVERYTHING_USER:$EVERYTHING_PASSWORD" "http://127.0.0.1:8081/?search=%22C%3A%5Ctrackhive%5Cdocs_simulados%22%20%21%22C%3A%5Ctrackhive%5Cdocs_simulados%5C%22&json=1&path_column=1&size_column=1&date_modified_column=1"
```

## everything_archivos_de_una_hoja.json

Imágenes de una carpeta de mes: archivos con tamaño "0". Respuesta: **200**.

Búsqueda: `"C:\trackhive\docs_simulados\Aha\Fondo - Notarías\Notarías\1ra - Notaria Primera de Barranquilla - 1815 a 1979\1931 - Esc 1-1290 (12) +\1ra-1931 - Esc 0001-0109 - Ene\"`

```bash
curl -s -S -D - -o everything_archivos_de_una_hoja.json -u "$EVERYTHING_USER:$EVERYTHING_PASSWORD" "http://127.0.0.1:8081/?search=%22C%3A%5Ctrackhive%5Cdocs_simulados%5CAha%5CFondo%20-%20Notar%C3%ADas%5CNotar%C3%ADas%5C1ra%20-%20Notaria%20Primera%20de%20Barranquilla%20-%201815%20a%201979%5C1931%20-%20Esc%201-1290%20%2812%29%20%2B%5C1ra-1931%20-%20Esc%200001-0109%20-%20Ene%5C%22&json=1&path_column=1&size_column=1&date_modified_column=1"
```

## everything_y_entre_palabras.json

Las palabras separadas por espacio se combinan con Y. Respuesta: **200**.

Búsqueda: `"C:\trackhive\docs_simulados\" esc en`

```bash
curl -s -S -D - -o everything_y_entre_palabras.json -u "$EVERYTHING_USER:$EVERYTHING_PASSWORD" "http://127.0.0.1:8081/?search=%22C%3A%5Ctrackhive%5Cdocs_simulados%5C%22%20esc%20en&json=1&path_column=1"
```

## everything_frase_entre_comillas.json

Entre comillas, las palabras van juntas. Respuesta: **200**.

Búsqueda: `"C:\trackhive\docs_simulados\" "Esc en"`

```bash
curl -s -S -D - -o everything_frase_entre_comillas.json -u "$EVERYTHING_USER:$EVERYTHING_PASSWORD" "http://127.0.0.1:8081/?search=%22C%3A%5Ctrackhive%5Cdocs_simulados%5C%22%20%22Esc%20en%22&json=1&path_column=1"
```

## everything_sin_tildes.json

Sin distinguir tildes: «notarias» encuentra «Notarías». Respuesta: **200**.

Búsqueda: `"C:\trackhive\docs_simulados\" notarias`

```bash
curl -s -S -D - -o everything_sin_tildes.json -u "$EVERYTHING_USER:$EVERYTHING_PASSWORD" "http://127.0.0.1:8081/?search=%22C%3A%5Ctrackhive%5Cdocs_simulados%5C%22%20notarias&json=1&path_column=1"
```

## everything_mayusculas_y_tildes.json

Sin distinguir mayúsculas ni tildes: «NOTARÍA primera» encuentra «Notaria Primera». Respuesta: **200**.

Búsqueda: `"C:\trackhive\docs_simulados\" NOTARÍA primera`

```bash
curl -s -S -D - -o everything_mayusculas_y_tildes.json -u "$EVERYTHING_USER:$EVERYTHING_PASSWORD" "http://127.0.0.1:8081/?search=%22C%3A%5Ctrackhive%5Cdocs_simulados%5C%22%20NOTAR%C3%8DA%20primera&json=1&path_column=1"
```

## everything_o_entre_palabras.json

El operador | (O) se aplica antes que el espacio (Y). Respuesta: **200**.

Búsqueda: `"C:\trackhive\docs_simulados\" LEEME | Aha`

```bash
curl -s -S -D - -o everything_o_entre_palabras.json -u "$EVERYTHING_USER:$EVERYTHING_PASSWORD" "http://127.0.0.1:8081/?search=%22C%3A%5Ctrackhive%5Cdocs_simulados%5C%22%20LEEME%20%7C%20Aha&json=1&path_column=1&size_column=1"
```

## everything_negacion_y_orden_por_ruta.json

! excluye por nombre; sort=path ordena por carpeta contenedora y luego por nombre. Respuesta: **200**.

Búsqueda: `folder: "C:\trackhive\docs_simulados\Aha\" !notar`

```bash
curl -s -S -D - -o everything_negacion_y_orden_por_ruta.json -u "$EVERYTHING_USER:$EVERYTHING_PASSWORD" "http://127.0.0.1:8081/?search=folder%3A%20%22C%3A%5Ctrackhive%5Cdocs_simulados%5CAha%5C%22%20%21notar&json=1&path_column=1&sort=path&ascending=1&count=14"
```

## everything_orden_nombre_descendente.json

Por nombre las carpetas van primero; ascending=0 invierte toda la lista. Respuesta: **200**.

Búsqueda: `"C:\trackhive\docs_simulados\" 1577`

```bash
curl -s -S -D - -o everything_orden_nombre_descendente.json -u "$EVERYTHING_USER:$EVERYTHING_PASSWORD" "http://127.0.0.1:8081/?search=%22C%3A%5Ctrackhive%5Cdocs_simulados%5C%22%201577&json=1&path_column=1&sort=name&ascending=0"
```

## everything_mismo_nombre_en_dos_carpetas.json

Archivos con el mismo nombre en las dos carpetas del código duplicado: el empate se resuelve por la ruta. Respuesta: **200**.

Búsqueda: `"C:\trackhive\docs_simulados\" 1940 Esc 0001 jpg`

```bash
curl -s -S -D - -o everything_mismo_nombre_en_dos_carpetas.json -u "$EVERYTHING_USER:$EVERYTHING_PASSWORD" "http://127.0.0.1:8081/?search=%22C%3A%5Ctrackhive%5Cdocs_simulados%5C%22%201940%20Esc%200001%20jpg&json=1&path_column=1&size_column=1"
```

## everything_comodines.json

Con * o ? se compara el nombre completo. Respuesta: **200**.

Búsqueda: `"C:\trackhive\docs_simulados\" *.pdf`

```bash
curl -s -S -D - -o everything_comodines.json -u "$EVERYTHING_USER:$EVERYTHING_PASSWORD" "http://127.0.0.1:8081/?search=%22C%3A%5Ctrackhive%5Cdocs_simulados%5C%22%20%2A.pdf&json=1&path_column=1"
```

## everything_solo_archivos.json

file: deja solo archivos; sin columnas, cada resultado trae solo type y name. Respuesta: **200**.

Búsqueda: `"C:\trackhive\docs_simulados\" file: 1577`

```bash
curl -s -S -D - -o everything_solo_archivos.json -u "$EVERYTHING_USER:$EVERYTHING_PASSWORD" "http://127.0.0.1:8081/?search=%22C%3A%5Ctrackhive%5Cdocs_simulados%5C%22%20file%3A%201577&json=1"
```

## everything_parametros_cortos.json

s, o y c son lo mismo que search, offset y count. Respuesta: **200**.

Búsqueda: `folder: "C:\trackhive\docs_simulados\Aha\Fondo - Periódicos\"`

```bash
curl -s -S -D - -o everything_parametros_cortos.json -u "$EVERYTHING_USER:$EVERYTHING_PASSWORD" "http://127.0.0.1:8081/?s=folder%3A%20%22C%3A%5Ctrackhive%5Cdocs_simulados%5CAha%5CFondo%20-%20Peri%C3%B3dicos%5C%22&o=1&c=2&json=1&path_column=1"
```

## everything_parametro_q.json

q también es la búsqueda. Respuesta: **200**.

Búsqueda: `"C:\trackhive\docs_simulados\" folder:1577`

```bash
curl -s -S -D - -o everything_parametro_q.json -u "$EVERYTHING_USER:$EVERYTHING_PASSWORD" "http://127.0.0.1:8081/?q=%22C%3A%5Ctrackhive%5Cdocs_simulados%5C%22%20folder%3A1577&json=1&path_column=1"
```

## everything_sin_resultados.json

Búsqueda sin resultados. Respuesta: **200**.

Búsqueda: `"C:\trackhive\docs_simulados\" noexiste`

```bash
curl -s -S -D - -o everything_sin_resultados.json -u "$EVERYTHING_USER:$EVERYTHING_PASSWORD" "http://127.0.0.1:8081/?search=%22C%3A%5Ctrackhive%5Cdocs_simulados%5C%22%20noexiste&json=1&path_column=1"
```

## everything_offset_fuera_de_rango.json

Un offset mayor que el total: results vacío y totalResults igual. Respuesta: **200**.

Búsqueda: `folder: "C:\trackhive\docs_simulados\Aha\Fondo - Periódicos\"`

```bash
curl -s -S -D - -o everything_offset_fuera_de_rango.json -u "$EVERYTHING_USER:$EVERYTHING_PASSWORD" "http://127.0.0.1:8081/?search=folder%3A%20%22C%3A%5Ctrackhive%5Cdocs_simulados%5CAha%5CFondo%20-%20Peri%C3%B3dicos%5C%22&json=1&offset=100&count=10"
```

## everything_sin_credenciales.html

Sin usuario ni contraseña: 401 con WWW-Authenticate. Respuesta: **401**.

Búsqueda: `"C:\trackhive\docs_simulados\"`

```bash
curl -s -S -D - -o everything_sin_credenciales.html "http://127.0.0.1:8081/?search=%22C%3A%5Ctrackhive%5Cdocs_simulados%5C%22&json=1"
```

## everything_contrasena_incorrecta.html

Con una contraseña incorrecta: 401. Respuesta: **401**.

Búsqueda: `"C:\trackhive\docs_simulados\"`

```bash
curl -s -S -D - -o everything_contrasena_incorrecta.html -u "$EVERYTHING_USER:incorrecta" "http://127.0.0.1:8081/?search=%22C%3A%5Ctrackhive%5Cdocs_simulados%5C%22&json=1"
```
