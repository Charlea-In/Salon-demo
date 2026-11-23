# Aurea Salón

Sistema web de gestión y reservas para salones de belleza, estilistas y estudios de uñas. La interfaz está configurada para **El Salvador**: fechas `es-SV`, zona horaria `America/El_Salvador`, precios en dólares estadounidenses (USD) y teléfonos locales de 8 dígitos con código de país `+503` para enlaces.

**Demo funcional:** <https://charlea-in.github.io/Salon-demo/>

## Funciones

- Sitio público con servicios de belleza, estilistas, disponibilidad y reserva de citas.
- Consulta y cancelación de citas; las clientas recurrentes pueden vincular su historial usando su código `AS-01`, nombre y teléfono.
- Panel administrativo para agenda, clientes, servicios, estilistas, ingresos, gastos, disponibilidad, ajustes y respaldos.
- Portal personal de cada estilista con agenda, confirmación de citas, contacto por WhatsApp, registro de servicios e ingresos.
- Indicador de carga al consultar datos en Google Sheets.
- Modo de demo funcional con almacenamiento en el navegador si no hay conexión con Google Sheets.

La demo publicada es una instancia funcional del proyecto, no una garantía de que sus datos sean persistentes entre navegadores. Para operar el salón, conecta una hoja de Google propia y configura sus datos reales.

## Abrir y usar

Puedes abrir `index.html` directamente o iniciar un servidor estático desde la carpeta del proyecto:

```bash
python -m http.server 5500
```

Abre `http://127.0.0.1:5500/`. El panel administrativo está en `admin.html` y el portal de la estilista en `estilista.html`.

Sin una API configurada, la demo funcional guarda los cambios en `localStorage` del navegador actual. Desde el panel puedes restaurar los datos de demo. Las claves de demostración están en `js/config.js`; cámbialas antes de compartir una instancia de demostración.

| Acceso | Clave de demo |
| --- | --- |
| Panel de la dueña | `aurea2026` |
| Daniela Rivas | `daniela2026` |
| Valeria Cruz | `valeria2026` |
| Camila Flores | `camila2026` |
| Sofía Méndez | `sofia2026` |

## Conectar Google Sheets

La guía detallada está en [docs/google-sheets-setup.md](docs/google-sheets-setup.md).

1. Crea una hoja de cálculo nueva y abre **Extensiones → Apps Script**.
2. Copia `apps-script/Code.gs` y `apps-script/appsscript.json` al proyecto de Apps Script.
3. Ejecuta `setup()` y autoriza los permisos. La hoja se crea vacía, sin citas ni clientes de ejemplo.
4. Configura una clave larga para el panel con `configurarClave("aurea-2026-fuerte")`.
5. Implementa como aplicación web y pega su URL `/exec` en `js/config.js`, en `api.url`.
6. Si actualizas una instalación existente, revisa la guía y ejecuta `migrar()` antes de publicar una versión nueva del Web App.

Apps Script usa `LockService` para proteger operaciones sensibles frente a solicitudes simultáneas. La zona horaria del backend está fijada a El Salvador. Cada instalación debe tener su propia hoja, clave y datos comerciales.

## Configuración regional y datos

Los precios y contactos de `js/config.js` y `apps-script/Code.gs` son valores de ejemplo. Las tarifas semilla están expresadas en USD y deben ajustarse a cada salón desde el panel. No se incluyen números de WhatsApp, teléfonos, correos ni direcciones comerciales inventados.

Los números de clientas de ejemplo usan valores de prueba y no son números de contacto. Para clientas reales, se validan 8 dígitos locales; los formularios también reconocen el prefijo internacional `+503`.

En Google Sheets, la configuración del negocio, el catálogo, las citas, clientas y datos financieros viven en las pestañas creadas por `setup()`. La pestaña **Estilistas** conserva ese nombre y el campo `estilista_id` por compatibilidad interna, pero en la interfaz todo se muestra como **Estilistas**. La ejecución de `migrar()` actualiza encabezados y asigna códigos de clienta faltantes.

## Publicar en GitHub Pages

El proyecto es estático y puede servirse desde GitHub Pages:

1. Sube el repositorio a GitHub.
2. En **Settings → Pages**, selecciona despliegue desde una rama o GitHub Actions.
3. Si usas Actions, el workflow está en `.github/workflows/pages.yml`.
4. Tras publicar cambios de frontend, incrementa los parámetros `?v=` de los recursos CSS/JS en los HTML para renovar la caché.

## Estructura

```text
├─ index.html                  Sitio público y reservas
├─ admin.html                  Panel administrativo
├─ estilista.html              Portal de la estilista
├─ js/config.js                Marca, región, horarios y conexión
├─ js/ui.js                    Formato, componentes y utilidades
├─ js/store.js                 Demo funcional y cliente de Apps Script
├─ js/app.js                   Reservas e historial de clientas
├─ js/admin.js                 Administración del salón
├─ js/estilista.js             Jornada y acciones de la estilista
├─ js/sheets-loading.js        Indicador de operaciones con Sheets
├─ apps-script/Code.gs         API y persistencia en Google Sheets
└─ docs/google-sheets-setup.md Guía de instalación y actualización
```

## API

El frontend usa solicitudes JSON a Apps Script. Entre sus acciones se encuentran `bootstrap`, `availability`, `book`, `lookup`, `cancel`, `adminLogin`, `adminData`, `adminSave`, `adminDelete`, `setStatus` y las acciones del portal de estilistas. Las operaciones administrativas se validan en Apps Script; la guía explica cómo configurar y actualizar el Web App.

## Alcance y seguridad

- Google Sheets debe permanecer privada; el Web App accede a ella con la cuenta de quien lo implementa.
- La URL del Web App es pública para permitir reservas. No guardes secretos en `js/config.js`.
- Usa contraseñas únicas y fuertes para el panel y claves personales para cada estilista.
- La demo funcional almacena datos localmente en el navegador y no sustituye una base de datos compartida.

Hecho para adaptar a salones de belleza, estudios de uñas y equipos de estilistas en El Salvador. Configura marca, tarifas, equipo, contactos y horario propios antes de usarlo con clientas.
