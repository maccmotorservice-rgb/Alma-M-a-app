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

Solo los envases nuevos descuentan la receta correspondiente de materia prima y se suman al stock de perfumes listos. Repetir el mismo total no descuenta dos veces. Puedes reducir un avance para corregir errores; no se permite exceder lo planeado. Un fallo de insumos conserva el último avance válido. Al completar todas las filas el punto cambia a verde, con **Listo para entrega** para clientes o **Listo para anaquel** para stock; también se guarda fecha/hora de finalización. Los avances se incluyen en los respaldos.

Compatibilidad: los lotes antiguos sin campos de avance se presentan en naranja para revisión manual. Se conserva una marca de insumos y perfumes previamente contabilizados para evitar descontarlos o sumarlos de nuevo al registrar ese avance. Los lotes con avances manuales ya guardados los conservan.

### Corrección de lista visible y confirmación única
La lista por dictado se muestra desde los resultados parciales de voz, incluso si todavía falta identificar el perfume o la cantidad. Los resultados parciales se reemplazan en la misma fila y los fragmentos finales se unen hasta completar la instrucción. No se necesita agregar ni confirmar cada frase. Ante una pausa normal del navegador, se intenta reanudar la escucha automáticamente; errores de permisos, red o micrófono se muestran y detienen los reintentos.

Los controles de micrófono son compactos y los ejemplos/escritura manual están en un desplegable para no ocultar las listas en móvil. Las dos listas están visibles simultáneamente; la segunda muestra el saldo previsto cuando todas las filas son válidas. **Confirmar todo y actualizar inventario** realiza el guardado completo con un solo clic, sin diálogo adicional. Filas incompletas o repetidas bloquean el guardado y muestran el motivo.

Los lotes sin avance manual ya no se marcan verdes por el mero hecho de existir. Los registros antiguos sin campos de avance se revisan como pendientes, conservando la contabilidad de insumos previa para no duplicar descuentos.

## Persona de la sesión
El selector superior **¿Quién está en esta sesión?** permite elegir **Luis** o **Ximena**. La elección se conserva en sessionStorage para esa pestaña y es necesaria antes de guardar cambios nuevos. Cada nuevo movimiento guarda `performedBy` con el nombre seleccionado al guardar, incluidos todos los registros de una actualización por dictado. Cambiar la persona no cambia autores anteriores. Los lotes guardan `createdBy`, `updatedBy` y `completedBy`, y sus movimientos de avance conservan el autor individual. Los respaldos preservan la atribución; importar uno no reasigna sus movimientos a la persona de la sesión. El historial anterior sin autor muestra **Sin registrar**. Es un selector operativo, sin contraseñas ni autenticación.

## Corregir avances de lotes completos
En **Lotes y pedidos → Editar**, el número de envases hechos y la casilla permanecen editables aunque el lote esté listo. Introduce una cantidad entre cero y lo planeado, o desmarca **Hecho** para dejar esa presentación en cero. Cada corrección se guarda al salir del campo, registra fecha y persona de la sesión y recalcula el estado. Si quedan pendientes, vuelve a naranja y se elimina la fecha de finalización anterior; al completarlo nuevamente se registra una nueva.

Reducir un avance retira los envases corregidos del stock listo y restituye sus insumos. Para avances registrados desde esta versión, se conserva la distribución consumida del segundo frasco para restituirla al corregir; si el envase cambió o faltan datos históricos, se mantiene el total y el remanente vuelve al primer frasco. Las cantidades precontabilizadas de versiones antiguas no se contabilizan dos veces. No se permite retirar más perfumes de los disponibles; si ya fueron entregados, se muestra un error y no cambia el inventario. Las correcciones permanecen en Movimientos, con autor y folio.

## Numeración automática de frascos por dictado
En una misma lista, cada nueva mención de la misma materia prima se asigna al siguiente número: frasco 1, 2, 3, etc. Usar el nombre Alma Mía o el de inspiración identifica el mismo perfume. Los resultados parciales de una misma frase actualizan su fila sin aumentar el número. Si dices explícitamente “segundo frasco”, “tercer frasco” o “frasco 5”, se respeta ese número. Los números explícitos repetidos no sobrescriben otra fila: deben corregirse antes de guardar.

