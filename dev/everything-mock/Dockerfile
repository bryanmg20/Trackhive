# Mock of the Everything HTTP server over the simulated documents (HU-133).
# Built from the repository root: docker compose --profile everything up -d
FROM python:3.13-alpine

WORKDIR /app
COPY dev/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY dev/simulador ./simulador
COPY dev/everything-mock ./everything-mock

ENV EVERYTHING_MOCK_HOST=0.0.0.0 \
    EVERYTHING_MOCK_PORT=8081 \
    PYTHONUNBUFFERED=1
EXPOSE 8081
USER nobody

# Generates the same tree as anywhere else (fixed seed) and serves it with the
# Windows paths of convencion.yaml, like the real Everything
CMD ["sh", "-c", "python simulador/generar_docs.py --salida /tmp/docs_simulados --manifiesto /tmp/manifiesto.json && exec python everything-mock/everything_mock.py --docs /tmp/docs_simulados"]
