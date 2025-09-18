# 🔒 Guía de Seguridad Firebase - Sistema de Inventario

## 📋 Reglas de Firestore Implementadas

### 🎯 **Colecciones Principales:**

#### **1. Movimientos (`/movimientos/{movimientoId}`)**
- ✅ **Lectura/Escritura:** Usuarios autenticados (incluso anónimos)
- ✅ **Validaciones:**
  - Campos requeridos: `producto`, `cantidad`, `tipo`, `sede`, `timestamp`
  - `cantidad` debe ser > 0
  - `tipo` debe ser: `entrada`, `salida`, `devolucion`, `ajuste`
  - Todos los campos deben ser del tipo correcto

#### **2. Productos (`/productos/{productoId}`)**
- ✅ **Lectura/Escritura:** Usuarios autenticados
- ✅ **Validaciones:**
  - Campos requeridos: `producto`, `cantidad`, `sede`, `ultimaActualizacion`
  - `cantidad` debe ser >= 0
  - Todos los campos deben ser del tipo correcto

#### **3. Sedes (`/sedes/{sedeId}`)**
- ✅ **Lectura/Escritura:** Usuarios autenticados
- ✅ **Validaciones:**
  - Campo requerido: `nombre`
  - `nombre` debe ser string no vacío

#### **4. Usuarios (`/usuarios/{userId}`)**
- ✅ **Lectura/Escritura:** Solo el usuario propietario
- ✅ **Validaciones:**
  - Campos requeridos: `email`, `nombre`, `rol`
  - `rol` debe ser: `admin`, `operador`, `consulta`

### 🔐 **Colecciones Administrativas:**

#### **5. Configuración (`/configuracion/{configId}`)**
- ✅ **Acceso:** Solo administradores
- ✅ **Uso:** Configuraciones del sistema

#### **6. Reportes (`/reportes/{reporteId}`)**
- ✅ **Lectura:** Usuarios autenticados
- ✅ **Creación:** Administradores y operadores
- ✅ **Actualización:** Solo administradores

#### **7. Auditoría (`/auditoria/{auditoriaId}`)**
- ✅ **Lectura:** Solo administradores
- ✅ **Escritura:** Deshabilitada (solo sistema)

#### **8. Backups (`/backups/{backupId}`)**
- ✅ **Acceso:** Solo administradores
- ✅ **Uso:** Respaldo de datos

### 📊 **Colecciones de Soporte:**

#### **9. Lotes (`/lotes/{loteId}`)**
- ✅ **Lectura/Escritura:** Usuarios autenticados
- ✅ **Validaciones:** Campos requeridos para lotes

#### **10. Proveedores (`/proveedores/{proveedorId}`)**
- ✅ **Lectura:** Usuarios autenticados
- ✅ **Escritura:** Solo administradores

#### **11. Categorías (`/categorias/{categoriaId}`)**
- ✅ **Lectura:** Usuarios autenticados
- ✅ **Escritura:** Solo administradores

#### **12. Alertas (`/alertas/{alertaId}`)**
- ✅ **Lectura:** Usuarios autenticados
- ✅ **Escritura:** Solo administradores

#### **13. Estadísticas (`/estadisticas/{estadisticaId}`)**
- ✅ **Lectura:** Usuarios autenticados
- ✅ **Escritura:** Solo administradores

#### **14. Logs (`/logs/{logId}`)**
- ✅ **Lectura:** Solo administradores
- ✅ **Escritura:** Deshabilitada (solo sistema)

### 👤 **Colecciones de Usuario:**

#### **15. Sesiones (`/sesiones/{sesionId}`)**
- ✅ **Acceso:** Solo el usuario propietario
- ✅ **Uso:** Gestión de sesiones

#### **16. Preferencias (`/preferencias/{preferenciaId}`)**
- ✅ **Acceso:** Solo el usuario propietario
- ✅ **Uso:** Configuraciones personales

### 🗑️ **Colecciones Temporales:**

#### **17. Temporales (`/temporales/{temporalId}`)**
- ✅ **Acceso:** Usuarios autenticados
- ✅ **Expiración:** Automática por timestamp

#### **18. Test (`/test/{testId}`)**
- ✅ **Acceso:** Deshabilitado en producción
- ✅ **Uso:** Solo desarrollo

## 🚀 **Cómo Implementar las Reglas:**

### **1. En Firebase Console:**
1. Ve a **Firestore Database**
2. Haz clic en **Rules**
3. Copia y pega el contenido de `firestore.rules`
4. Haz clic en **Publish**

### **2. Usando Firebase CLI:**
```bash
# Instalar Firebase CLI
npm install -g firebase-tools

# Iniciar sesión
firebase login

# Inicializar proyecto
firebase init firestore

# Desplegar reglas
firebase deploy --only firestore:rules
```

### **3. Verificar Reglas:**
```bash
# Simular reglas
firebase firestore:rules:test

# Ver reglas actuales
firebase firestore:rules:get
```

## 🔒 **Niveles de Seguridad:**

### **🟢 Nivel Básico (Actual):**
- Autenticación anónima
- Acceso a datos principales
- Validaciones básicas

### **🟡 Nivel Intermedio (Recomendado):**
- Autenticación con email/password
- Roles de usuario
- Acceso controlado por roles

### **🔴 Nivel Avanzado (Empresarial):**
- Autenticación con Google/Microsoft
- Roles granulares
- Auditoría completa
- Encriptación de datos sensibles

## 📝 **Validaciones Implementadas:**

### **✅ Validaciones de Datos:**
- Tipos de datos correctos
- Campos requeridos
- Rangos de valores válidos
- Formatos de fecha/hora

### **✅ Validaciones de Seguridad:**
- Usuarios autenticados
- Roles de usuario
- Propiedad de datos
- Acceso por colección

### **✅ Validaciones de Negocio:**
- Cantidades positivas
- Tipos de movimiento válidos
- Sedes existentes
- Fechas de vencimiento

## 🚨 **Consideraciones de Seguridad:**

### **⚠️ Importante:**
1. **Revisar reglas regularmente**
2. **Monitorear accesos**
3. **Actualizar validaciones**
4. **Hacer respaldos**
5. **Probar reglas antes de desplegar**

### **🔍 Monitoreo:**
- Usar Firebase Analytics
- Revisar logs de Firestore
- Monitorear accesos no autorizados
- Alertas de seguridad

## 📞 **Soporte:**

Para problemas de seguridad:
1. Revisar logs de Firebase
2. Verificar reglas de Firestore
3. Contactar al administrador
4. Revisar documentación de Firebase

---

**🔒 ¡Tu sistema está protegido con reglas de seguridad robustas!**
