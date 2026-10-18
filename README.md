# Alma Mía · Inventario
Aplicación web en español, adaptable a móvil, con el logotipo original y las 112 fragancias del catálogo oficial 2026. Precios en MXN.

## Iniciar
Requiere Node.js 20 o posterior. No requiere dependencias externas ni claves.

```sh
cd /workspace/Alma-M-a-app
npm start
```

Puerto 3000; se puede cambiar mediante `PORT`. Para comprobar el inventario: `npm test`.

## Primer uso
1. En **Materias primas**, usa **Actualizar información** para indicar lo que queda. Las esencias se registran en cuartos de un frasco de 250 ml (1/4 = 62.5 ml), el alcohol en galones de 4 litros y el galaxolide en ml. Actualizar reemplaza el saldo; registrar una entrada suma una compra. Ajusta los mínimos de reabastecimiento según tu operación.
2. En **Listos para entregar**, usa **Ingresar stock existente** para perfumes ya preparados. Permite seleccionar varios perfumes y no descuenta insumos.
3. Usa **Preparar lote** para descontar esencia, alcohol y galaxolide y sumar frascos terminados. Busca por el nombre Alma Mía o por el de inspiración y marca varios perfumes en **Perfumes de 100 ml** y **Perfumes de 50 ml**, con cantidad independiente para cada uno. La selección se conserva al cambiar la búsqueda. El guardado es completo: si falta materia prima para alguno, no se registra ninguno. La fórmula de 100 ml es 30 ml de esencia, 2 ml de galaxolide y 68 ml de alcohol. Para 50 ml se usa exactamente la mitad: 15 ml de esencia, 1 ml de galaxolide y 34 ml de alcohol. No hay campos de porcentajes.
4. Registra las entregas para descontar frascos disponibles.
5. Exporta respaldos JSON regularmente. La importación reemplaza los datos locales tras confirmación.

Los inventarios empiezan en cero. Los datos se guardan en localStorage del navegador: no se sincronizan entre dispositivos o usuarios. Usar el mismo navegador y dirección conserva los datos; borrar datos del sitio los elimina. Los respaldos contienen el inventario y su historial. No hay cuentas ni base de datos remota. No expongas esta versión directamente a Internet como sistema multiusuario.

El catálogo es referencia comercial; no representa tus existencias. Los logotipos se extrajeron del PDF original proporcionado. Las marcas mencionadas son referencias olfativas.

## Publicación gratuita en GitHub Pages
Los recursos usan rutas relativas para funcionar en /Alma-M-a-app/.
En GitHub → Settings → Pages, selecciona Deploy from a branch, rama gh-pages y carpeta / (root). No se necesita un servicio de pago. La rama gh-pages contiene únicamente los archivos públicos.
Dirección prevista: https://maccmotorservice-rgb.github.io/Alma-M-a-app/
El inventario sigue guardándose solo en cada navegador; no se sube al repositorio.

## Frascos y colecciones
En **Materias primas → Actualizar información**, activa **Segundo frasco**, introduce su capacidad y cuánto queda. En las esencias, cada cuarto del segundo frasco equivale a su propia capacidad dividida entre cuatro. El primero sigue siendo de 250 ml. Los totales incluyen ambos frascos; la preparación y las salidas consumen primero el primer frasco y luego el segundo. Los respaldos conservan estos datos, y los respaldos anteriores siguen siendo compatibles.

Las esencias, el catálogo y las listas de lotes se organizan en Mujer, Hombre, Unisex, Nicho · Unisex, Nicho · Hombre y Nicho · Mujer, según el catálogo oficial. Alcohol y galaxolide aparecen en Bases y fijadores. La búsqueda sigue funcionando por ambos nombres.

## Tabla de selecciones del lote
Debajo de las listas de búsqueda, **Tus selecciones** se actualiza al marcar o desmarcar un perfume. Agrupa en Dama, Caballero y Unisex (incluye las fragancias de nicho de cada género), muestra ambas presentaciones y permite cambiar el número de envases o eliminar cada selección. Los cambios se sincronizan con las casillas y cantidades de la lista superior, incluso si la búsqueda actual oculta un perfume. El resumen muestra el consumo total de esencia, galaxolide y alcohol antes de guardar.

