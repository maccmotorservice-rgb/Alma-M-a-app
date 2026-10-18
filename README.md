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

Cada movimiento de producción conserva el destino (stock o pedido) y, para pedidos, el ID y nombre del cliente. Se descuentan materias primas y se suman los perfumes terminados como antes; este destino identifica la producción en el historial y no reserva automáticamente unidades. Los clientes se incluyen en los respaldos y se guardan en el mismo navegador; los respaldos anteriores siguen siendo compatibles.
