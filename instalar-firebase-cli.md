# Instrucciones para instalar Firebase CLI

## 1. Instalar Node.js
- Ve a https://nodejs.org/
- Descarga e instala la versión LTS
- Reinicia tu terminal/PowerShell

## 2. Instalar Firebase CLI
```bash
npm install -g firebase-tools
```

## 3. Iniciar sesión en Firebase
```bash
firebase login
```

## 4. Desplegar las reglas actualizadas
```bash
firebase deploy --only firestore:rules
```

## 5. Verificar el despliegue
```bash
firebase projects:list
```
