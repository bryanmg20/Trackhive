# Logos institucionales de los bocetos

Referencias proporcionadas por el equipo el 19 de noviembre de 2026:

- `clena-horizontal.png`: variante horizontal amarilla de CLENA.
- `uninorte-horizontal.png`: firma horizontal de Universidad del Norte.
- `uninorte-simbolo.png`: símbolo UN, conservado como referencia adicional.

Se conservan intactos los PNG recibidos. `preparar-logos.mjs` deriva las
versiones `*-transparente.png` desde esos originales: convierte únicamente
el blanco neutro del fondo (canales >=245 y diferencia entre ellos <=8) en
transparencia. No usa generación de imágenes, no redibuja ni cambia los valores
RGBA de los píxeles conservados. Recorta solo el margen exterior vacío, sin
reescalar. `logos.json` registra dimensiones, recorte y la comprobación de
cero píxeles de marca modificados. El logo horizontal original de Uninorte
ya tenía transparencia; su fondo blanco visible era el contenedor del encabezado.

Ambas cabeceras usan ahora las firmas horizontales originales sobre el fondo
crema, sin rectángulo blanco. El alto visible común es 52 px en escritorio y
36 px en móvil, con la misma coordenada superior dentro de cada composición.
El ancho se calcula desde la proporción de cada marca. Las imágenes se incrustan para que los SVG sean
portables al importarlos en Figma. Esta entrega no define un manual de marca
ni atribuye una licencia abierta a los logos. G6 debe revisar su aplicación.

La tipografía Inter tiene su licencia independiente en `Inter-LICENSE.txt`.
Las fotografías de la ciudad siguen pendientes de entrega.
