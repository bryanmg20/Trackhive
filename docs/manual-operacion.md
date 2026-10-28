# Manual de operación

> Estado: pendiente (Sprint 3). El CLENA debe poder operar el sistema sin el equipo.

## 1. Requisitos

- Docker y docker-compose
- (Versiones, recursos mínimos del servidor)

## 2. Levantar el sistema

```bash
git clone <url-del-repo>
cp .env.example .env   # completar los valores
docker-compose up -d
```

## 3. Variables de entorno

| Variable | Descripción | Ejemplo (ficticio) | Obligatoria |
|---|---|---|---|
| DATABASE_URL | Conexión a PostgreSQL | | Sí |
| JWT_SECRET | Secreto del access token | | Sí |
| JWT_REFRESH_SECRET | Secreto del refresh token | | Sí |
| SMTP_HOST | Servidor de correo | | Sí |

No escribir secretos reales en este documento.

## 4. Despliegue

- URL desplegada:
- Plataforma:
- Cómo desplegar una nueva versión:

## 5. Migraciones y datos semilla

(Cómo ejecutarlas.)

## 6. Respaldo y restauración de la base de datos

### Respaldo
```bash
# comando de pg_dump
```

### Restauración
```bash
# comando de pg_restore o psql
```

Frecuencia recomendada y dónde se guardan los respaldos:

## 7. Monitoreo

- Endpoint de salud: `/health`
- Dónde ver los logs:

## 8. Usuarios iniciales y cambio de contraseñas

## 9. Solución de problemas comunes

## 10. Contactos y licencia

- Licencia y propiedad del código: (pendiente de definir con el CLENA y la universidad)