La numeración se hace sobre la lista de dictado actual; volver a inventariar una materia prima empieza por su primer frasco. Las capacidades de frascos ya existentes se reutilizan. Los nuevos frascos de esencia tienen capacidad inicial de 250 ml, editable en **Editar registro**; puedes dictar otra capacidad. Cada frasco guarda su propio saldo. Los adicionales se muestran en Materias primas, se incluyen en respaldos y se consumen en orden al registrar producción. Las correcciones de producción restituyen los saldos consumidos de los frascos adicionales registrados desde esta versión. Modificar el primer o segundo frasco manualmente conserva el tercero y los siguientes.

## Notas de venta

En **Notas de venta**, indica cliente y fecha, busca perfumes por nombre o referencia de inspiración y marca varios con las casillas de 50 o 100 ml. El catálogo está agrupado por categoría y permite seleccionar una categoría completa por presentación. La lista inferior muestra toda la selección y sus importes en tiempo real, con cantidades y precios editables. Las cantidades y precios se pueden editar; los conceptos personalizados permiten material promocional o reposiciones a precio cero.

El descuento es opcional y no puede superar el 30 %. Si está desactivado o es 0 %, el documento no incluye ninguna mención de descuento. Los importes se calculan en centavos.

**Revisar nota de venta** muestra el resumen y el detalle por categoría. Desde esa vista puedes guardar la nota y descargar el PDF. Las notas guardadas aparecen en el historial con su usuario y se incluyen en el respaldo y el inventario compartido de Supabase. No hace falta modificar las tablas existentes para esta función. Recarga la app en todos los dispositivos al actualizar.

La creación de una nota no registra una entrega ni descuenta stock; esas operaciones se registran en Stock. El PDF usa el logotipo de Alma Mía, resumen en primera página y detalle en las siguientes, con numeración automática.

Para reconstruir la biblioteca de PDF: `npm ci` y `npm run build:pdf`. El archivo generado se sirve localmente y no requiere un servicio externo para generar documentos.

### Edición y cancelación de notas

El historial tiene las pestañas **Vigentes** y **Canceladas**. Desde Vigentes puedes editar una nota, revisar su nuevo importe y guardar los cambios sin crear otra nota. Se conservan su identificador, fecha de creación y creador, y se registra la fecha y el usuario de la edición.

**Cancelar nota** solicita confirmación y exige un motivo de entre 3 y 240 caracteres, sin contar espacios externos. El motivo se muestra en Canceladas, en el detalle y en el PDF. La nota permanece en Canceladas con su detalle e importes, fecha y usuario de cancelación. El botón Cancelar nota está disponible en el historial y en el detalle de notas vigentes. Puede consultarse y descargarse; el PDF muestra CANCELADA en todas sus páginas. Las notas canceladas no se editan. La cancelación no modifica stock ni entregas.

Descargar el PDF de una nota nueva también guarda la nota automáticamente. Si se descarga mientras se edita, primero se guardan los cambios. Si otra sesión ya modificó o canceló la nota, la edición pendiente se rechaza para conservar la versión reciente.

### Crédito, contado y abonos

Notas de venta abre en el historial. **Generar nueva nota** muestra el formulario separado; **Volver a notas de venta** regresa al historial. Editar una nota abre el mismo formulario con sus datos.

Cada nota nueva permite seleccionar **Contado** (pagada al registrarse) o **Crédito**. Las notas de crédito con saldo muestran estado Pendiente en naranja y la acción Agregar abono. Al registrar el saldo restante cambian a Pagada en verde. Los abonos conservan importe, fecha del pago, fecha de registro y usuario, se sincronizan con el resto del inventario y aparecen en la vista de la nota y su PDF.

No se permiten importes negativos, cero, más de dos decimales ni abonos mayores que el saldo. Editar conserva los abonos; el nuevo total no puede quedar por debajo de lo ya abonado. Una nota con abonos conserva el tipo Crédito. Las canceladas conservan el historial de abonos para consulta, sin admitir nuevos ingresos ni generar devoluciones automáticas.

