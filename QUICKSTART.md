# 🚀 Guía Rápida de Instalación y Ejecución

## Instalación (solo la primera vez)

```bash
# 1. Instalar Node.js (si no lo tienes)
# Descarga desde: https://nodejs.org/

# 2. Instalar dependencias del proyecto
npm install
```

## Ejecutar en Navegador

### Método 1: Servidor de Desarrollo (Recomendado)

```bash
npm run dev
```

Abre tu navegador en: **http://localhost:5173**

### Método 2: Build de Producción

```bash
# Generar archivos optimizados
npm run build

# Servir con Python (si lo tienes instalado)
cd dist && python -m http.server 8000

# O con Node.js
npx serve dist
```

Abre tu navegador en: **http://localhost:8000**

## Uso Básico

1. **Arrastra archivos de audio** sobre cualquier pad
2. **Click en un pad** para reproducir/detener
3. **Usa las teclas** 1-9, Q-P, A-L, Z-M como hotkeys
4. **Barra de progreso**: Click para saltar a cualquier posición
5. **Botón STOP ALL** (o Espacio): Detiene todos los sonidos

## Características Principales

✅ Solo un audio a la vez (garantizado)
✅ Hotcues con botón para limpiar
✅ Barra de progreso siempre visible
✅ Visualizador de espectro en tiempo real
✅ Controles de velocidad y fade
✅ Persistencia automática en localStorage
✅ Exportar/Importar configuración

## Requisitos

- Navegador moderno (Chrome, Firefox, Safari, Edge)
- Node.js 16+ (solo para desarrollo)

## Problemas Comunes

**El audio no suena**: Haz click en la página primero (requisito del navegador)

**Los archivos no se cargan**: Usa formatos MP3, WAV, OGG o M4A

**La configuración no se guarda**: Verifica que no estés en modo incógnito

---

Para más información, consulta el README.md completo.
