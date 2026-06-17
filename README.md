# 🚀 Genius BMW - Momentum Navarra

Sistema de gestión logística VN y exposición premium para Momentum Navarra. El código está sincronizado y listo para producción.

## 🛠️ Despliegue en Firebase / Vercel

### Fix Crítico: Error 413 (Payload Too Large)
Se ha implementado compresión de imágenes en el cliente para el módulo **Inventario IA**. Esto asegura que las fotos enviadas a Gemini pesen menos de 1MB, permitiendo que el sistema funcione en servidores con límites de tráfico estrictos.

---

## 📦 Comandos para Sincronizar con GitHub

Si acabas de aplicar el fix de compresión, copia y pega estos comandos en la terminal para actualizar tu repositorio:

```bash
git add .
git commit -m "Fix: Implementar compresión de imágenes en Inventario IA para evitar error 413"
git push origin main
```

---

## 🎨 Diseño Premium Blindado
- **Barra Lateral**: Fondo Azul Portimao (#003399). Hover en **Rojo M (#ED1C24)** estrictamente individual.
- **Plano VN**: Siluetas de vehículos maximizadas al 150% para visibilidad total.
- **Inventario IA**: Escáner de bastidor optimizado con reducción automática de tamaño de imagen.
- **Persistencia**: Todo el stock se guarda automáticamente en Firebase Firestore.
