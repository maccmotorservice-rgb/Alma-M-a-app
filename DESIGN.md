# Diseño reversible

## Centro de control Éter (v59)

La versión 3 usa una interfaz de grafito y azul profundo con acentos menta y cian. La tipografía Manrope, los números tabulares y las superficies de contraste alto sustituyen la composición editorial anterior. El menú lateral permanece visible en escritorio, agrupado por operación, ventas, impresión, consultas y sistema. En móvil se convierte en un menú desplegable con accesos inferiores.

El Resumen muestra primero las existencias y las alertas; después, las cuentas de venta, producción y accesos rápidos, el detalle anual y la actividad. Las cuatro métricas de inventario abren su detalle mediante clic, Enter o Espacio. Nueva nota, Imprimir y los demás accesos utilizan los formularios y rutas existentes. No crean movimientos al navegar.

Las versiones 1 y 2 siguen disponibles en **Diseño**, sin migrar ni restaurar datos. La capa nueva está limitada a `html[data-design="modern"][data-version="3"]` en `studio.css`; la composición vive en `studio.js`. Se conservan las preferencias de efectos y movimiento reducido. Los PDF, la sincronización, las fórmulas de producción y los sonidos de bienvenida y acceso mantienen su comportamiento.

El aspecto anterior de la versión 3 queda conservado en el commit `df782deeae092b3bf184c85d640e19a58254803d` (v58). La restauración visual no requiere importar respaldos de inventario.

## Diseño anterior (v45–v58)

El rediseño visual v45 se aplica mediante `modern.css`, con reglas limitadas a `html[data-design="modern"]`. `style.css` y `layout.css` conservan el diseño anterior. Los PDF se generan con los módulos originales y no usan esta hoja de estilos.

En la cabecera, **Diseño anterior** vuelve inmediatamente al aspecto anterior. **Probar diseño nuevo** reactiva el nuevo. La elección se guarda en `localStorage` como `alma-mia-design`, por navegador. No modifica el inventario, el usuario autenticado, las notas de venta ni Supabase. La lectura previa a la carga de CSS evita mostrar brevemente el diseño incorrecto. Si falla el almacenamiento de preferencias, el cambio sigue funcionando durante esa sesión.

La navegación nueva usa iconos SVG y agrupación visual. En pantallas pequeñas el botón Menú abre las secciones; seleccionar una o pulsar Escape cierra el menú. El diseño anterior mantiene sus botones de navegación visibles.

## Referencia para restauración

El estado completo anterior al rediseño está conservado con la etiqueta Git `design-before-modernization-v44`, que apunta a `6a6422dfae29a8c8aa406a7b0067f4c2d5d9e51d`.

El selector basta para recuperar el diseño anterior, sin restaurar datos ni versiones de funciones. Para retirar definitivamente el rediseño, se puede revertir el commit de diseño y volver a publicar las dos ramas siguiendo el proceso habitual. No restaurar respaldos de inventario para cambiar el diseño.

## Verificación

Se revisaron las 12 secciones principales con datos de demostración, a 1440, 1024, 768, 390 y 320 píxeles. Se comprobaron el menú móvil, los formularios de producción y notas de venta, el cambio de diseño, la persistencia al recargar y la protección de acceso tras cerrar sesión. La prueba de interfaz no realizó escrituras de inventario.


## Efectos visuales (v46)

Al pie del menú, el botón **Efectos visuales: activados/desactivados** permite apagar todos los efectos adicionales. En móvil, abrir primero **Menú**. La elección se guarda por navegador bajo `alma-mia-effects`. El diseño anterior desactiva los efectos automáticamente y conserva la preferencia para regresar al diseño moderno.

El menú tiene un halo que sigue el cursor, un pequeño desplazamiento y respuesta del icono. Botones y tarjetas responden al cursor, y los botones al pulsarlos. Las secciones entran en 210 ms únicamente cuando cambia la sección: buscar, seleccionar o recibir actualizaciones no dispara esa transición. Los diálogos entran en 180 ms. Los mensajes de operaciones guardadas muestran una marca de confirmación; los botones de procesos activos tienen un indicador de carga. No se añaden retrasos a las operaciones.

La preferencia del sistema `prefers-reduced-motion: reduce` tiene prioridad: desactiva animaciones y transiciones, cancela las que estén en curso y marca el control como movimiento reducido. La actualización de esa preferencia se escucha en tiempo real. Los estados naranja y verde de pagos y producción conservan su significado. El indicador de carga gira solo durante un proceso activo.

Se verificaron el brillo al pasar el mouse, el cambio de secciones, la ausencia de animación al buscar, la persistencia del interruptor, cambios en vivo de movimiento reducido, el diseño anterior, confirmación tras guardar un movimiento en un backend simulado, el menú móvil y el indicador de carga.
