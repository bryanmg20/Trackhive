# dev: entorno de Everything sin el CLENA

Herramientas de desarrollo de la épica E11 (HU-133). La guía completa está en [docs/everything-desarrollo.md](../docs/everything-desarrollo.md).

```bash
pip install -r dev/requirements.txt
python dev/simulador/generar_docs.py                        # dev/docs_simulados y dev/manifiesto.json
python dev/everything-mock/everything_mock.py                # mock en http://127.0.0.1:8081
python dev/scripts/comparar_everything.py --url http://127.0.0.1:8081
python -m unittest discover -s dev/tests -t dev/tests        # pruebas
```

| Carpeta o archivo | Contenido |
|---|---|
| `simulador/convencion.yaml` | Fondos y niveles de carpetas del CLENA (forma de los nombres y casos raros) |
| `simulador/generar_docs.py` | Genera el árbol y el manifiesto; igual en Linux y Windows |
| `manifiesto.json` | Lo que el parseo (HU-136) debe sacar de cada carpeta hoja. Se regenera, no se edita |
| `docs_simulados/` | El árbol generado (no se sube al repositorio) |
| `everything-portable/` | `.ini` del Everything portable que indexa solo `C:\trackhive\docs_simulados` |
| `fixtures/` | Respuestas reales de Everything 1.4.1.1032 y el `curl` de cada una |
| `everything-mock/` | Mock del servidor HTTP; también como servicio `everything-mock` de docker compose |
| `scripts/` | Capturar los fixtures de un Everything real y comparar cualquier servidor con ellos |
| `tests/` | Pruebas con `unittest`; el CI las corre en Ubuntu y Windows |

No contiene imágenes reales ni datos personales del CLENA: las imágenes son archivos vacíos y los nombres solo copian la forma de las carpetas.
