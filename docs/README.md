# Documentación

Documentos del proyecto en Markdown, con su versión exportada a PDF cuando aplica.

| Documento | Fuente | PDF |
|---|---|---|
| Acta de Inception | `inception.md` | `inception.pdf` |
| Daily Scrum | `daily-scrum.md` | `daily-scrum.pdf` |
| Evidencias (grabaciones y trazabilidad) | `evidencias.md` | `evidencias.pdf` |
| Sprint Planning | `sprint-planning.md` | `sprint-planning.pdf` |
| Sprint Review | `sprint-review.md` | `sprint-review.pdf` |
| Sprint Retrospective | `sprint-retrospective.md` | — |
| Arquitectura | `arquitectura.md` | pendiente (E4) |
| Modelo de datos | `modelo-datos.md` | pendiente (E4) |
| Modelo de dominio | — | pendiente (E3) |
| Manual de operación | `manual-operacion.md` | — |
| Manual de usuario | `manual-usuario.md` | — |
| Automatización del tablero | `automatizacion-tablero.md` | — |

Los PDF de arquitectura, modelo de datos y modelo de dominio se agregan cuando entren las entregas E3 a E5; el script ya los exporta con el mismo comando.

## Exportar a PDF

Los PDF llevan portada, índice, paginación y enlaces activos. Se generan con Chrome o Edge en modo headless; no hace falta pandoc.

```bash
python -m pip install markdown reportlab pypdf
python docs/tools/md2pdf.py --all            # todos los documentos con PDF
python docs/tools/md2pdf.py docs/inception.md  # uno solo
python docs/tools/check_pdfs.py             # verifica portada, índice, paginación y enlaces
```

Los videos no se suben al repositorio: viven en SharePoint y se enlazan desde `evidencias.md` e `inception.md`.
