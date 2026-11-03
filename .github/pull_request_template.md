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
- [ ] Tiene pruebas unitarias de la lógica nueva, y prueba e2e si completa un flujo principal.
- [ ] Si el usuario interactúa con la funcionalidad, incluye su pantalla integrada con la API.
- [ ] Las pantallas son usables en 360 px, tienen etiquetas en los campos y se operan con teclado.
- [ ] Solo pide los datos personales necesarios.
- [ ] CI en verde y al menos una aprobación de un compañero.
