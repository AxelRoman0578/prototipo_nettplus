# Nettplus Asistencia

Prototipo funcional de control de asistencia y preparación de reportes para nómina. Incluye una interfaz React y un backend local ligero con Node.js y SQLite. No calcula salarios ni realiza pagos.

La interfaz conserva la estructura del dashboard de referencia e incorpora el logo original y los colores del manual: azul `#233A84`, verde `#73B542` y amarillo `#FDEA18`. El logo se sirve sin modificaciones. La interfaz utiliza Inter como fuente local disponible; no se distribuyen archivos de las fuentes comerciales del manual.

## Ejecutar en VS Code

Requiere Node.js **22.13 o posterior** y npm. Se comprobó con Node 22.23.4. SQLite viene integrado en Node; no necesitas instalar un servidor de base de datos ni Docker. Node 22 puede mostrar un aviso de característica experimental para SQLite.

Desde la terminal PowerShell de esta carpeta:

```powershell
npm install
```

```powershell
npm run dev
```

Este comando inicia la API local y Vite. Abre [Nettplus](http://localhost:5173). El servidor escucha únicamente en `127.0.0.1:3001`; el navegador accede mediante el proxy de Vite. Si PowerShell bloquea `npm.ps1`, usa `npm.cmd` en los mismos comandos.

Otros comandos:

```powershell
npm run build
```

```powershell
npm test
```

```powershell
npm run preview
```

`preview` sirve la interfaz compilada. Para usar el acceso local junto con ese comando, inicia la API en otra terminal:

```powershell
npm run server
```

Para trabajar únicamente con la demo del navegador:

```powershell
npm run dev:demo
```

## Inicio de sesión

La pantalla de acceso distingue dos modalidades:

- **Servidor local:** correo y contraseña, sesiones de ocho horas mediante cookie HttpOnly/SameSite, validación de permisos en la API y persistencia en SQLite.
- **Demo administrador / demo consulta:** entrada explícita al prototipo con IndexedDB. No usa autenticación de servidor y sus datos se mantienen separados de SQLite.

Al crear una base local por primera vez se generan estas cuentas de prueba:

| Rol           | Correo                  | Contraseña inicial  |
| ------------- | ----------------------- | ------------------- |
| Administrador | `admin@nettplus.local`  | `NettplusDemo2026!` |
| Viewer        | `viewer@nettplus.local` | `ConsultaDemo2026!` |

También puedes seleccionarlas en **Accesos iniciales de prueba**. Son credenciales públicas del prototipo. Antes de usar información laboral real, asigna contraseñas propias desde **Usuarios y permisos**, o configura las cuentas iniciales mediante `.env` antes de crear la base.

El administrador puede crear y editar usuarios, asignar roles, desactivar cuentas y actualizar contraseñas. Cambiar contraseña o rol revoca las sesiones de esa cuenta. No se puede desactivar ni quitar el rol de la propia sesión administradora. Las contraseñas se almacenan con scrypt y una sal aleatoria; los tokens de sesión también se guardan como hash.

Para configurar el entorno, copia `.env.example` como `.env` y completa las opciones necesarias. Las variables `NETTPLUS_ADMIN_EMAIL`, `NETTPLUS_ADMIN_PASSWORD`, `NETTPLUS_VIEWER_EMAIL` y `NETTPLUS_VIEWER_PASSWORD` se aplican **solo al crear una base nueva**. No sobrescriben cuentas existentes. No subas `.env` ni la carpeta `data/` a un repositorio.

## Funciones

- Dashboard con indicadores calculados, filtros compartidos, comparaciones mensuales y gráficos interactivos ECharts. Un clic en una barra diaria abre el reporte correspondiente; las leyendas y el zoom permiten explorar las series.
- Importación real de `.xlsx`: reconocimiento de encabezados, hoja y fila configurables, vista previa, correspondencia de columnas para marcaciones, validación, duplicados e incidencias exportables. En modo local la API vuelve a leer y validar el archivo original antes de guardarlo.
- Directorio con búsqueda, estado, departamento, periodo, paginación e historial individual. Se conservan archivo y fila de origen.
- Reportes diarios y consolidados mensuales exportables a Excel/PDF con los filtros activos y todos los resultados, independientemente de la página visible.
- Novedades y horas con consulta, filtros y exportación de permisos registrados y horas informadas por el archivo.
- Usuarios, configuración de parámetros y auditoría para administradores. El viewer consulta y exporta; la API devuelve 403 ante intentos de modificación, aunque se invoque directamente.
- Persistencia, confirmación de operaciones importantes y avisos de error. La API rechaza cambios basados en una revisión obsoleta, actualiza la vista y solicita revisar antes de reintentar.

La base inicial contiene personas y registros ficticios. El badge distingue la base demo, los datos importados y las mezclas. Los datos de los Excel de referencia no se incorporan automáticamente al proyecto ni a la base local; solo se conserva el logo entre los nuevos adjuntos.

## Tres formatos de Excel

El importador identifica la fila de encabezados situada después del título de los archivos proporcionados. Puedes cambiar el tipo de reporte y revisar la selección antes de confirmar.

| Tipo                 | Estructura admitida                                                                                                           | Tratamiento                                                                                                                                                                                     |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Marcaciones          | ID del Empleado, Nombres, Departamento, Fecha, Hora y Tipo de Marcación; también fecha/hora juntas o entrada/salida separadas | Usa el tipo de marcación para distinguir entrada/salida. La columna adicional Tipo del biométrico no se interpreta como entrada/salida.                                                         |
| Permisos             | ID del Empleado, Nombres, Apellidos, Departamento, Hora Entrada, Hora Salida, Código de pago y Estado de aprobación           | Guarda fechas, categoría y aprobación del origen. Omite motivos, comentarios personales y aprobadores. No crea marcaciones ni justifica ausencias automáticamente.                              |
| Consolidado de horas | ID, Nombres, Apellidos, Departamento, Horas Suplementarias, Horas Extras y Horas Nocturnas                                    | Detecta el mes en el título/hoja o permite seleccionarlo. Conserva duraciones de Excel, incluidas las mayores de 24 horas. Un campo vacío queda como No informado. No calcula ni aprueba horas. |

Para probarlos, descarga **Excel de ejemplo** desde Importaciones. También está en `public/ejemplos/Nettplus_Ejemplo.xlsx`. Contiene cuatro hojas ficticias: entrada/salida, eventos individuales, permisos y consolidado de octubre de 2026.

En la primera hoja hay tres filas válidas (una incompleta), una duplicada y dos rechazadas. Confirma, consulta los resultados y vuelve a cargar el mismo archivo para comprobar la deduplicación. Cada confirmación importa una hoja; vuelve a seleccionar el archivo para procesar otra.

Fechas admitidas: `AAAA-MM-DD`, `DD/MM/AAAA` y `DD-MM-AAAA`, además de fechas nativas de Excel. Las horas de asistencia admiten `HH:MM` y `HH:MM:SS`; los turnos nocturnos requieren eventos con sus fechas individuales. Los eventos sin tipo se conservan sin clasificar. No se inventan salidas. Se conservan códigos de texto y rellenos numéricos como `0000` cuando están presentes en el archivo; no se pueden recuperar ceros ya perdidos en el origen.

Solo `.xlsx`, inicialmente hasta 20 MB, configurable entre 1 y 50 MB. Máximo 100.000 filas de datos y 150 columnas por hoja. No se ejecutan fórmulas ni se importan sus resultados. Los códigos con nombres o departamentos contradictorios requieren revisión. Los permisos y consolidados pueden consultarse aunque todavía no exista un colaborador asociado en el directorio. Un consolidado ya registrado para un ID/mes se conserva, sin sobrescribirlo silenciosamente.

## Indicadores y límites

- **Colaboradores:** personas del directorio que cumplen los filtros.
- **Asistencias:** pares únicos colaborador/fecha con al menos una marcación, incluso incompleta.
- **Puntualidad DEMO:** días dentro de tolerancia / días con entrada clasificada. Usa la primera entrada explícita. Parámetros iniciales ficticios: 08:30 y 10 minutos.
- **Ausencias estimadas DEMO:** días configurados sin marcación, dentro de la vigencia laboral informada y de la cobertura entre la primera y última fecha importada. Sin inicio laboral o reglas habilitadas, aparece Pendiente. Esa cobertura no demuestra que el origen esté completo; la estimación requiere revisión humana.
- **Incompletos:** días sin entrada o sin salida clasificada. No se reconstruyen turnos entre fechas.

Horarios, turnos, feriados, tolerancias, justificaciones, fórmulas oficiales y procedimiento de correcciones siguen pendientes de validación. Los permisos importados se muestran como contexto y las horas del consolidado se identifican como información de origen. No sustituyen una aprobación de Nettplus. No se implementa un portal de solicitudes para empleados ni conexión directa con ZKBioTime.

Las fechas de asistencia son fechas civiles; la auditoría se presenta en `America/Guayaquil`. Los filtros de estado reflejan el estado actual del directorio. La aplicación no calcula salarios, descuentos, impuestos, liquidaciones ni transferencias.

## Persistencia y estructura

`server/` contiene la API HTTP, autenticación y almacenamiento. `src/domain/` reúne el modelo y cálculos; `src/services/` contiene importadores, exportación y adaptadores de datos. La API y el navegador comparten las validaciones de Excel.

SQLite se guarda en `data/nettplus.sqlite` de forma predeterminada. Incluye tablas para usuarios, sesiones, colaboradores, marcaciones, importaciones, permisos, horas informadas, configuración y auditoría, con claves y restricciones de unicidad. Las operaciones se confirman en transacciones. Haz una copia de seguridad con el servidor detenido, incluyendo el archivo de base de datos. El backend local está pensado para este prototipo; no configura acceso de red ni alojamiento de producción.

La demo usa IndexedDB por origen/navegador y sessionStorage para la cuenta seleccionada. Refrescar conserva la información. Cambiar de puerto, host o navegador crea otro espacio. Usa una pestaña para editar una misma base de demostración. Los datos de SQLite y los de IndexedDB no se sincronizan automáticamente.

La arquitectura original con Go/SQLite o Go/PostgreSQL se adaptó a Node/SQLite para mantener un arranque sencillo con las herramientas ya instaladas. Una modalidad multiusuario de producción, PostgreSQL, copias de seguridad automáticas y un procedimiento de correcciones aprobado quedan fuera de esta entrega.

## Vercel

Vercel sirve la interfaz y la **demo de navegador**. El backend SQLite permanece local y no se presenta como persistencia compartida en Vercel. Al no detectar la API, el acceso permite entrar a la demo; importar, filtrar y exportar siguen funcionando en el navegador.

Configuración: framework **Vite**, raíz de este proyecto, `npm run build`, salida `dist`. `vercel.json` incluye el fallback de React Router. No hacen falta secretos ni una API remota para la demo. Las fuentes y el logo se sirven localmente.

Cuando autorices el despliegue:

```powershell
npm install -g vercel
```

```powershell
vercel
```

```powershell
vercel --prod
```

No se hicieron commits, push ni despliegues. Los documentos de requisitos PR-001 a PR-006, NEC-001 a NEC-012, RN-01 a RN-13 y CU-01 a CU-08 siguen guiando el alcance; RN-12/13 se cubren parcialmente mediante este servidor local y no se afirma validación multiusuario de producción.

Referencias técnicas: [Node SQLite](https://nodejs.org/api/sqlite.html), [Node Crypto](https://nodejs.org/api/crypto.html), [ExcelJS](https://github.com/exceljs/exceljs), [ECharts](https://echarts.apache.org/handbook/en/basics/import/), [Vite en Vercel](https://vercel.com/docs/frameworks/frontend/vite).