Las notas anteriores sin tipo de pago aparecen como Pago por definir. Se pueden editar para indicar Crédito o Contado; no se presume que hayan sido pagadas.

### Cancelar lotes y pedidos

En Lotes y pedidos, Cancelar lote o Cancelar pedido solicita un motivo obligatorio de 3 a 240 caracteres. La acción también está disponible desde la edición y el detalle. Los registros se conservan en la pestaña Cancelados con motivo, fecha y usuario; su detalle permanece disponible para consulta.

Cancelar detiene los pendientes y bloquea los cambios de avance. Conserva las unidades terminadas, el stock producido y los consumos reales de materia prima, sin devolver insumos automáticamente. El movimiento de cancelación registra cantidad cero y no altera saldos. Si otra sesión cambia el avance mientras el diálogo de cancelación está abierto, hay que revisar el registro actualizado antes de cancelar.

### Coincidencias por sonido en el dictado

El reconocimiento compara escritura y aproximaciones fonéticas de los nombres propios y sus referencias de inspiración. Reconoce variantes como Candy Cent / candi sent para Candy Scent y conserva la distinción entre Rose e Intense. Busca el nombre dentro de frases con palabras adicionales, sin exigir que toda la frase sea idéntica al catálogo. Los números de las referencias deben coincidir.

Cuando existen coincidencias, preselecciona automáticamente la primera sugerencia y conserva las demás en orden para corregirla. Las selecciones sugeridas se identifican en la lista de revisión. Vicente y otras palabras sin coincidencia no se convierten en perfumes. Una elección manual de materia prima se conserva durante la actualización de la frase en curso.

Las pruebas de navegador simulan transcripciones parciales y finales; la calidad de la transcripción del micrófono depende del navegador y su servicio de voz. Se mantiene la revisión de la lista completa antes de actualizar inventario.

### Pasar al siguiente registro sin detener el micrófono

Activa Iniciar dictado una vez. Di **Siguiente perfume** o **Siguiente materia prima** al terminar el nombre y las existencias del registro actual. Ambos comandos cierran ese registro y permiten continuar con otro manteniendo el micrófono activo, incluso si el navegador transcribe las palabras del comando por separado. También se admite el separador anterior Siguiente.

Ejemplo: “Sauvage, tres cuartos. Siguiente perfume. Candy Scent, dos cuartos. Siguiente materia prima. Alcohol, un galón”. Los comandos no crean filas vacías. Si falta una cantidad, el registro se conserva pendiente para corregirlo. Al terminar, revisa y confirma toda la lista una sola vez.

### Catálogo oficial corregido

Se compararon las 112 referencias con `Catalogo_Alma_Mia_2026_Corregido.pdf`. El cambio identificado es el número 94: Raspberry Amber Luxe pasa a Saffron 750, inspirado en Dubai Amber. Se conserva su ID, categoría, presentaciones y precios.

Al leer inventarios y respaldos, los nombres de materias primas y artículos de lotes se obtienen del catálogo vigente mediante sus IDs. La corrección conserva cantidades, consumos, avances e historial de movimientos. Las notas de venta emitidas mantienen su contenido histórico; las nuevas utilizan el catálogo corregido.

### Generar una nota desde un lote o pedido

En **Generar nueva nota**, selecciona un origen en **Generar desde un lote o pedido** y pulsa **Cargar perfumes del lote o pedido**. También puedes usar **Generar nota de venta** desde Lotes y pedidos, el detalle de una producción o su editor.

Se cargan todas las cantidades planificadas y sus presentaciones, incluso si la producción aún está pendiente. Se utilizan nombres y precios vigentes del catálogo. Los pedidos completan el cliente automáticamente; las notas de lotes de stock permiten indicar el comprador. Revisa cantidades, precios, descuento y tipo de pago antes de guardar.

La nota conserva el ID y número de su lote o pedido de origen, visibles en el historial, detalle y PDF. El vínculo se mantiene al editar. Crear la nota no cambia avances, stock ni consumos de producción. Los lotes y pedidos cancelados no se ofrecen como origen para notas nuevas.

