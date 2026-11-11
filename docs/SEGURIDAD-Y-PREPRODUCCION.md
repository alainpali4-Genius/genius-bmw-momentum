# Seguridad y validación pendiente — GENIUS BMW MOMENTUM

## Estado detectado en la rama mejora-ficha-vehiculos

- Firebase inicializa Firestore y Firebase Auth.
- Existe un hook que escucha cambios de sesión con onAuthStateChanged.
- En el código revisado no se ha localizado un flujo de inicio de sesión (signInWithEmailAndPassword) ni de alta de usuarios.
- Las reglas actuales de Firestore permiten lectura y escritura pública en todas las colecciones, incluido el comodín global.

## Decisión de seguridad

No sustituir todavía las reglas por `request.auth != null` sin completar y probar antes el acceso de usuarios. Hacerlo ahora podría bloquear por completo la aplicación y dejar a los usuarios fuera.

## Pasos obligatorios antes de producción

1. Implementar una pantalla de acceso y proteger las rutas privadas.
2. Definir cómo se crean y autorizan las cuentas del personal (sin registro público).
3. Probar el flujo de acceso y cierre de sesión.
4. Aplicar reglas de Firestore autenticadas y, si procede, por roles.
5. Probar lectura y escritura con una cuenta autorizada y denegación con sesión cerrada.
6. Verificar el historial de movimientos y las operaciones de vehículos.

## Nota

Los cambios de esta rama aún no están desplegados. No publicar ni fusionar hasta completar las pruebas de compilación, acceso y permisos.
