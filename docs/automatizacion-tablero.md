# Automatización del tablero

El tablero [Trackhive - Tablero Scrum](https://github.com/users/bryanmg20/projects/2) mueve los issues solo, según lo que pasa en el repositorio:

| Evento | Columna | Quién lo hace |
|---|---|---|
| Se crea la rama `feat/<issue>-...`, `fix/<issue>-...` o `docs/<issue>-...` | **In Progress** | Action `.github/workflows/tablero-in-progress.yml` |
| Se abre un PR enlazado al issue (`Closes #<issue>`) | **In review** | Workflow nativo del Project «Pull request linked to issue» |
| Se fusiona el PR | **Done** | Workflow nativo del Project «Pull request merged» |

## In Progress (GitHub Action)

Al subir una rama nueva (`git push -u origin feat/12-descripcion`), la Action lee el número de issue del nombre de la rama y pone su tarjeta en **In Progress**.

- Si la rama no tiene número de issue, o el issue no está en el tablero, la Action termina sin error y no cambia nada.
- El evento `create` usa la versión del workflow que tiene la rama creada, así que solo funciona en ramas creadas desde un `main` que ya incluya este archivo.

### Secret `PROJECT_TOKEN`

El tablero es un Project de usuario, y el `GITHUB_TOKEN` de Actions no puede modificarlo. Por eso la Action usa un token personal:

1. El dueño del tablero crea un token **classic** en GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic), con el scope `project`.
2. En el repositorio: Settings → Secrets and variables → Actions → New repository secret, con nombre `PROJECT_TOKEN` y el token como valor.

Si el secret no existe, la Action muestra una advertencia y no cambia nada.

## In review y Done (workflows nativos)

En el tablero: **⋯ → Workflows**, activar:

- **Pull request linked to issue** → Status: `In review`.
- **Pull request merged** → Status: `Done`.

Una tarjeta solo llega a **Done** cuando su PR está fusionado.