## Producción para pedidos o stock
En el resumen, pulsa **Iniciar producción**. Elige **Generar stock · Lotes disponibles** o **Pedido de un cliente**. Para pedidos debes seleccionar un cliente registrado; **Registrar nuevo cliente** permite guardar nombre y teléfono opcional sin perder la selección del lote. La sección **Clientes** muestra y busca los clientes guardados y permite registrar otros.

Cada movimiento de producción conserva el destino (stock o pedido) y, para pedidos, el ID y nombre del cliente. Las materias primas se descuentan y los perfumes terminados se suman únicamente al registrar envases hechos en Editar; el destino identifica la producción en el historial y no reserva automáticamente unidades. Los clientes se incluyen en los respaldos y se guardan en el mismo navegador; los respaldos anteriores siguen siendo compatibles.

## Inventario por dictado
Abre **Inventario por dictado**, o **Materias primas → Hacer inventario por dictado**. Pulsa **Iniciar dictado**, permite el micrófono y di una materia prima por frase, usando el nombre Alma Mía o el de inspiración. Por ejemplo: “Sauvage, primer frasco, tres cuartos”, “Sauvage, segundo frasco de 500 ml, la mitad”, “Alcohol, dos galones” o “Galaxolide, ciento cincuenta mililitros”. También puedes escribir instrucciones; separa varios registros con punto y coma o saltos de línea.

La lista se actualiza al recibir frases definitivas. Revisa la materia prima, el frasco, la cantidad, la unidad y la capacidad del segundo frasco; puedes editarlos o eliminar filas. Los nombres no identificados quedan pendientes de selección manual. Las filas repetidas para el mismo frasco deben corregirse antes de guardar. La lista visible previsualiza los cambios y **Confirmar todo y actualizar inventario** reemplaza los saldos de los frascos incluidos; conserva los otros frascos y materias primas. Si una fila es inválida, no guarda ninguna. Los borradores se conservan al navegar entre secciones durante la sesión, pero no tras recargar.

El dictado usa SpeechRecognition/webkitSpeechRecognition del navegador en es-MX, sin claves ni servicios de pago contratados por la app. Necesita HTTPS (GitHub Pages) o localhost, micrófono autorizado y un navegador compatible; el proveedor del navegador puede procesar el audio en sus servidores. La app no guarda grabaciones. Puede depender de Internet y del dispositivo. El micrófono se detiene al cambiar de sección o al pasar la página a segundo plano. Si el navegador detiene la escucha tras una pausa, pulsa Iniciar dictado nuevamente. Cuando no hay reconocimiento de voz disponible, se mantiene la captura por texto y la revisión editable.

Validación: pruebas de interpretación y saldos, interfaz en móvil/escritorio y controlador de voz con eventos simulados. La captura real y el servicio de reconocimiento deben comprobarse en el dispositivo del usuario.

## Vista previa y archivo de lotes
**Preparar perfumes seleccionados** abre una lista oficial con el logotipo, folio, destino, cliente si corresponde, perfumes agrupados por Dama/Caballero/Unisex, presentaciones, cantidades y consumo de materias primas. En este paso no se guarda producción ni se cambia inventario. **Volver a editar** o cerrar la vista previa conserva la selección.

**Confirmar** guarda la lista planeada con cero envases hechos y estado En producción, sin descontar insumos ni sumar stock terminado. En **Editar**, cada avance comprueba las existencias y guarda en una sola operación el descuento de insumos, el stock terminado y el progreso. Si falta materia prima o falla el almacenamiento, ese avance no se guarda. La confirmación repetida de una lista está bloqueada. La fecha y hora definitivas corresponden a la confirmación; se almacenan en UTC y se muestran en la zona horaria del navegador.

En **Lotes y pedidos**, busca por folio, cliente, perfume o fecha, filtra pedidos/stock y pulsa **Ver lista** para reabrir el documento confirmado. Las listas y sus fechas se conservan al recargar y se incluyen en los respaldos. Solo hay listas completas para producciones confirmadas desde esta actualización; las anteriores permanecen en Movimientos, sin inventar agrupaciones históricas. Los datos siguen guardándose en este navegador.