### Distribución visual

Los botones de cada registro se agrupan con separación uniforme: la generación de notas ocupa una acción principal, edición y consulta se muestran juntas y la cancelación usa un estilo diferenciado. En celular y tablet, inventarios e historiales se distribuyen en tarjetas con campos etiquetados. La selección de perfumes de una nota también se adapta a tarjetas para editar cantidades y precios sin desplazar una tabla lateralmente.

Los diálogos y formularios muestran sus acciones al final del contenido para evitar que tapen información. El menú móvil muestra todas las secciones. La distribución se comprobó en 320, 390, 768, 1024 y 1440 px; las reglas compartidas están en `layout.css`.

### Una nota vigente por lote o pedido

Cada origen admite una única nota de venta vigente, tanto pendiente de pago como pagada. Después de guardarla, Generar nota de venta cambia a Ver nota de venta en el listado, detalle y editor de producción. Ese origen deja de aparecer en el selector de nuevas notas.

Cancelar la nota libera el origen para generar una nueva, conservando la cancelada en su historial. La regla se verifica al preparar el formulario y al guardar; la revisión compartida evita que dos sesiones guarden simultáneamente una nota nueva para el mismo lote. Las notas duplicadas que ya existían se conservan para revisión y cancelación. Mientras quede alguna vigente, no se permite crear otra.

### Cancelaciones y resumen de cobros

Lotes, pedidos y notas de venta ofrecen cinco motivos de cancelación: prueba, cambios del cliente, garantía por productos incorrectos, garantía por productos dañados y Otro. Solo Otro solicita un texto de 5 a 240 caracteres. El motivo, fecha y usuario quedan en el historial de canceladas. Se conservan movimientos y producción ya registrados.

Resumen muestra Cuentas por cobrar (saldo de notas de crédito vigentes) y Total cobrado (notas de contado y abonos de crédito vigentes). Las notas canceladas se excluyen. Las notas antiguas sin tipo de pago se señalan para revisión y no se consideran cobradas.

### Abonos con comprobantes

Transferencia exige imagen JPG, PNG, WebP o PDF de hasta 8 MB; Efectivo permite un recordatorio opcional sin archivo. Los archivos se guardan en Supabase Storage privado y se consultan desde Ver comprobante. Requiere ejecutar `supabase/03-comprobantes.sql`; consulta `supabase/LEEME.md`. El inventario compartido conserva únicamente metadatos del archivo, sin insertar imágenes en el JSON.

### Guía olfativa oficial

El catálogo incorpora familia, descripción y notas de las 112 fragancias de `Alma_Mia_2026_Guia_Olfativa.pdf`, manteniendo IDs, nombres, precios y categorías. Las nueve referencias cuyas notas se presentan juntas en la guía conservan ese formato, sin inventar etapas. La referencia completa de la guía se muestra aparte del nombre comercial del catálogo.

Los botones Todos, Mujer, Mujer nicho, Hombre, Hombre nicho y Unisex filtran sin duplicar fragancias. Búsqueda avanzada agrupa por familia olfativa, permite filtrar por aroma y buscar también descripciones y notas. La vista normal busca por número, nombre e inspiración.

### Reporte de reposición de materias primas

En Materias primas, Ver reporte abre una vista de todo el inventario, independiente de los filtros del listado. Insumos faltantes muestra existencias en cero; Insumos por terminar incluye las esencias cuando todos sus frascos están a 1/4 de su capacidad o menos, con existencias totales positivas. Dos frascos a 1/4 se incluyen; un frasco por encima de 1/4 excluye esa esencia. El primer frasco tiene capacidad de 250 ml; los adicionales usan su capacidad registrada. Alcohol y galaxolide conservan el mínimo configurado. Las tarjetas muestran existencias, desglose por frasco y criterio de aviso. Permiten actualizar información y, para alcohol y galaxolide, modificar el mínimo. El reporte se recalcula con los cambios del inventario compartido.

