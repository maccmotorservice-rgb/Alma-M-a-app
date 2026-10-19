# Diseño reversible

El rediseño visual v45 se aplica mediante `modern.css`, con reglas limitadas a `html[data-design="modern"]`. `style.css` y `layout.css` conservan el diseño anterior. Los PDF se generan con los módulos originales y no usan esta hoja de estilos.

En la cabecera, **Diseño anterior** vuelve inmediatamente al aspecto anterior. **Probar diseño nuevo** reactiva el nuevo. La elección se guarda en `localStorage` como `alma-mia-design`, por navegador. No modifica el inventario, el usuario autenticado, las notas de venta ni Supabase. La lectura previa a la carga de CSS evita mostrar brevemente el diseño incorrecto. Si falla el almacenamiento de preferencias, el cambio sigue funcionando durante esa sesión.

La navegación nueva usa iconos SVG y agrupación visual. En pantallas pequeñas el botón Menú abre las secciones; seleccionar una o pulsar Escape cierra el menú. El diseño anterior mantiene sus botones de navegación visibles.

## Referencia para restauración

El estado completo anterior al rediseño está conservado con la etiqueta Git `design-before-modernization-v44`, que apunta a `6a6422dfae29a8c8aa406a7b0067f4c2d5d9e51d`.

El selector basta para recuperar el diseño anterior, sin restaurar datos ni versiones de funciones. Para retirar definitivamente el rediseño, se puede revertir el commit de diseño y volver a publicar las dos ramas siguiendo el proceso habitual. No restaurar respaldos de inventario para cambiar el diseño.

## Verificación

Se revisaron las 12 secciones principales con datos de demostración, a 1440, 1024, 768, 390 y 320 píxeles. Se comprobaron el menú móvil, los formularios de producción y notas de venta, el cambio de diseño, la persistencia al recargar y la protección de acceso tras cerrar sesión. La prueba de interfaz no realizó escrituras de inventario.
