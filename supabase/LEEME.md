# Conectar Alma Mía entre computadora y celular

Usa un proyecto Supabase con plan Free. No conectes el repositorio para este proceso.

1. Ejecuta `01-configurar.sql` completo en SQL Editor. Crea las tablas, activa RLS y permite guardar únicamente a miembros autorizados. Se puede repetir sin borrar el inventario.
2. En Authentication → Users → Add user, crea dos usuarios: Luis y Ximena, con correos distintos y contraseñas propias. Activa Auto Confirm User si aparece.
3. Abre `02-miembros.sql`, sustituye los correos de ejemplo y ejecútalo. La consulta final debe mostrar Luis y Ximena.
4. En Settings → API Keys copia la Publishable key (`sb_publishable_…`). En Data API copia la Project URL. Nunca uses una clave secret ni service_role.
5. En la computadora y navegador donde está el inventario completo, abre Alma Mía. Primero pulsa Exportar respaldo y guarda el archivo.
6. Abre Conexión. Pega Project URL y clave publicable. Pulsa Conectar Supabase. Inicia sesión con uno de los usuarios que creaste.
7. Si la nube está vacía, pulsa Subir este inventario a la nube. Revisa que sea el dispositivo correcto antes de confirmar. Solo se permite subir inicialmente si aún no hay inventario compartido.
8. En el celular abre la misma app, entra a Conexión, coloca la misma URL y clave publicable e inicia sesión. Pulsa Abrir inventario compartido. No importes una copia vieja sobre la nube.

Una vez conectados, los cambios se guardan en Supabase. Se reciben eventos en tiempo real y se comprueban cambios cada cuatro segundos con la app visible. Si dos personas intentan modificar simultáneamente una versión antigua, se conserva el primer cambio, se carga la versión reciente y la segunda persona debe revisar y repetir su acción. Los cambios no confirmados pueden descargarse desde Conexión para revisarlos.

Sin conexión se bloquea el guardado hasta recuperar acceso. No hay una cola de cambios sin conexión. No borres los datos del navegador antes de subir o respaldar tu inventario. La app conserva una copia local anterior y permite descargarla desde Conexión.

El nombre de cada movimiento lo determina la cuenta autorizada, Luis o Ximena. Usa contraseñas distintas. Los correos y contraseñas se introducen únicamente en el formulario de inicio de sesión de la app; no se guardan en el repositorio.

La conexión real requiere completar estos pasos y comprobar un cambio desde ambos dispositivos. El plan Free tiene límites y condiciones de Supabase; no hace falta contratar un plan de pago para esta configuración.

## Comprobantes de abonos

Ejecuta `03-comprobantes.sql` en SQL Editor del mismo proyecto y pulsa Run. `Success. No rows returned` indica que terminó. Puede repetirse sin borrar comprobantes. Crea el depósito privado `payment-evidence`: imágenes JPG, PNG, WebP o PDF de hasta 8 MB. Solo los miembros autorizados pueden consultar archivos; cada usuario sube dentro de su propia carpeta.

Al agregar un abono, elige Efectivo o Transferencia. Efectivo permite un recordatorio opcional. Transferencia exige adjuntar un comprobante antes de guardar. El historial muestra Ver comprobante; se genera un enlace temporal de consulta. No compartas ese enlace con personas ajenas.

El respaldo JSON conserva las referencias a los archivos, no sus contenidos. Conserva también el depósito de Storage: mover el respaldo a otro proyecto no copia los comprobantes. Las notas y abonos anteriores permanecen; no se inventan medios de pago ni comprobantes retroactivos.

Los PDF originales de notas históricas utilizan el mismo almacenamiento privado configurado por `03-comprobantes.sql`; no hace falta ejecutar otra migración. La carga debe realizarse desde la cuenta autorizada de la app, mediante el enlace privado de importación. Al terminar, originales y notas quedan disponibles para los demás miembros conectados sin volver a usar ese enlace.