En Ver reporte, Descargar PDF genera un documento sencillo con fecha de Guatemala, dos listas (faltantes y por terminar), nombre e inspiración, y existencias con desglose por frasco. Usa los saldos actuales y la misma regla de cuartos del reporte. Incluye mensajes cuando una lista está vacía y numeración de páginas si se extiende. La descarga no modifica el inventario.

### Marca y género de las referencias

Las 112 referencias muestran el nombre original, la marca o casa de la guía oficial y su género (Dama, Caballero o Unisex). Se conserva el nombre original como alias para dictado. Las búsquedas en catálogo, materias primas, producción y selección de notas permiten combinar marca, perfume y género en cualquier orden; Hombre y Mujer también encuentran Caballero y Dama. Los nombres y precios de Alma Mía permanecen iguales. Las nuevas notas incluyen la referencia completa; las notas emitidas conservan su texto histórico y pueden seguir editándose.

### Eliminar stock

Cada perfume y presentación disponible en Stock permite Eliminar stock. Se puede retirar una cantidad parcial o todas las unidades y se exige elegir Esto fue una prueba u Otro. Otro requiere una explicación de 5 a 240 caracteres. La operación no admite retirar más existencias de las disponibles y comprueba que el stock no cambió desde que se abrió el formulario. Conserva un movimiento negativo con motivo, fecha y usuario. No altera la producción ni devuelve materias primas.

### Notas históricas y originales privados

La importación de ventas de 2026 se abre con un enlace privado cuyo fragmento contiene la clave del paquete cifrado `assets/sales-history-2026.enc`. La clave no se guarda en el repositorio ni se envía al servidor estático; la app la conserva temporalmente en la sesión y la elimina al terminar. El paquete contiene las notas conciliadas y sus PDF originales. No publiques la clave ni versiones descifradas del paquete.

Desde una sesión Supabase conectada, Cargar mis 33 notas pagadas sube los PDF al depósito privado existente y guarda las notas como pagadas. Se conserva la fecha, precio, descuento y nombre histórico del documento, además del ID del perfume vigente cuando se conoce. La referencia original determina el perfume; las discrepancias confirmadas por el propietario se resuelven en el paquete. Los productos históricos fuera del catálogo se muestran aparte en los rankings. Los probadores de 5 ml y material promocional son conceptos diferenciados.

La carga conserva el inventario y los movimientos. Evita duplicados por hash del original o por cliente, fecha, total y composición de la nota. Puede vincular un original a una nota coincidente ya pagada; si encuentra una coincidente pendiente o cancelada solicita revisión. Reintentar después de una carga completa no duplica notas ni vuelve a subir PDF. Los originales se consultan mediante enlaces temporales de Supabase y se pueden descargar íntegros. Editar una nota conserva su original y permite descargar una versión actualizada por separado.

Los PDF incluyen casos con regalos y garantías a precio cero. El total de artículos incluye los probadores sin cargo que algunos documentos cuentan aparte del total de perfumes. El PDF original permanece intacto. Los respaldos JSON conservan las referencias a los originales, por lo que también se debe conservar Storage.

### Ventas anuales y desempeño

Resumen muestra ingresos por ventas, ingresos cobrados, reposición estimada y ventas menos reposición del año. Ver más abre un selector de año, el desglose de los doce meses, productos más vendidos y productos del catálogo sin ventas registradas. Las notas canceladas se excluyen. Las ventas usan fecha de nota e importe después del descuento; los abonos usan su fecha de pago. Las notas históricas declaradas pagadas se atribuyen al mes de su nota porque los PDF no indican las fechas reales de cobro.

La reposición se estima a $140 por unidad de perfume de 50 o 100 ml, incluso regalos y garantías. No se asigna un costo a probadores de 5 ml ni banners. El resultado mostrado no es utilidad neta: faltan otros gastos e impuestos. Los rankings cuentan como vendidas las unidades con importe positivo, separan entregas sin cargo y distribuyen descuentos por partida con redondeo que conserva el total de cada nota.

### Acceso obligatorio (versión 38)

