# 🎛️ SoundPad Pro - Neon Edition

Aplicación web profesional de soundpad con visualizador de espectro, hotcues, controles de velocidad/fade, y persistencia local.

## 🚀 Características

- **Grid personalizable**: Configura columnas y filas (1-12)
- **Múltiples pestañas**: Organiza tus sonidos en diferentes bancos
- **Visualizador de espectro**: Visualización en tiempo real del audio
- **Hotcues**: Marca posiciones en el audio para acceso rápido
- **Controles avanzados**: Velocidad (0.25x-2x), fade in/out, loop
- **Colores personalizados**: Asigna colores a cada pad
- **Persistencia local**: Tu configuración se guarda automáticamente
- **Atajos de teclado**: Hotkeys para cada pad, espacio para stop all
- **Solo un audio a la vez**: Garantiza que nunca se superpongan sonidos
- **Exportar/Importar**: Guarda y carga tu configuración

## 🌐 Ejecutar en Navegador Web

### Opción 1: Servidor de Desarrollo (Recomendado para desarrollo)

```bash
# Instalar dependencias
npm install

# Iniciar servidor de desarrollo
npm run dev
```

Abre tu navegador en: `http://localhost:5173`

### Opción 2: Build de Producción

```bash
# Instalar dependencias
npm install

# Generar build optimizado
npm run build

# Los archivos estarán en la carpeta 'dist/'
```

### Opción 3: Servir con cualquier servidor HTTP

Después de ejecutar `npm run build`, puedes servir la carpeta `dist/` con cualquier servidor:

**Con Python:**
```bash
cd dist
python -m http.server 8000
```

**Con Node.js (serve):**
```bash
npm install -g serve
serve dist
```

**Con PHP:**
```bash
cd dist
php -S localhost:8000
```

Luego abre: `http://localhost:8000`

## 📱 Uso

### Cargar Audio
1. Arrastra archivos de audio (MP3, WAV, OGG, etc.) sobre cualquier pad
2. El audio se decodifica automáticamente y se muestra el waveform

### Reproducir
- **Click en pad**: Reproduce/detiene el audio
- **Teclas 1-9, Q-P, A-L, Z-M**: Hotkeys para cada pad
- **Barra de progreso**: Click para saltar a cualquier posición
- **Hotcues**: Click en un hotcue para reproducir desde esa posición

### Controles
- 🔁 **Loop**: Repetir audio continuamente
- 📍 **Hotcue**: Marcar posición actual
- 🗑 **Limpiar hotcues**: Eliminar todos los hotcues del pad
- ⚙ **Configuración**: Ajustar velocidad y fade
- 🔊 **Volumen**: Control de volumen individual

### Barra Superior
- 💾 **Exportar**: Guardar configuración como JSON
- 📂 **Importar**: Cargar configuración desde JSON
- 🔴 **Grabar**: Grabar secuencia de reproducción (Ctrl+R)
- ⏹ **STOP ALL**: Detener todos los sonidos (Espacio)

### Atajos de Teclado
- **Espacio**: Detener todos los sonidos
- **Ctrl+R**: Iniciar/detener grabación
- **1-9, Q-P, A-L, Z-M**: Activar pads correspondientes

## 🔧 Requisitos del Navegador

- **Chrome/Edge**: Versión 70+ (recomendado)
- **Firefox**: Versión 65+
- **Safari**: Versión 12+
- **Opera**: Versión 60+

**Nota**: Se requiere soporte para Web Audio API (disponible en todos los navegadores modernos).

## 📂 Estructura del Proyecto

```
soundpad-pro/
├── src/
│   ├── App.tsx              # Componente principal
│   ├── main.tsx             # Punto de entrada
│   ├── index.css            # Estilos globales
│   ├── types.ts             # Tipos TypeScript
│   └── hooks/
│       └── useAudioEngine.ts # Motor de audio
├── public/
│   └── manifest.json        # PWA manifest
├── dist/                    # Build de producción (generado)
├── index.html               # HTML principal
├── package.json             # Dependencias
├── vite.config.ts           # Configuración Vite
└── tailwind.config.js       # Configuración Tailwind
```

## 🎨 Tecnologías

- **React 18**: Framework UI
- **TypeScript**: Tipado estático
- **Vite**: Build tool ultrarrápido
- **Tailwind CSS**: Estilos utility-first
- **Web Audio API**: Procesamiento de audio en el navegador

## 💾 Persistencia

La aplicación guarda automáticamente en `localStorage`:
- Configuración de grid (columnas/filas)
- Pestañas y sus nombres
- Pads con sus archivos, colores, hotcues, volumen, velocidad, fade
- Colores recientes

**Nota**: Los archivos de audio NO se guardan (limitación del navegador). Debes volver a arrastrarlos después de recargar.

## 🐛 Solución de Problemas

### El audio no suena
- Haz click en cualquier parte de la página primero (requisito del navegador para activar AudioContext)
- Verifica que el volumen master no esté en 0
- Verifica que el volumen del pad no esté en 0

### Los archivos no se cargan
- Asegúrate de que sean archivos de audio válidos (MP3, WAV, OGG, FLAC, M4A)
- Algunos formatos pueden no ser compatibles con todos los navegadores

### La configuración no se guarda
- Verifica que el navegador no esté en modo incógnito/privado
- Asegúrate de que localStorage esté habilitado

## 📄 Licencia

Este proyecto es de código abierto y está disponible para uso personal y comercial.

## 🤝 Contribuciones

Las contribuciones son bienvenidas. Por favor, abre un issue o pull request.

---

**Desarrollado con ❤️ usando React, TypeScript y Web Audio API**
