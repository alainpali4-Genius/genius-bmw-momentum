# 🚀 Genius BMW - Momentum Navarra

Sistema de gestión logística VN y exposición premium para Momentum Navarra. El código está sincronizado y listo para producción.

## 🛠️ Despliegue en Firebase (Guía para el Plan Blaze)

Como ves en tu consola de Firebase, para usar **App Hosting** es obligatorio activar el **Plan Blaze (Pago por uso)**. Google Cloud requiere esto para gestionar los servidores de Next.js.

### Pasos para activar el Hosting:
1. **Facturación**: En la ventana que tienes abierta en tu navegador, haz clic en **"Crea una cuenta de Facturación de Cloud"**.
2. **Vincular**: Una vez tengas la cuenta de facturación, Firebase te dejará seleccionar tu repositorio de GitHub `alainpali4-Genius/genius-bmw-momentum`.
3. **Configuración de App Hosting**:
   - **Región**: Selecciona `europe-west1` (Bélgica) o la más cercana a España.
   - **Root directory**: Déjalo como `/`.
   - **Environment Variables**: Añade `GEMINI_API_KEY` con tu clave de Google AI Studio.

---

## 📦 Comandos de Git (Uso Diario)

Para subir nuevos cambios a tu GitHub:
```bash
git add .
git commit -m "Descripción de los cambios realizados"
git push origin main
```

## 🎨 Diseño Premium Blindado
- **Barra Lateral**: Fondo Azul Portimao (#003399). El hover en **Rojo M (#ED1C24)** es individual por cada opción.
- **Plano VN**: Siluetas de vehículos maximizadas al 150% para visibilidad total.
- **Persistencia**: Todo el stock se guarda automáticamente en Firebase Firestore.
