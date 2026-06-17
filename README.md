# 🚀 Genius BMW - Momentum Navarra

Sistema de gestión logística VN y exposición premium para Momentum Navarra. El código está sincronizado y listo para producción.

## 🛠️ Operativa en GitHub

Ahora que el proyecto está en GitHub, sigue estos pasos para sacarle el máximo partido:

### 1. Despliegue Automático (CI/CD)
Para que la aplicación esté disponible en internet:
1. Ve a la [Consola de Firebase](https://console.firebase.google.com/).
2. Crea un nuevo proyecto (o usa uno existente).
3. Ve a **App Hosting** y conecta este repositorio de GitHub.
4. Firebase desplegará la app automáticamente cada vez que subas cambios.

### 2. Configuración de IA (Secrets)
Para que Gemini funcione en el servidor desplegado:
1. En tu repositorio de GitHub, ve a **Settings > Secrets and variables > Actions**.
2. Añade un nuevo secreto llamado `GEMINI_API_KEY` con tu clave de Google AI Studio.
3. Asegúrate de que las variables de Firebase (`NEXT_PUBLIC_FIREBASE_...`) estén configuradas en el panel de App Hosting.

### 3. Comandos de Trabajo Diario
Cuando hagas cambios locales y quieras subirlos:
```bash
git add .
git commit -m "Descripción del cambio (ej: Mejora en el plano)"
git push origin main
```

---

## 📦 Gestión de Backups
Para generar un archivo de respaldo local sin archivos basura:
1. Ejecuta: `npm run backup`
2. El archivo `proyecto_backup.tar.gz` será ignorado por Git automáticamente para no saturar el repositorio.

## 🎨 Identidad Visual
- **Primario:** BMW Portimao Blue (#003399)
- **Acento:** BMW M Red (#ED1C24)
- **Fondo:** Navy Blue para menús, Slate para áreas de trabajo.
