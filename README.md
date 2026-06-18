# 🚀 Genius BMW - Momentum Navarra

Sistema de gestión logística VN y exposición premium para Momentum Navarra.

## 🛠️ COMANDO DE ACTUALIZACIÓN RÁPIDA (PARA GITHUB Y VERCEL)
Copia y pega este comando en tu terminal para guardar tus cambios, sincronizar con la nube y desplegar en Vercel sin errores de conflictos:

```bash
git add . && git commit -m "Update: Sincronización Genius BMW" && git pull origin main --rebase && git push origin main
```

---

## 🎨 Branding & Identidad Corporativa
- **Favicon**: Logotipo oficial de BMW implementado mediante `src/app/icon.tsx` (estándar Next.js) para máxima nitidez en URL.
- **Logo Sidebar**: Se utiliza `/logo-product-genius.png` en la barra lateral y cabecera móvil.
- **Interfaz**: Colores oficiales BMW M (Portimao Blue y M Red) aplicados en todo el sistema.

## 📦 Funcionalidades Core
- **Plano de Exposición**: Gestión visual de plazas en tiempo real.
- **Inventario IA**: Escáner de bastidor con compresión automática de imágenes (<1MB).
- **Control de Stock**: Importación masiva vía Excel y detección de duplicados de VIN.
- **Entregas**: Planificación logística y control de actas de entrega.

## 🚀 Notas de Despliegue
Si el favicon no cambia tras un despliegue, recuerda abrir la web en una **ventana de incógnito** o pulsar `Ctrl + F5` para refrescar la caché del navegador.
