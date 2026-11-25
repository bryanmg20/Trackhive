## Issue

Closes #

## Qué cambia

<!-- Describe brevemente el cambio. -->

## Cómo probarlo

<!-- Pasos para verificar el cambio. -->

## Definition of Done

<!-- Marca [x] lo que cumple. Si un ítem no aplica, márcalo y escribe "N/A" con el motivo. No borres ítems. -->

- [ ] El PR referencia su issue (`Closes #n`) y describe qué cambia y cómo probarlo.
- [ ] Los endpoints nuevos están bajo `/api/v1`, documentados en Swagger y validados con DTOs.
- [ ] Incluye su migración si toca la base de datos, y actualiza el diagrama ER.
- [ ] Tiene pruebas unitarias de la lógica nueva.
- [ ] Si completa o cambia un flujo principal, o una regla que impone la base de datos (índice único, CHECK, trigger, transacción), tiene su prueba e2e contra PostgreSQL en `backend/test/flows/` (D-21): verifica las filas guardadas y que un error no guarde nada.
- [ ] Si el usuario interactúa con la funcionalidad, incluye su pantalla integrada con la API.
- [ ] Las pantallas tienen etiquetas en los campos y se operan con teclado. Desde HU-29 (layout base), además son usables en 360 px; las pantallas anteriores se revisan en HU-29.
- [ ] Solo pide los datos personales necesarios y cada campo nuevo o modificado (UI, API o integración) enlaza su justificación en [`docs/datos-personales.md`](../docs/datos-personales.md): finalidad, obligatoriedad, alternativa mínima y quién lo ve. Si no aplica, explicar por qué no incorpora datos personales.
- [ ] CI en verde y al menos una aprobación de un compañero.
