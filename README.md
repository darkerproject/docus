# Dokus

> *by Darker Project*

Generador de documentos en PDF — ligero, sin backend, multi-cuenta. Crea cotizaciones, facturas, recibos y otros documentos profesionales con datos del cliente o paciente, items con precios, descuentos, IGV, observaciones, y exporta el resultado como PDF en formato A4 listo para enviar.

## Características

- **Multi-cuenta con contraseña.** Cada usuario tiene su propia cuenta protegida con hash SHA-256 + salt.
- **Dos plantillas:**
  - **Lab** — para laboratorios y servicios técnicos. Datos del paciente, exámenes con tiempo y tipo de muestra.
  - **General** — para alquileres, servicios y productos. Datos del cliente, items con cantidad y precio unitario, subtotal por línea calculado automáticamente.
- **Personalización por cuenta+plantilla:** logo, datos de empresa, paleta de 3 colores, tasa de IGV, indicaciones y observaciones predeterminadas.
- **Toggles de secciones:** activa/desactiva qué campos y secciones aparecen en el PDF (Empresa, Teléfono, Email, Dirección del servicio, Indicaciones, Observaciones, etc.).
- **Catálogo de items guardados** para uso recurrente, separado por plantilla.
- **Sesión persistente:** el refresh no te bota; cierras sesión cuando quieras desde Configuración.
- **Descarga directa a PDF** en A4 sin pasar por servidor.
- **100% client-side:** los datos viven en el `localStorage` del navegador. Cero backend, cero costos de servidor.

## Uso local

Abre `index.html` en tu navegador. No requiere instalación.

Necesita conexión a internet **la primera vez** para cargar las fuentes (Google Fonts) y las librerías de PDF (jsPDF + html2canvas) desde CDN.

## Despliegue en GitHub Pages

1. Sube todos los archivos al repositorio.
2. Ve a **Settings → Pages → Source**: rama `main`, carpeta `/ (root)`.
3. La app queda disponible en `https://<usuario>.github.io/<repo>/`.

Cada visitante tendrá su propio espacio de cuentas en su navegador — los datos no se comparten entre dispositivos ni usuarios.

## Estructura del proyecto

```
dokus/
├── index.html      Estructura HTML
├── styles.css      Estilos
├── app.js          Lógica de la aplicación
└── README.md
```

## Stack técnico

- HTML + CSS + JavaScript vanilla (sin framework)
- [jsPDF](https://github.com/parallax/jsPDF) + [html2canvas](https://github.com/niklasvh/html2canvas) para la generación de PDF
- Web Crypto API (SHA-256) para el hashing de contraseñas
- `localStorage` para persistencia
- Google Fonts: Manrope (sans) + Fraunces (display)

## Notas sobre seguridad

La protección por contraseña funciona como un *soft gate* a nivel de UI — separa cuentas de distintos usuarios en un mismo navegador, pero los datos no están encriptados. Cualquiera con acceso al navegador y conocimientos de DevTools podría leer el contenido de `localStorage`.

Para uso casual entre amigos o en un dispositivo de uso compartido, esto es suficiente. Para datos sensibles a nivel empresarial, se requiere migrar a un backend con autenticación real (Firebase, Supabase, etc.).

## Licencia

© Darker Project — todos los derechos reservados.