La app abre únicamente la pantalla de acceso hasta que Supabase confirma la sesión, la membresía autorizada y la lectura del inventario compartido. La configuración pública del proyecto se incluye por defecto para que cada dispositivo solo necesite correo y contraseña. No hay modo local de operación sin iniciar sesión ni selección manual de autor. El cierre de sesión y los eventos de sesión terminada ocultan contenido, cierran diálogos y limpian cachés del inventario compartido; una desconexión bloquea las vistas hasta recuperar la conexión. La seguridad de la base de datos y Storage sigue dependiendo de las políticas RLS del proyecto, no del bloqueo visual.

GitHub Pages continúa publicando el código y el catálogo estático. Este cambio restringe la interfaz y los datos privados; no convierte el alojamiento estático ni el repositorio en privados. No exige un servicio de pago. El uso continúa sujeto a los límites del plan gratuito de Supabase y GitHub.

Se retiró el paquete cifrado de importación de la distribución actual y su pantalla de carga. Los originales ya cargados continúan en Storage privado. Las versiones anteriores del paquete pueden seguir existiendo en el historial público de Git o en copias; retirar el archivo actual no revoca un enlace de descifrado que se hubiera compartido anteriormente. Se conserva fuera del repositorio la carga preparada para recuperar una importación pendiente por un mecanismo privado.

### Escanear stock con cámara (versión 39)

Stock → Escanear stock permite fotografiar una etiqueta a la vez desde la cámara trasera o el selector de fotos. La lectura usa Tesseract.js y su modelo local: las imágenes no se suben a Storage ni a una API de IA. La primera lectura descarga los archivos públicos del lector y puede tardar unos segundos. Los recursos y licencias se distribuyen en `assets/ocr`; se reconstruyen con `npm ci` y `npm run build:ocr` a partir de versiones fijadas en el lockfile.

El encuadre central incluye el nombre completo y la capacidad, reduciendo la interferencia de otras cajas. Para una imagen ya recortada se puede seleccionar Foto completa. El lector busca los nombres Alma Mía y las referencias del catálogo y admite 50 o 100 ml. Las variantes ambiguas, varias capacidades o texto desconocido quedan pendientes de corrección. No reconoce un perfume solo por la forma del envase: requiere texto visible, enfoque e iluminación. El OCR puede equivocarse y siempre hay revisión antes de guardar.

Cada lectura añade un registro editable con perfume, capacidad y cantidad. El límite es de 20 unidades y 20 etiquetas por carga; las presentaciones repetidas se agrupan al guardar. Revisar lista completa no modifica existencias. Solo Confirmar e ingresar al stock aplica todos los registros de forma conjunta, con trazabilidad del usuario autorizado. El ingreso suma producto ya preparado y no consume insumos ni modifica avances de lotes. Los borradores de escaneo permanecen solo en memoria del dispositivo; cerrar la sesión los descarta.

La cámara se solicita solo al pulsar Iniciar cámara y se detiene al salir, ocultar la app, revisar la lista, alcanzar el límite o perder la sesión. Si se deniega el permiso o el equipo no tiene cámara, se puede utilizar una foto. La app publicada usa HTTPS, requerido por los navegadores para acceso a cámara. No se incorpora un servicio de pago.

### Corrección de lectura de etiquetas (versión 40)

El lector conserva por defecto la foto completa para no recortar los ml del borde inferior. Si la primera lectura no identifica perfume y capacidad, reintenta automáticamente con contraste local para texto claro sobre color y con una zona inferior ampliada. Combina el nombre y los ml de las lecturas sin elegir una capacidad si los resultados se contradicen. Los fragmentos de nombre con al menos dos palabras distintivas pueden proponer un único perfume como coincidencia aproximada; siguen sujetos a revisión.

Se solicita enfoque continuo cuando la cámara lo admite y se utiliza captura de foto de mayor resolución en navegadores con ImageCapture; los demás mantienen la captura desde video. Ver foto capturada permite revisar la imagen realmente procesada. Solo permanece en memoria y su URL se libera al sustituirla o descartar la lista. El ingreso continúa requiriendo revisión y confirmación, sin enviar imágenes a servicios externos.