### Coincidencias aproximadas del dictado
El nombre se compara con los nombres Alma Mía y de inspiración, normalizando acentos, puntuación y espacios. Se toleran errores cercanos de transcripción como “savage” → Sauvage y “santa el 33” → Santal 33. Se prioriza la coincidencia completa; las aproximadas solo se seleccionan si destacan claramente sobre otras opciones. Se conservan los números de las fragancias para evitar confundir variantes y se distingue Sauvage Elixir. Cuando hay ambigüedad, no se selecciona automáticamente: las sugerencias aparecen primero en la lista de materias primas. Se muestra la transcripción original y un aviso si se corrigió el nombre por similitud. La revisión y confirmación antes de actualizar existencias siguen siendo obligatorias.

### Lista continua y dos órdenes
El dictado acumula frases en una sola lista sin confirmar cada registro. Se muestran simultáneamente **Lista por orden de mención** (desde la primera hasta la más reciente) y **Lista por Hombre, Dama y Unisex** (con Bases y fijadores y Por identificar cuando corresponde). Ambas vistas usan las mismas filas editables; ordenar no duplica ni cambia el orden original. Los números de mención se mantienen al eliminar otras filas.

**Previsualizar inventario** detiene el micrófono y muestra el inventario completo por categorías, con la materia prima, número de mención, frasco, capacidad, cantidad y saldo anterior/nuevo en ml. No guarda cambios. **Volver a editar** conserva toda la lista. Solo **Aceptar y actualizar inventario** guarda todas las filas en una operación; un error no deja cambios parciales. Los registros no incluidos conservan sus saldos.

## Seguimiento de producción
Confirmar la lista crea un lote/pedido **En producción** (punto naranja), aunque aún no haya insumos disponibles. Abre **Lotes y pedidos → Editar** para consultar Todos, Pendientes y Hechos. Introduce el **total acumulado de envases hechos** de cada presentación; al terminar la edición del campo se guarda ese avance. También puedes marcar **Completar pendientes** para terminar todos los envases restantes de ese perfume.

Solo los envases nuevos descuentan la receta correspondiente de materia prima y se suman al stock de perfumes listos. Repetir el mismo total no descuenta dos veces; no se permite reducir un avance registrado ni exceder lo planeado. Un fallo de insumos conserva el último avance válido. Al completar todas las filas el punto cambia a verde, con **Listo para entrega** para clientes o **Listo para anaquel** para stock; también se guarda fecha/hora de finalización. Los avances se incluyen en los respaldos.

Compatibilidad: los lotes antiguos sin campos de avance se presentan en naranja para revisión manual. Se conserva una marca de insumos y perfumes previamente contabilizados para evitar descontarlos o sumarlos de nuevo al registrar ese avance. Los lotes con avances manuales ya guardados los conservan.

### Corrección de lista visible y confirmación única
La lista por dictado se muestra desde los resultados parciales de voz, incluso si todavía falta identificar el perfume o la cantidad. Los resultados parciales se reemplazan en la misma fila y los fragmentos finales se unen hasta completar la instrucción. No se necesita agregar ni confirmar cada frase. Ante una pausa normal del navegador, se intenta reanudar la escucha automáticamente; errores de permisos, red o micrófono se muestran y detienen los reintentos.

Los controles de micrófono son compactos y los ejemplos/escritura manual están en un desplegable para no ocultar las listas en móvil. Las dos listas están visibles simultáneamente; la segunda muestra el saldo previsto cuando todas las filas son válidas. **Confirmar todo y actualizar inventario** realiza el guardado completo con un solo clic, sin diálogo adicional. Filas incompletas o repetidas bloquean el guardado y muestran el motivo.

Los lotes sin avance manual ya no se marcan verdes por el mero hecho de existir. Los registros antiguos sin campos de avance se revisan como pendientes, conservando la contabilidad de insumos previa para no duplicar descuentos.

## Persona de la sesión
El selector superior **¿Quién está en esta sesión?** permite elegir **Luis** o **Ximena**. La elección se conserva en sessionStorage para esa pestaña y es necesaria antes de guardar cambios nuevos. Cada nuevo movimiento guarda `performedBy` con el nombre seleccionado al guardar, incluidos todos los registros de una actualización por dictado. Cambiar la persona no cambia autores anteriores. Los lotes guardan `createdBy`, `updatedBy` y `completedBy`, y sus movimientos de avance conservan el autor individual. Los respaldos preservan la atribución; importar uno no reasigna sus movimientos a la persona de la sesión. El historial anterior sin autor muestra **Sin registrar**. Es un selector operativo, sin contraseñas ni autenticación.
