// Firebase Configuration and Functions
// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, doc, updateDoc, deleteDoc, query, orderBy, where, onSnapshot, setDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// Your web app's Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyBt5IR0jg2sye3S1XdWxP0FBWZFP8D4OdQ",
    authDomain: "paedigital2025.firebaseapp.com",
    projectId: "paedigital2025",
    storageBucket: "paedigital2025.firebasestorage.app",
    messagingSenderId: "740229563465",
    appId: "1:740229563465:web:2f740a1f2a33b1ff29ab98"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// Hacer las variables globales
window.db = db;
window.auth = auth;
window.collection = collection;
window.addDoc = addDoc;
window.getDocs = getDocs;
window.doc = doc;
window.updateDoc = updateDoc;
window.deleteDoc = deleteDoc;
window.setDoc = setDoc;
window.query = query;
window.orderBy = orderBy;
window.where = where;
window.onSnapshot = onSnapshot;

// Función para actualizar el indicador de estado
function actualizarIndicadorFirebase(estado, mensaje) {
    const indicador = document.getElementById('indicador-conexion');
    const texto = document.getElementById('firebase-status-text');
    
    if (indicador && texto) {
        indicador.className = `firebase-status ${estado}`;
        texto.textContent = mensaje;
        
        switch(estado) {
            case 'connected':
                indicador.innerHTML = '🔥 Firebase: Conectado';
                break;
            case 'disconnected':
                indicador.innerHTML = '🔥 Firebase: Desconectado';
                break;
            case 'syncing':
                indicador.innerHTML = '🔥 Firebase: Sincronizando...';
                break;
        }
    }
}

// Función para mostrar notificaciones de Firebase
function mostrarNotificacionFirebase(mensaje, tipo = 'info') {
    // Crear elemento de notificación
    const notificacion = document.createElement('div');
    notificacion.className = `firebase-notification ${tipo}`;
    notificacion.textContent = mensaje;
    
    // Agregar al DOM
    document.body.appendChild(notificacion);
    
    // Mostrar con animación
    setTimeout(() => {
        notificacion.classList.add('show');
    }, 100);
    
    // Ocultar después de 3 segundos
    setTimeout(() => {
        notificacion.classList.remove('show');
        setTimeout(() => {
            if (notificacion.parentNode) {
                notificacion.parentNode.removeChild(notificacion);
            }
        }, 300);
    }, 3000);
}

// Autenticación anónima
signInAnonymously(auth).then(() => {
    console.log('✅ Autenticado anónimamente con Firebase');
    actualizarIndicadorFirebase('connected', 'Conectado a Firebase - Datos sincronizados');
}).catch((error) => {
    console.error('❌ Error de autenticación:', error);
    actualizarIndicadorFirebase('disconnected', 'Error de conexión - Modo local');
});

// ==================== FUNCIONES PARA MOVIMIENTOS ====================

// Función para agregar movimiento a Firebase
window.agregarMovimientoFirebase = async function(movimiento) {
    try {
        console.log("🔥 INTENTANDO GUARDAR EN FIREBASE:", movimiento);
        
        const docRef = await addDoc(collection(db, "movimientos"), {
            ...movimiento,
            timestamp: new Date().toISOString(),
            fechaCreacion: new Date().toISOString()
        });
        console.log("✅ MOVIMIENTO GUARDADO EN FIREBASE CON ID:", docRef.id);
        
        // Actualizar localStorage también
        const movimientos = JSON.parse(localStorage.getItem('historial') || '[]');
        movimientos.unshift({ id: docRef.id, ...movimiento, timestamp: new Date().toISOString() });
        localStorage.setItem('historial', JSON.stringify(movimientos));
        
        // Si es un movimiento de entrada, salida o devolución, actualizar el inventario en Firebase
        if (movimiento.tipo === 'entrada' || movimiento.tipo === 'salida' || movimiento.tipo === 'devolucion') {
            console.log("📦 ACTUALIZANDO INVENTARIO EN FIREBASE...");
            await actualizarInventarioEnFirebase(movimiento);
        }
        
        // Mostrar notificación de éxito
        if (window.mostrarMensaje) {
            window.mostrarMensaje(`✅ Movimiento guardado en Firebase (ID: ${docRef.id})`, 'exito');
        }
        
        return docRef.id;
    } catch (error) {
        console.error("❌ ERROR GUARDANDO EN FIREBASE:", error);
        console.error("❌ Detalles del error:", error.message, error.code);
        
        // Mostrar notificación de error
        if (window.mostrarMensaje) {
            window.mostrarMensaje(`❌ Error guardando en Firebase: ${error.message}`, 'error');
        }
        
        throw error;
    }
};

// Función para actualizar inventario en Firebase
window.actualizarInventarioEnFirebase = async function(movimiento) {
    try {
        console.log("📦 ACTUALIZANDO INVENTARIO EN FIREBASE:", movimiento);
        
        if (movimiento.tipo === 'devolucion') {
            // Las devoluciones son especiales: restan de la sede origen y suman a BODEGA CENTRAL
            await actualizarInventarioDevolucion(movimiento);
        } else {
            // Entradas y salidas normales
            const clave = `${movimiento.producto}_${movimiento.sede}`;
            
            // Buscar si ya existe el producto en Firebase
            const q = query(collection(db, "productos"), 
                           where("producto", "==", movimiento.producto),
                           where("sede", "==", movimiento.sede));
            const querySnapshot = await getDocs(q);
            
            if (querySnapshot.empty) {
                // Crear nuevo producto
                const nuevoProducto = {
                    producto: movimiento.producto,
                    cantidad: movimiento.tipo === 'entrada' ? movimiento.cantidad : Math.max(0, -movimiento.cantidad),
                    sede: movimiento.sede,
                    lote: movimiento.lote || '',
                    fechaVencimiento: movimiento.fechaVencimiento || '',
                    diasRestantes: movimiento.diasRestantes || 0,
                    ultimaActualizacion: new Date().toISOString(),
                    fechaCreacion: new Date().toISOString()
                };
                
                const docRef = await addDoc(collection(db, "productos"), nuevoProducto);
                console.log("✅ NUEVO PRODUCTO CREADO EN FIREBASE:", docRef.id, nuevoProducto);
            } else {
                // Actualizar producto existente
                const doc = querySnapshot.docs[0];
                const productoActual = doc.data();
                const nuevaCantidad = movimiento.tipo === 'entrada' 
                    ? productoActual.cantidad + movimiento.cantidad
                    : Math.max(0, productoActual.cantidad - movimiento.cantidad);
                
                const datosActualizados = {
                    cantidad: nuevaCantidad,
                    lote: movimiento.lote || productoActual.lote,
                    fechaVencimiento: movimiento.fechaVencimiento || productoActual.fechaVencimiento,
                    diasRestantes: movimiento.diasRestantes || productoActual.diasRestantes,
                    ultimaActualizacion: new Date().toISOString()
                };
                
                await updateDoc(doc.ref, datosActualizados);
                console.log("✅ PRODUCTO ACTUALIZADO EN FIREBASE:", doc.id, datosActualizados);
            }
        }
        
        // También actualizar el inventario local inmediatamente
        await actualizarInventarioLocal(movimiento);
        
    } catch (error) {
        console.error("❌ ERROR ACTUALIZANDO INVENTARIO EN FIREBASE:", error);
        console.error("❌ Detalles del error:", error.message, error.code);
        // No lanzar error para no interrumpir el flujo principal
    }
};

// Función específica para actualizar inventario en devoluciones
window.actualizarInventarioDevolucion = async function(movimiento) {
    try {
        console.log("🔄 ACTUALIZANDO INVENTARIO PARA DEVOLUCIÓN:", movimiento);
        
        // 1. Restar de la sede origen
        const qOrigen = query(collection(db, "productos"), 
                             where("producto", "==", movimiento.producto),
                             where("sede", "==", movimiento.sede));
        const querySnapshotOrigen = await getDocs(qOrigen);
        
        if (!querySnapshotOrigen.empty) {
            const docOrigen = querySnapshotOrigen.docs[0];
            const productoOrigen = docOrigen.data();
            const nuevaCantidadOrigen = Math.max(0, productoOrigen.cantidad - movimiento.cantidad);
            
            if (nuevaCantidadOrigen > 0) {
                await updateDoc(docOrigen.ref, {
                    cantidad: nuevaCantidadOrigen,
                    ultimaActualizacion: new Date().toISOString()
                });
                console.log("✅ PRODUCTO ORIGEN ACTUALIZADO:", docOrigen.id, "cantidad:", nuevaCantidadOrigen);
            } else {
                // Si la cantidad llega a 0, eliminar el producto
                await deleteDoc(docOrigen.ref);
                console.log("🗑️ PRODUCTO ORIGEN ELIMINADO (cantidad = 0):", docOrigen.id);
            }
        }
        
        // 2. Sumar a BODEGA CENTRAL
        const qBodega = query(collection(db, "productos"), 
                             where("producto", "==", movimiento.producto),
                             where("sede", "==", "BODEGA CENTRAL"));
        const querySnapshotBodega = await getDocs(qBodega);
        
        if (querySnapshotBodega.empty) {
            // Crear nuevo producto en bodega
            const nuevoProductoBodega = {
                producto: movimiento.producto,
                cantidad: movimiento.cantidad,
                sede: "BODEGA CENTRAL",
                lote: movimiento.lote || '',
                fechaVencimiento: movimiento.fechaVencimiento || '',
                diasRestantes: movimiento.diasRestantes || 0,
                ultimaActualizacion: new Date().toISOString(),
                fechaCreacion: new Date().toISOString()
            };
            
            const docRefBodega = await addDoc(collection(db, "productos"), nuevoProductoBodega);
            console.log("✅ NUEVO PRODUCTO CREADO EN BODEGA:", docRefBodega.id, nuevoProductoBodega);
        } else {
            // Actualizar producto existente en bodega
            const docBodega = querySnapshotBodega.docs[0];
            const productoBodega = docBodega.data();
            const nuevaCantidadBodega = productoBodega.cantidad + movimiento.cantidad;
            
            await updateDoc(docBodega.ref, {
                cantidad: nuevaCantidadBodega,
                ultimaActualizacion: new Date().toISOString()
            });
            console.log("✅ PRODUCTO BODEGA ACTUALIZADO:", docBodega.id, "cantidad:", nuevaCantidadBodega);
        }
        
    } catch (error) {
        console.error("❌ ERROR ACTUALIZANDO INVENTARIO DE DEVOLUCIÓN:", error);
    }
};

// Función para actualizar inventario local
window.actualizarInventarioLocal = async function(movimiento) {
    try {
        console.log("💾 ACTUALIZANDO INVENTARIO LOCAL:", movimiento);
        
        if (window.inventario === undefined) {
            console.log("⚠️ Variable inventario no está disponible aún");
            return;
        }
        
        const clave = `${movimiento.producto}_${movimiento.sede}`;
        
        if (window.inventario[clave]) {
            // Producto existe, actualizar cantidad
            const cantidadActual = window.inventario[clave].cantidad || 0;
            const nuevaCantidad = movimiento.tipo === 'entrada' 
                ? cantidadActual + movimiento.cantidad
                : Math.max(0, cantidadActual - movimiento.cantidad);
            
            window.inventario[clave].cantidad = nuevaCantidad;
            window.inventario[clave].lote = movimiento.lote || window.inventario[clave].lote;
            window.inventario[clave].fechaVencimiento = movimiento.fechaVencimiento || window.inventario[clave].fechaVencimiento;
            window.inventario[clave].diasRestantes = movimiento.diasRestantes || window.inventario[clave].diasRestantes;
            
            console.log(`✅ INVENTARIO LOCAL ACTUALIZADO: ${movimiento.producto} - Cantidad: ${cantidadActual} → ${nuevaCantidad}`);
        } else {
            // Producto no existe, crear nuevo
            window.inventario[clave] = {
                producto: movimiento.producto,
                cantidad: movimiento.tipo === 'entrada' ? movimiento.cantidad : Math.max(0, -movimiento.cantidad),
                sede: movimiento.sede,
                lote: movimiento.lote || '',
                fechaVencimiento: movimiento.fechaVencimiento || '',
                diasRestantes: movimiento.diasRestantes || 0
            };
            
            console.log(`✅ NUEVO PRODUCTO AGREGADO AL INVENTARIO LOCAL: ${movimiento.producto} - Cantidad: ${window.inventario[clave].cantidad}`);
        }
        
        // Guardar en localStorage
        localStorage.setItem('inventario', JSON.stringify(window.inventario));
        console.log("💾 Inventario local guardado en localStorage");
        
        // Actualizar la interfaz de stock siempre que haya cambios
        if (window.mostrarStockActual) {
            console.log("🔄 Actualizando interfaz de stock...");
            window.mostrarStockActual();
        } else {
            console.log("⚠️ Función mostrarStockActual no disponible");
        }
        
    } catch (error) {
        console.error("❌ ERROR ACTUALIZANDO INVENTARIO LOCAL:", error);
    }
};

// Función para obtener movimientos de Firebase
window.obtenerMovimientosFirebase = async function() {
    try {
        const q = query(collection(db, "movimientos"), orderBy("timestamp", "desc"));
        const querySnapshot = await getDocs(q);
        const movimientos = [];
        querySnapshot.forEach((doc) => {
            movimientos.push({ id: doc.id, ...doc.data() });
        });
        console.log(`✅ Obtenidos ${movimientos.length} movimientos de Firebase`);
        return movimientos;
    } catch (error) {
        console.error("❌ Error obteniendo movimientos: ", error);
        return [];
    }
};

// Función para escuchar movimientos en tiempo real
window.escucharMovimientosTiempoReal = function() {
    try {
        console.log('👂 INICIANDO ESCUCHA EN TIEMPO REAL DE MOVIMIENTOS...');
        const q = query(collection(db, "movimientos"), orderBy("timestamp", "desc"));
        
        const unsubscribe = onSnapshot(q, (querySnapshot) => {
            console.log('🔄 CAMBIOS DETECTADOS EN FIREBASE - Movimientos:', querySnapshot.size, 'documentos');
            const movimientos = [];
            querySnapshot.forEach((doc) => {
                const movimiento = { id: doc.id, ...doc.data() };
                movimientos.push(movimiento);
                console.log('📄 Movimiento recibido:', movimiento.producto, '-', movimiento.tipo, '-', movimiento.fecha);
            });
            
            // Actualizar el historial global
            if (window.historial !== undefined) {
                window.historial = movimientos;
                console.log(`✅ HISTORIAL ACTUALIZADO CON ${movimientos.length} MOVIMIENTOS`);
                
                // Guardar en localStorage
                localStorage.setItem('historial', JSON.stringify(movimientos));
                console.log('💾 Historial guardado en localStorage');
                
                // Actualizar la interfaz de historial siempre que haya cambios
                if (window.cargarHistorial) {
                    console.log('🔄 Actualizando interfaz de historial...');
                    window.cargarHistorial();
                } else {
                    console.log('⚠️ Función cargarHistorial no disponible');
                }
                
                // Mostrar notificación de sincronización
                if (window.mostrarMensaje) {
                    window.mostrarMensaje(`🔄 ${movimientos.length} movimientos sincronizados`, 'info');
                }
            } else {
                console.log('⚠️ Variable historial no está disponible aún');
            }
        }, (error) => {
            console.error('❌ ERROR EN ESCUCHA DE TIEMPO REAL:', error);
            console.error('❌ Código de error:', error.code);
            console.error('❌ Mensaje de error:', error.message);
            
            if (window.mostrarMensaje) {
                window.mostrarMensaje(`❌ Error en sincronización: ${error.message}`, 'error');
            }
        });
        
        // Guardar la función de desuscripción
        window.unsubscribeMovimientos = unsubscribe;
        console.log('✅ ESCUCHA EN TIEMPO REAL CONFIGURADA CORRECTAMENTE');
        return unsubscribe;
    } catch (error) {
        console.error('❌ ERROR CONFIGURANDO ESCUCHA EN TIEMPO REAL:', error);
        return null;
    }
};

// ==================== FUNCIONES PARA PRODUCTOS ====================

// Función para agregar producto a Firebase
window.agregarProductoFirebase = async function(producto) {
    try {
        const docRef = await addDoc(collection(db, "productos"), {
            ...producto,
            ultimaActualizacion: new Date().toISOString(),
            fechaCreacion: new Date().toISOString()
        });
        console.log("✅ Producto agregado con ID: ", docRef.id);
        
        // Actualizar localStorage también
        const productos = JSON.parse(localStorage.getItem('productos') || '[]');
        productos.push({ id: docRef.id, ...producto, ultimaActualizacion: new Date().toISOString() });
        localStorage.setItem('productos', JSON.stringify(productos));
        
        return docRef.id;
    } catch (error) {
        console.error("❌ Error agregando producto: ", error);
        throw error;
    }
};

// Función para obtener productos de Firebase
window.obtenerProductosFirebase = async function() {
    try {
        const querySnapshot = await getDocs(collection(db, "productos"));
        const productos = [];
        querySnapshot.forEach((doc) => {
            productos.push({ id: doc.id, ...doc.data() });
        });
        console.log(`✅ Obtenidos ${productos.length} productos de Firebase`);
        return productos;
    } catch (error) {
        console.error("❌ Error obteniendo productos: ", error);
        return [];
    }
};

// Función para escuchar productos en tiempo real
window.escucharProductosTiempoReal = function() {
    try {
        console.log('👂 INICIANDO ESCUCHA EN TIEMPO REAL DE PRODUCTOS...');
        
        // Usar una consulta más simple que funcione incluso sin productos
        const q = collection(db, "productos");
        
        const unsubscribe = onSnapshot(q, (querySnapshot) => {
            console.log('🔄 CAMBIOS DETECTADOS EN PRODUCTOS DE FIREBASE:', querySnapshot.size, 'productos');
            console.log('📊 Estado de la consulta:', querySnapshot.metadata.fromCache ? 'CACHE' : 'SERVER');
            const productos = [];
            querySnapshot.forEach((doc) => {
                const producto = { id: doc.id, ...doc.data() };
                productos.push(producto);
                console.log('📦 Producto recibido:', producto.producto, '-', producto.sede, '-', producto.cantidad, '- ID:', doc.id);
            });
            
            // Actualizar el inventario global
            if (window.inventario !== undefined) {
                // Convertir productos a formato de inventario
                const nuevoInventario = {};
                productos.forEach(producto => {
                    const clave = `${producto.producto}_${producto.sede}`;
                    nuevoInventario[clave] = {
                        producto: producto.producto,
                        cantidad: producto.cantidad,
                        sede: producto.sede,
                        lote: producto.lote || '',
                        fechaVencimiento: producto.fechaVencimiento || '',
                        diasRestantes: producto.diasRestantes || 0
                    };
                });
                
                window.inventario = nuevoInventario;
                console.log(`✅ INVENTARIO ACTUALIZADO CON ${Object.keys(nuevoInventario).length} PRODUCTOS`);
                
                // Guardar en localStorage
                localStorage.setItem('inventario', JSON.stringify(nuevoInventario));
                console.log('💾 Inventario guardado en localStorage');
                
                // Actualizar la interfaz de stock siempre que haya cambios
                if (window.mostrarStockActual) {
                    console.log('🔄 Actualizando interfaz de stock...');
                    window.mostrarStockActual();
                } else {
                    console.log('⚠️ Función mostrarStockActual no disponible');
                }
                
                // Mostrar notificación de sincronización
                if (window.mostrarMensaje) {
                    window.mostrarMensaje(`🔄 ${Object.keys(nuevoInventario).length} productos sincronizados`, 'info');
                }
            } else {
                console.log('⚠️ Variable inventario no está disponible aún');
            }
        }, (error) => {
            console.error('❌ ERROR EN ESCUCHA DE TIEMPO REAL DE PRODUCTOS:', error);
            console.error('❌ Código de error:', error.code);
            console.error('❌ Mensaje de error:', error.message);
            
            if (window.mostrarMensaje) {
                window.mostrarMensaje(`❌ Error en sincronización de productos: ${error.message}`, 'error');
            }
        });
        
        // Guardar la función de desuscripción
        window.unsubscribeProductos = unsubscribe;
        console.log('✅ ESCUCHA EN TIEMPO REAL DE PRODUCTOS CONFIGURADA');
        return unsubscribe;
    } catch (error) {
        console.error('❌ ERROR CONFIGURANDO ESCUCHA EN TIEMPO REAL DE PRODUCTOS:', error);
        return null;
    }
};

// Función para escuchar lotes en tiempo real
window.escucharLotesTiempoReal = function() {
    try {
        console.log('👂 INICIANDO ESCUCHA EN TIEMPO REAL DE LOTES...');
        
        const q = collection(db, "lotes");
        
        const unsubscribe = onSnapshot(q, (querySnapshot) => {
            console.log('🔄 CAMBIOS DETECTADOS EN LOTES DE FIREBASE:', querySnapshot.size, 'documentos');
            const lotes = {};
            querySnapshot.forEach((doc) => {
                const data = doc.data();
                lotes[data.clave] = data.lotes || [];
                console.log('📦 Lotes recibidos para:', data.clave, '-', data.lotes?.length || 0, 'lotes');
            });
            
            // Actualizar variable global de lotes
            if (window.lotes !== undefined) {
                window.lotes = lotes;
                console.log(`✅ LOTES ACTUALIZADOS CON ${Object.keys(lotes).length} PRODUCTOS`);
                
                // Guardar en localStorage
                localStorage.setItem('lotes', JSON.stringify(lotes));
                console.log('💾 Lotes guardados en localStorage');
                
                // Actualizar la interfaz de stock siempre que haya cambios
                if (window.mostrarStockActual) {
                    console.log('🔄 Actualizando interfaz de stock por cambios en lotes...');
                    window.mostrarStockActual();
                }
            } else {
                console.log('⚠️ Variable lotes no está disponible aún');
            }
        }, (error) => {
            console.error('❌ ERROR EN ESCUCHA DE TIEMPO REAL DE LOTES:', error);
            if (window.mostrarMensaje) {
                window.mostrarMensaje(`❌ Error en sincronización de lotes: ${error.message}`, 'error');
            }
        });
        
        // Guardar la función de desuscripción
        window.unsubscribeLotes = unsubscribe;
        console.log('✅ ESCUCHA EN TIEMPO REAL DE LOTES CONFIGURADA');
        return unsubscribe;
    } catch (error) {
        console.error('❌ ERROR CONFIGURANDO ESCUCHA EN TIEMPO REAL DE LOTES:', error);
        return null;
    }
};

// Función para escuchar fechas de vencimiento en tiempo real
window.escucharFechasVencimientoTiempoReal = function() {
    try {
        console.log('👂 INICIANDO ESCUCHA EN TIEMPO REAL DE FECHAS DE VENCIMIENTO...');
        
        const q = collection(db, "fechasVencimiento");
        
        const unsubscribe = onSnapshot(q, (querySnapshot) => {
            console.log('🔄 CAMBIOS DETECTADOS EN FECHAS DE VENCIMIENTO DE FIREBASE:', querySnapshot.size, 'documentos');
            const fechasVencimiento = {};
            querySnapshot.forEach((doc) => {
                const data = doc.data();
                fechasVencimiento[data.clave] = data.fechas || [];
                console.log('📅 Fechas de vencimiento recibidas para:', data.clave, '-', data.fechas?.length || 0, 'fechas');
            });
            
            // Actualizar variable global de fechas de vencimiento
            if (window.fechasVencimiento !== undefined) {
                window.fechasVencimiento = fechasVencimiento;
                console.log(`✅ FECHAS DE VENCIMIENTO ACTUALIZADAS CON ${Object.keys(fechasVencimiento).length} PRODUCTOS`);
                
                // Guardar en localStorage
                localStorage.setItem('fechasVencimiento', JSON.stringify(fechasVencimiento));
                console.log('💾 Fechas de vencimiento guardadas en localStorage');
                
                // Actualizar la interfaz de stock siempre que haya cambios
                if (window.mostrarStockActual) {
                    console.log('🔄 Actualizando interfaz de stock por cambios en fechas de vencimiento...');
                    window.mostrarStockActual();
                }
            } else {
                console.log('⚠️ Variable fechasVencimiento no está disponible aún');
            }
        }, (error) => {
            console.error('❌ ERROR EN ESCUCHA DE TIEMPO REAL DE FECHAS DE VENCIMIENTO:', error);
            
            // Solo mostrar mensaje de error si no es un problema de permisos conocido
            if (window.mostrarMensaje) {
                if (error.code === 'permission-denied' || error.message.includes('Missing or insufficient permissions')) {
                    // No mostrar mensaje de error para problemas de permisos conocidos
                    console.log('ℹ️ Escucha de fechas de vencimiento deshabilitada por permisos de Firebase');
                } else {
                    window.mostrarMensaje(`❌ Error en sincronización de fechas de vencimiento: ${error.message}`, 'error');
                }
            }
        });
        
        // Guardar la función de desuscripción
        window.unsubscribeFechasVencimiento = unsubscribe;
        console.log('✅ ESCUCHA EN TIEMPO REAL DE FECHAS DE VENCIMIENTO CONFIGURADA');
        return unsubscribe;
    } catch (error) {
        console.error('❌ ERROR CONFIGURANDO ESCUCHA EN TIEMPO REAL DE FECHAS DE VENCIMIENTO:', error);
        return null;
    }
};

// Función para actualizar producto en Firebase
window.actualizarProductoFirebase = async function(productoId, datosActualizados) {
    try {
        const productoRef = doc(db, "productos", productoId);
        await updateDoc(productoRef, {
            ...datosActualizados,
            ultimaActualizacion: new Date().toISOString()
        });
        console.log("✅ Producto actualizado con ID: ", productoId);
        
        // Actualizar localStorage también
        const productos = JSON.parse(localStorage.getItem('productos') || '[]');
        const index = productos.findIndex(p => p.id === productoId);
        if (index !== -1) {
            productos[index] = { ...productos[index], ...datosActualizados, ultimaActualizacion: new Date().toISOString() };
            localStorage.setItem('productos', JSON.stringify(productos));
        }
        
    } catch (error) {
        console.error("❌ Error actualizando producto: ", error);
        throw error;
    }
};

// Función para eliminar producto de Firebase
window.eliminarProductoFirebase = async function(productoId) {
    try {
        await deleteDoc(doc(db, "productos", productoId));
        console.log("✅ Producto eliminado con ID: ", productoId);
        
        // Actualizar localStorage también
        const productos = JSON.parse(localStorage.getItem('productos') || '[]');
        const productosFiltrados = productos.filter(p => p.id !== productoId);
        localStorage.setItem('productos', JSON.stringify(productosFiltrados));
        
    } catch (error) {
        console.error("❌ Error eliminando producto: ", error);
        throw error;
    }
};

// ==================== FUNCIONES PARA SEDES ====================

// Función para agregar sede a Firebase
window.agregarSedeFirebase = async function(sede) {
    try {
        const docRef = await addDoc(collection(db, "sedes"), {
            ...sede,
            fechaCreacion: new Date().toISOString()
        });
        console.log("✅ Sede agregada con ID: ", docRef.id);
        
        // Actualizar localStorage también
        const sedes = JSON.parse(localStorage.getItem('sedes') || '[]');
        sedes.push({ id: docRef.id, ...sede, fechaCreacion: new Date().toISOString() });
        localStorage.setItem('sedes', JSON.stringify(sedes));
        
        return docRef.id;
    } catch (error) {
        console.error("❌ Error agregando sede: ", error);
        throw error;
    }
};

// Función para obtener sedes de Firebase
window.obtenerSedesFirebase = async function() {
    try {
        const querySnapshot = await getDocs(collection(db, "sedes"));
        const sedes = [];
        querySnapshot.forEach((doc) => {
            sedes.push({ id: doc.id, ...doc.data() });
        });
        console.log(`✅ Obtenidas ${sedes.length} sedes de Firebase`);
        return sedes;
    } catch (error) {
        console.error("❌ Error obteniendo sedes: ", error);
        return [];
    }
};

// Función para obtener lotes de Firebase
window.obtenerLotesFirebase = async function() {
    try {
        const querySnapshot = await getDocs(collection(db, "lotes"));
        const lotes = {};
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            lotes[data.clave] = data.lotes || [];
        });
        console.log(`✅ Obtenidos lotes de Firebase para ${Object.keys(lotes).length} productos`);
        return lotes;
    } catch (error) {
        console.error("❌ Error obteniendo lotes: ", error);
        return {};
    }
};

// Función para obtener fechas de vencimiento de Firebase
window.obtenerFechasVencimientoFirebase = async function() {
    try {
        const querySnapshot = await getDocs(collection(db, "fechasVencimiento"));
        const fechasVencimiento = {};
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            fechasVencimiento[data.clave] = data.fechas || [];
        });
        console.log(`✅ Obtenidas fechas de vencimiento de Firebase para ${Object.keys(fechasVencimiento).length} productos`);
        return fechasVencimiento;
    } catch (error) {
        console.error("❌ Error obteniendo fechas de vencimiento: ", error);
        return {};
    }
};

// Función para guardar lotes en Firebase
window.guardarLotesFirebase = async function(clave, lotesArray) {
    try {
        console.log(`🔥 Intentando guardar lotes para ${clave}...`);
        
        // Verificar que setDoc esté disponible
        if (typeof setDoc === 'undefined') {
            throw new Error('setDoc no está disponible. Verifica las importaciones de Firebase.');
        }
        
        // Verificar autenticación
        if (!auth.currentUser) {
            console.warn('⚠️ Usuario no autenticado, intentando autenticación anónima...');
            await signInAnonymously(auth);
        }
        
        const docRef = doc(db, "lotes", clave);
        await setDoc(docRef, {
            clave: clave,
            lotes: lotesArray,
            timestamp: new Date()
        });
        console.log(`✅ Lotes guardados en Firebase para ${clave}`);
        return docRef.id;
    } catch (error) {
        console.error("❌ Error guardando lotes: ", error);
        console.error("❌ Código de error:", error.code);
        console.error("❌ Mensaje de error:", error.message);
        
        // Solo mostrar mensaje de error si no es un problema de permisos conocido
        if (window.mostrarMensaje) {
            if (error.code === 'permission-denied' || error.message.includes('Missing or insufficient permissions')) {
                // No mostrar mensaje de error para problemas de permisos conocidos
                console.log('ℹ️ Sincronización de lotes deshabilitada por permisos de Firebase');
            } else if (error.message.includes('setDoc')) {
                window.mostrarMensaje('❌ Error de configuración: setDoc no está disponible', 'error');
            } else {
                window.mostrarMensaje(`❌ Error en sincronización de lotes: ${error.message}`, 'error');
            }
        }
        
        throw error;
    }
};

// Función para guardar fechas de vencimiento en Firebase
window.guardarFechasVencimientoFirebase = async function(clave, fechasArray) {
    try {
        console.log(`🔥 Intentando guardar fechas de vencimiento para ${clave}...`);
        
        // Verificar que setDoc esté disponible
        if (typeof setDoc === 'undefined') {
            throw new Error('setDoc no está disponible. Verifica las importaciones de Firebase.');
        }
        
        // Verificar autenticación
        if (!auth.currentUser) {
            console.warn('⚠️ Usuario no autenticado, intentando autenticación anónima...');
            await signInAnonymously(auth);
        }
        
        const docRef = doc(db, "fechasVencimiento", clave);
        await setDoc(docRef, {
            clave: clave,
            fechas: fechasArray,
            timestamp: new Date()
        });
        console.log(`✅ Fechas de vencimiento guardadas en Firebase para ${clave}`);
        return docRef.id;
    } catch (error) {
        console.error("❌ Error guardando fechas de vencimiento: ", error);
        console.error("❌ Código de error:", error.code);
        console.error("❌ Mensaje de error:", error.message);
        
        // Solo mostrar mensaje de error si no es un problema de permisos conocido
        if (window.mostrarMensaje) {
            if (error.code === 'permission-denied' || error.message.includes('Missing or insufficient permissions')) {
                // No mostrar mensaje de error para problemas de permisos conocidos
                console.log('ℹ️ Sincronización de fechas de vencimiento deshabilitada por permisos de Firebase');
            } else if (error.message.includes('setDoc')) {
                window.mostrarMensaje('❌ Error de configuración: setDoc no está disponible', 'error');
            } else {
                window.mostrarMensaje(`❌ Error en sincronización: ${error.message}`, 'error');
            }
        }
        
        throw error;
    }
};

// ==================== FUNCIONES DE SINCRONIZACIÓN ====================

// Función para sincronizar datos locales con Firebase
window.sincronizarConFirebase = async function() {
    try {
        console.log('🔄 Iniciando sincronización con Firebase...');
        actualizarIndicadorFirebase('syncing', 'Sincronizando datos con Firebase...');
        
        // Obtener datos de Firebase
        const movimientosFirebase = await obtenerMovimientosFirebase();
        const productosFirebase = await obtenerProductosFirebase();
        const sedesFirebase = await obtenerSedesFirebase();

        // Obtener lotes y fechas de vencimiento de Firebase
        const lotesFirebase = await obtenerLotesFirebase();
        const fechasVencimientoFirebase = await obtenerFechasVencimientoFirebase();

        // Actualizar localStorage con datos de Firebase
        localStorage.setItem('historial', JSON.stringify(movimientosFirebase));
        localStorage.setItem('productos', JSON.stringify(productosFirebase));
        localStorage.setItem('sedes', JSON.stringify(sedesFirebase));
        localStorage.setItem('lotes', JSON.stringify(lotesFirebase));
        localStorage.setItem('fechasVencimiento', JSON.stringify(fechasVencimientoFirebase));

        // Actualizar variables globales si están disponibles
        if (window.historial !== undefined) {
            window.historial = movimientosFirebase;
        }
        
        if (window.inventario !== undefined) {
            // Convertir productos a formato de inventario
            const nuevoInventario = {};
            productosFirebase.forEach(producto => {
                const clave = `${producto.producto}_${producto.sede}`;
                nuevoInventario[clave] = {
                    producto: producto.producto,
                    cantidad: producto.cantidad,
                    sede: producto.sede,
                    lote: producto.lote || '',
                    fechaVencimiento: producto.fechaVencimiento || '',
                    diasRestantes: producto.diasRestantes || 0
                };
            });
            window.inventario = nuevoInventario;
        }

        console.log('✅ Datos sincronizados con Firebase');
        actualizarIndicadorFirebase('connected', 'Datos sincronizados con Firebase');
        
        // Verificar si hay productos en Firebase
        const cantidadProductos = await window.verificarProductosFirebase();
        
        // Iniciar escuchas en tiempo real
        if (window.escucharMovimientosTiempoReal) {
            window.escucharMovimientosTiempoReal();
        }
        
        if (window.escucharProductosTiempoReal) {
            window.escucharProductosTiempoReal();
        }
        
        // Deshabilitar temporalmente la escucha de lotes para evitar errores de permisos
        // if (window.escucharLotesTiempoReal) {
        //     window.escucharLotesTiempoReal();
        // }
        console.log('ℹ️ Escucha de lotes deshabilitada temporalmente');
        
        // Deshabilitar temporalmente la escucha de fechas de vencimiento para evitar errores de permisos
        // if (window.escucharFechasVencimientoTiempoReal) {
        //     window.escucharFechasVencimientoTiempoReal();
        // }
        console.log('ℹ️ Escucha de fechas de vencimiento deshabilitada temporalmente');
        
        // Mostrar notificación de éxito
        if (cantidadProductos === 0) {
            mostrarNotificacionFirebase('Sincronización activada. Haz un movimiento para crear productos automáticamente.', 'warning');
        } else {
            mostrarNotificacionFirebase(`Datos sincronizados y escucha en tiempo real activada (${cantidadProductos} productos)`, 'success');
        }
        
        return true;
    } catch (error) {
        console.error('❌ Error sincronizando con Firebase:', error);
        actualizarIndicadorFirebase('disconnected', 'Error de sincronización - Modo local');
        mostrarNotificacionFirebase('Error de sincronización con Firebase', 'error');
        return false;
    }
};

// Función para migrar datos locales a Firebase
window.migrarDatosAFirebase = async function() {
    try {
        console.log('🔄 Iniciando migración de datos locales a Firebase...');
        
        // Obtener datos locales
        const movimientosLocales = JSON.parse(localStorage.getItem('movimientos') || '[]');
        const productosLocales = JSON.parse(localStorage.getItem('productos') || '[]');
        const sedesLocales = JSON.parse(localStorage.getItem('sedes') || '[]');

        let movimientosMigrados = 0;
        let productosMigrados = 0;
        let sedesMigradas = 0;

        // Migrar movimientos
        for (const movimiento of movimientosLocales) {
            if (movimiento.id && !movimiento.id.startsWith('firebase_')) {
                await agregarMovimientoFirebase(movimiento);
                movimientosMigrados++;
            }
        }

        // Migrar productos
        for (const producto of productosLocales) {
            if (producto.id && !producto.id.startsWith('firebase_')) {
                await agregarProductoFirebase(producto);
                productosMigrados++;
            }
        }

        // Migrar sedes
        for (const sede of sedesLocales) {
            if (sede.id && !sede.id.startsWith('firebase_')) {
                await agregarSedeFirebase(sede);
                sedesMigradas++;
            }
        }

        console.log(`✅ Migración completada: ${movimientosMigrados} movimientos, ${productosMigrados} productos, ${sedesMigradas} sedes`);
        return true;
    } catch (error) {
        console.error('❌ Error en migración:', error);
        return false;
    }
};

// ==================== FUNCIONES DE UTILIDAD ====================

// Función para verificar conexión con Firebase
window.verificarConexionFirebase = async function() {
    try {
        console.log('🔍 VERIFICANDO CONEXIÓN CON FIREBASE...');
        const testDoc = await addDoc(collection(db, "test"), {
            timestamp: new Date().toISOString(),
            test: true
        });
        await deleteDoc(doc(db, "test", testDoc.id));
        console.log('✅ CONEXIÓN CON FIREBASE VERIFICADA');
        return true;
    } catch (error) {
        console.error('❌ ERROR DE CONEXIÓN CON FIREBASE:', error);
        console.error('❌ Código de error:', error.code);
        console.error('❌ Mensaje de error:', error.message);
        return false;
    }
};

// Función para debugging completo de Firebase
window.debugFirebase = async function() {
    console.log('🔍 === DEBUG COMPLETO DE FIREBASE ===');
    
    // Verificar autenticación
    console.log('👤 Usuario autenticado:', auth.currentUser ? auth.currentUser.uid : 'No autenticado');
    
    // Verificar conexión
    const conectado = await verificarConexionFirebase();
    console.log('🌐 Conexión a Firebase:', conectado ? '✅ Conectado' : '❌ Desconectado');
    
    // Verificar movimientos en Firebase
    try {
        const movimientos = await obtenerMovimientosFirebase();
        console.log('📋 Movimientos en Firebase:', movimientos.length);
        movimientos.forEach((mov, index) => {
            console.log(`  ${index + 1}. ${mov.producto} - ${mov.tipo} - ${mov.fecha}`);
        });
    } catch (error) {
        console.error('❌ Error obteniendo movimientos:', error);
    }
    
    // Verificar productos en Firebase
    try {
        const productos = await obtenerProductosFirebase();
        console.log('📦 Productos en Firebase:', productos.length);
        productos.forEach((prod, index) => {
            console.log(`  ${index + 1}. ${prod.producto} - ${prod.sede} - ${prod.cantidad}`);
        });
    } catch (error) {
        console.error('❌ Error obteniendo productos:', error);
    }
    
    // Verificar datos locales
    const movimientosLocales = JSON.parse(localStorage.getItem('historial') || '[]');
    const inventarioLocal = JSON.parse(localStorage.getItem('inventario') || '{}');
    console.log('💾 Movimientos locales:', movimientosLocales.length);
    console.log('💾 Productos en inventario local:', Object.keys(inventarioLocal).length);
    
    // Verificar variable inventario global
    if (window.inventario !== undefined) {
        console.log('🌐 Variable inventario global:', Object.keys(window.inventario).length, 'productos');
        Object.keys(window.inventario).forEach(clave => {
            const producto = window.inventario[clave];
            console.log(`  - ${clave}: ${producto.cantidad} unidades`);
        });
    } else {
        console.log('⚠️ Variable inventario global no está disponible');
    }
    
    // Verificar si hay escuchas activas
    console.log('👂 Escucha de movimientos activa:', window.unsubscribeMovimientos ? '✅ Sí' : '❌ No');
    console.log('👂 Escucha de productos activa:', window.unsubscribeProductos ? '✅ Sí' : '❌ No');
    
    console.log('🔍 === FIN DEBUG FIREBASE ===');
    
    return {
        autenticado: !!auth.currentUser,
        conectado,
        movimientosFirebase: (await obtenerMovimientosFirebase()).length,
        productosFirebase: (await obtenerProductosFirebase()).length,
        movimientosLocales: movimientosLocales.length,
        inventarioLocal: Object.keys(inventarioLocal).length,
        inventarioGlobal: window.inventario ? Object.keys(window.inventario).length : 0,
        escuchaMovimientos: !!window.unsubscribeMovimientos,
        escuchaProductos: !!window.unsubscribeProductos
    };
};

// Función para limpiar datos de prueba
window.limpiarDatosPrueba = async function() {
    try {
        console.log('🧹 Limpiando datos de prueba...');
        
        // Obtener todos los documentos de prueba
        const movimientos = await getDocs(collection(db, "movimientos"));
        const productos = await getDocs(collection(db, "productos"));
        const sedes = await getDocs(collection(db, "sedes"));
        
        // Eliminar movimientos de prueba
        for (const doc of movimientos.docs) {
            if (doc.data().producto && doc.data().producto.includes('PRUEBA')) {
                await deleteDoc(doc.ref);
            }
        }
        
        // Eliminar productos de prueba
        for (const doc of productos.docs) {
            if (doc.data().producto && doc.data().producto.includes('PRUEBA')) {
                await deleteDoc(doc.ref);
            }
        }
        
        console.log('✅ Datos de prueba eliminados');
        return true;
    } catch (error) {
        console.error('❌ Error limpiando datos de prueba:', error);
        return false;
    }
};

// Función para restablecer inventario completo en Firebase
window.restablecerInventarioFirebase = async function() {
    try {
        console.log('🔄 RESTABLECIENDO INVENTARIO COMPLETO EN FIREBASE...');
        
        // Eliminar todos los productos de Firebase
        const productosSnapshot = await getDocs(collection(db, "productos"));
        console.log(`📦 Eliminando ${productosSnapshot.size} productos de Firebase...`);
        
        for (const doc of productosSnapshot.docs) {
            await deleteDoc(doc.ref);
            console.log(`🗑️ Producto eliminado: ${doc.id}`);
        }
        
        // Eliminar todos los movimientos de Firebase
        const movimientosSnapshot = await getDocs(collection(db, "movimientos"));
        console.log(`📋 Eliminando ${movimientosSnapshot.size} movimientos de Firebase...`);
        
        for (const doc of movimientosSnapshot.docs) {
            await deleteDoc(doc.ref);
            console.log(`🗑️ Movimiento eliminado: ${doc.id}`);
        }
        
        console.log('✅ INVENTARIO RESTABLECIDO EN FIREBASE');
        
        // Mostrar notificación
        if (window.mostrarMensaje) {
            window.mostrarMensaje('✅ Inventario restablecido en Firebase y sincronizado', 'exito');
        }
        
        return true;
    } catch (error) {
        console.error('❌ ERROR RESTABLECIENDO INVENTARIO EN FIREBASE:', error);
        console.error('❌ Detalles del error:', error.message, error.code);
        
        if (window.mostrarMensaje) {
            window.mostrarMensaje(`❌ Error restableciendo inventario: ${error.message}`, 'error');
        }
        
        return false;
    }
};

// Función para restablecer solo productos (mantener movimientos)
window.restablecerProductosFirebase = async function() {
    try {
        console.log('🔄 RESTABLECIENDO SOLO PRODUCTOS EN FIREBASE...');
        
        // Eliminar todos los productos de Firebase
        const productosSnapshot = await getDocs(collection(db, "productos"));
        console.log(`📦 Eliminando ${productosSnapshot.size} productos de Firebase...`);
        
        for (const doc of productosSnapshot.docs) {
            await deleteDoc(doc.ref);
            console.log(`🗑️ Producto eliminado: ${doc.id}`);
        }
        
        console.log('✅ PRODUCTOS RESTABLECIDOS EN FIREBASE');
        
        // Mostrar notificación
        if (window.mostrarMensaje) {
            window.mostrarMensaje('✅ Productos restablecidos en Firebase y sincronizados', 'exito');
        }
        
        return true;
    } catch (error) {
        console.error('❌ ERROR RESTABLECIENDO PRODUCTOS EN FIREBASE:', error);
        console.error('❌ Detalles del error:', error.message, error.code);
        
        if (window.mostrarMensaje) {
            window.mostrarMensaje(`❌ Error restableciendo productos: ${error.message}`, 'error');
        }
        
        return false;
    }
};

// Función para verificar y crear productos de prueba en Firebase
window.verificarProductosFirebase = async function() {
    try {
        console.log('🔍 VERIFICANDO PRODUCTOS EN FIREBASE...');
        
        const productosSnapshot = await getDocs(collection(db, "productos"));
        console.log(`📦 Productos encontrados en Firebase: ${productosSnapshot.size}`);
        
        if (productosSnapshot.size === 0) {
            console.log('⚠️ No hay productos en Firebase. Esto puede causar problemas de sincronización.');
            console.log('💡 Haz un movimiento (entrada, salida o devolución) para crear productos automáticamente.');
            
            // Mostrar notificación informativa
            if (window.mostrarMensaje) {
                window.mostrarMensaje('⚠️ No hay productos en Firebase. Haz un movimiento para crear productos automáticamente.', 'warning');
            }
        } else {
            console.log('✅ Productos encontrados en Firebase:');
            productosSnapshot.forEach((doc) => {
                const producto = doc.data();
                console.log(`  - ${producto.producto} (${producto.sede}): ${producto.cantidad} unidades`);
            });
        }
        
        return productosSnapshot.size;
    } catch (error) {
        console.error('❌ Error verificando productos en Firebase:', error);
        return 0;
    }
};

// Función para debug del inventario
window.debugInventario = async function() {
    try {
        console.log('🔍 === DEBUG INVENTARIO ===');
        
        // Verificar inventario local
        console.log('📦 INVENTARIO LOCAL:');
        console.log('  - Variable window.inventario:', window.inventario ? Object.keys(window.inventario).length + ' productos' : 'NO DEFINIDA');
        if (window.inventario) {
            Object.entries(window.inventario).forEach(([clave, producto]) => {
                console.log(`    ${clave}: ${producto.cantidad} unidades`);
            });
        }
        
        // Verificar localStorage
        const inventarioLocalStorage = localStorage.getItem('inventario');
        console.log('💾 LOCALSTORAGE:');
        if (inventarioLocalStorage) {
            const inventarioLS = JSON.parse(inventarioLocalStorage);
            console.log('  - Productos en localStorage:', Object.keys(inventarioLS).length);
        } else {
            console.log('  - No hay inventario en localStorage');
        }
        
        // Verificar Firebase
        console.log('🔥 FIREBASE:');
        const productosSnapshot = await getDocs(collection(db, "productos"));
        console.log('  - Productos en Firebase:', productosSnapshot.size);
        if (productosSnapshot.size === 0) {
            console.log('  ⚠️ NO HAY PRODUCTOS EN FIREBASE - Esto puede causar problemas de sincronización');
            console.log('  💡 Haz un movimiento para crear productos automáticamente');
        } else {
            productosSnapshot.forEach((doc) => {
                const producto = doc.data();
                console.log(`    ${doc.id}: ${producto.producto} - ${producto.sede} - ${producto.cantidad}`);
            });
        }
        
        // Verificar escuchas activas
        console.log('👂 ESCUCHAS ACTIVAS:');
        console.log('  - Escucha movimientos:', !!window.unsubscribeMovimientos);
        console.log('  - Escucha productos:', !!window.unsubscribeProductos);
        
        // Verificar función mostrarStockActual
        console.log('🔄 FUNCIONES:');
        console.log('  - mostrarStockActual disponible:', !!window.mostrarStockActual);
        
        console.log('🔍 === FIN DEBUG INVENTARIO ===');
        
        return {
            inventarioLocal: window.inventario ? Object.keys(window.inventario).length : 0,
            inventarioLocalStorage: inventarioLocalStorage ? Object.keys(JSON.parse(inventarioLocalStorage)).length : 0,
            inventarioFirebase: productosSnapshot.size,
            escuchasActivas: {
                movimientos: !!window.unsubscribeMovimientos,
                productos: !!window.unsubscribeProductos
            }
        };
    } catch (error) {
        console.error('❌ Error en debug inventario:', error);
        return null;
    }
};

// ==================== INICIALIZACIÓN ====================

// Función para limpiar escuchas en tiempo real
window.limpiarEscuchasTiempoReal = function() {
    try {
        if (window.unsubscribeMovimientos) {
            window.unsubscribeMovimientos();
            console.log('✅ Escucha de movimientos detenida');
        }
        if (window.unsubscribeProductos) {
            window.unsubscribeProductos();
            console.log('✅ Escucha de productos detenida');
        }
        if (window.unsubscribeLotes) {
            window.unsubscribeLotes();
            console.log('✅ Escucha de lotes detenida');
        }
        if (window.unsubscribeFechasVencimiento) {
            window.unsubscribeFechasVencimiento();
            console.log('✅ Escucha de fechas de vencimiento detenida');
        }
        
        // Limpiar referencias
        window.unsubscribeMovimientos = null;
        window.unsubscribeProductos = null;
        window.unsubscribeLotes = null;
        window.unsubscribeFechasVencimiento = null;
        
        console.log('🧹 Todas las escuchas limpiadas');
    } catch (error) {
        console.error('❌ Error limpiando escuchas:', error);
    }
};

// Función para reiniciar sincronización
window.reiniciarSincronizacion = async function() {
    try {
        console.log('🔄 Reiniciando sincronización...');
        
        // Limpiar escuchas existentes
        limpiarEscuchasTiempoReal();
        
        // Esperar un momento
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Reiniciar sincronización
        await sincronizarConFirebase();
        
        console.log('✅ Sincronización reiniciada');
        return true;
    } catch (error) {
        console.error('❌ Error reiniciando sincronización:', error);
        return false;
    }
};

// Función para forzar actualización del inventario
window.actualizarInventarioDesdeFirebase = async function() {
    try {
        console.log('🔄 Forzando actualización del inventario desde Firebase...');
        
        // Obtener productos de Firebase
        const productos = await obtenerProductosFirebase();
        console.log(`📦 Obtenidos ${productos.length} productos de Firebase`);
        
        // Convertir a formato de inventario
        const nuevoInventario = {};
        productos.forEach(producto => {
            const clave = `${producto.producto}_${producto.sede}`;
            nuevoInventario[clave] = {
                producto: producto.producto,
                cantidad: producto.cantidad,
                sede: producto.sede,
                lote: producto.lote || '',
                fechaVencimiento: producto.fechaVencimiento || '',
                diasRestantes: producto.diasRestantes || 0
            };
            console.log(`📦 Producto procesado: ${producto.producto} - ${producto.sede} - ${producto.cantidad}`);
        });
        
        // Actualizar variable global
        if (window.inventario !== undefined) {
            window.inventario = nuevoInventario;
            console.log(`✅ Inventario global actualizado con ${Object.keys(nuevoInventario).length} productos`);
        }
        
        // Guardar en localStorage
        localStorage.setItem('inventario', JSON.stringify(nuevoInventario));
        console.log('💾 Inventario guardado en localStorage');
        
        // Actualizar interfaz
        if (window.mostrarStockActual) {
            window.mostrarStockActual();
            console.log('🔄 Interfaz de stock actualizada');
        }
        
        // Mostrar notificación
        if (window.mostrarMensaje) {
            window.mostrarMensaje(`✅ Inventario actualizado: ${Object.keys(nuevoInventario).length} productos`, 'exito');
        }
        
        return true;
    } catch (error) {
        console.error('❌ Error actualizando inventario desde Firebase:', error);
        if (window.mostrarMensaje) {
            window.mostrarMensaje(`❌ Error actualizando inventario: ${error.message}`, 'error');
        }
        return false;
    }
};

// Función para forzar sincronización completa del inventario
window.forzarSincronizacionInventario = async function() {
    try {
        console.log('🔄 FORZANDO SINCRONIZACIÓN COMPLETA DEL INVENTARIO...');
        
        // Detener escuchas actuales
        if (window.unsubscribeProductos) {
            window.unsubscribeProductos();
            console.log('⏹️ Escucha de productos detenida');
        }
        
        // Esperar un momento
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Actualizar desde Firebase
        await window.actualizarInventarioDesdeFirebase();
        
        // Reiniciar escucha en tiempo real
        window.escucharProductosTiempoReal();
        console.log('👂 Escucha de productos reiniciada');
        
        // Mostrar notificación
        if (window.mostrarMensaje) {
            window.mostrarMensaje('✅ Sincronización de inventario completada', 'exito');
        }
        
        return true;
    } catch (error) {
        console.error('❌ Error forzando sincronización:', error);
        if (window.mostrarMensaje) {
            window.mostrarMensaje(`❌ Error en sincronización: ${error.message}`, 'error');
        }
        return false;
    }
};

        // Inicializar cuando la página esté lista
        document.addEventListener('DOMContentLoaded', function() {
            console.log('🚀 Inicializando Firebase...');
            
            // Verificar conexión
            verificarConexionFirebase().then((conectado) => {
                if (conectado) {
                    // Verificar si hay datos locales para migrar
                    const movimientosLocales = JSON.parse(localStorage.getItem('historial') || '[]');
                    if (movimientosLocales.length > 0) {
                        console.log('📦 Datos locales encontrados, iniciando migración...');
                        migrarDatosAFirebase().then(() => {
                            console.log('✅ Migración completada, sincronizando...');
                            sincronizarConFirebase();
                        });
                    } else {
                        console.log('🔄 Sincronizando con Firebase...');
                        sincronizarConFirebase();
                    }
                } else {
                    console.log('⚠️ Usando modo offline (datos locales)');
                }
            });
            
            // Sincronización automática al cargar la página
            setTimeout(() => {
                if (window.sincronizarConFirebase) {
                    console.log('🔄 Sincronización automática al cargar página...');
                    sincronizarConFirebase();
                }
            }, 2000); // Esperar 2 segundos para que todo esté listo
        });

// Exportar para uso global
window.FirebaseConfig = {
    db,
    auth,
    app,
    config: firebaseConfig
};

// Función para diagnosticar problemas de Firebase
window.diagnosticarFirebase = async function() {
    try {
        console.log('🔍 === DIAGNÓSTICO COMPLETO DE FIREBASE ===');
        
        // 1. Verificar importaciones
        console.log('📦 Verificando importaciones...');
        console.log('  - setDoc disponible:', typeof setDoc !== 'undefined');
        console.log('  - doc disponible:', typeof doc !== 'undefined');
        console.log('  - addDoc disponible:', typeof addDoc !== 'undefined');
        console.log('  - db disponible:', typeof db !== 'undefined');
        console.log('  - auth disponible:', typeof auth !== 'undefined');
        
        // 2. Verificar autenticación
        console.log('👤 Verificando autenticación...');
        console.log('  - Usuario actual:', auth.currentUser ? auth.currentUser.uid : 'No autenticado');
        console.log('  - Estado de autenticación:', auth.currentUser ? 'Autenticado' : 'No autenticado');
        
        // 3. Verificar conexión
        console.log('🌐 Verificando conexión...');
        try {
            const testDoc = await addDoc(collection(db, "test"), {
                timestamp: new Date().toISOString(),
                test: true
            });
            await deleteDoc(doc(db, "test", testDoc.id));
            console.log('  - Conexión: ✅ Funcionando');
        } catch (error) {
            console.log('  - Conexión: ❌ Error:', error.message);
        }
        
        // 4. Verificar permisos en colecciones específicas
        console.log('🔐 Verificando permisos...');
        
        // Probar fechasVencimiento
        try {
            const testDoc = doc(db, "fechasVencimiento", "test");
            await setDoc(testDoc, { test: true });
            await deleteDoc(testDoc);
            console.log('  - fechasVencimiento: ✅ Permisos OK');
        } catch (error) {
            console.log('  - fechasVencimiento: ❌ Error:', error.message, error.code);
        }
        
        // Probar lotes
        try {
            const testDoc = doc(db, "lotes", "test");
            await setDoc(testDoc, { test: true });
            await deleteDoc(testDoc);
            console.log('  - lotes: ✅ Permisos OK');
        } catch (error) {
            console.log('  - lotes: ❌ Error:', error.message, error.code);
        }
        
        console.log('🔍 === FIN DIAGNÓSTICO ===');
        
        return {
            setDocDisponible: typeof setDoc !== 'undefined',
            autenticado: !!auth.currentUser,
            conexion: true // Se actualizará según el resultado del test
        };
        
    } catch (error) {
        console.error('❌ Error en diagnóstico:', error);
        return null;
    }
};

// Función para probar la sincronización de lotes
window.probarSincronizacionLotes = async function() {
    try {
        console.log('🧪 PROBANDO SINCRONIZACIÓN DE LOTES...');
        
        // Datos de prueba
        const clavePrueba = 'PRODUCTO_PRUEBA_LOTES_BODEGA_CENTRAL';
        const lotesPrueba = [
            {
                lote: 'LOTE001',
                cantidad: 100,
                fechaVencimiento: '2025-12-31',
                diasRestantes: 365,
                fechaEntrada: new Date().toISOString()
            },
            {
                lote: 'LOTE002',
                cantidad: 50,
                fechaVencimiento: '2025-11-30',
                diasRestantes: 335,
                fechaEntrada: new Date().toISOString()
            }
        ];
        
        // Probar guardar lotes
        console.log('📦 Guardando lotes de prueba...');
        const resultado = await window.guardarLotesFirebase(clavePrueba, lotesPrueba);
        console.log('✅ Lotes guardados exitosamente:', resultado);
        
        // Probar obtener lotes
        console.log('📦 Obteniendo lotes de prueba...');
        const lotesObtenidos = await window.obtenerLotesFirebase();
        console.log('✅ Lotes obtenidos:', lotesObtenidos[clavePrueba]);
        
        // Verificar que los datos coincidan
        if (lotesObtenidos[clavePrueba] && lotesObtenidos[clavePrueba].length === lotesPrueba.length) {
            console.log('✅ Los lotes se guardaron y recuperaron correctamente');
        } else {
            console.warn('⚠️ Los lotes no coinciden con los datos enviados');
        }
        
        // Limpiar datos de prueba
        console.log('🧹 Limpiando datos de prueba...');
        const docRef = doc(db, "lotes", clavePrueba);
        await deleteDoc(docRef);
        console.log('✅ Datos de prueba eliminados');
        
        // Mostrar notificación de éxito
        if (window.mostrarMensaje) {
            window.mostrarMensaje('✅ Sincronización de lotes funcionando correctamente', 'exito');
        }
        
        console.log('🎉 PRUEBA DE SINCRONIZACIÓN DE LOTES COMPLETADA EXITOSAMENTE');
        return true;
        
    } catch (error) {
        console.error('❌ ERROR EN PRUEBA DE SINCRONIZACIÓN DE LOTES:', error);
        console.error('❌ Detalles del error:', error.message, error.code);
        
        if (window.mostrarMensaje) {
            window.mostrarMensaje(`❌ Error en prueba de sincronización de lotes: ${error.message}`, 'error');
        }
        
        return false;
    }
};

// Función para probar la sincronización de fechas de vencimiento
window.probarSincronizacionFechasVencimiento = async function() {
    try {
        console.log('🧪 PROBANDO SINCRONIZACIÓN DE FECHAS DE VENCIMIENTO...');
        
        // Datos de prueba
        const clavePrueba = 'PRODUCTO_PRUEBA_BODEGA_CENTRAL';
        const fechasPrueba = [
            {
                lote: 'LOTE001',
                fecha: '2025-12-31',
                diasRestantes: 365,
                cantidad: 100,
                fechaEntrada: new Date().toISOString()
            }
        ];
        
        // Probar guardar fechas de vencimiento
        console.log('📅 Guardando fechas de vencimiento de prueba...');
        const resultado = await window.guardarFechasVencimientoFirebase(clavePrueba, fechasPrueba);
        console.log('✅ Fechas de vencimiento guardadas exitosamente:', resultado);
        
        // Probar obtener fechas de vencimiento
        console.log('📅 Obteniendo fechas de vencimiento de prueba...');
        const fechasObtenidas = await window.obtenerFechasVencimientoFirebase();
        console.log('✅ Fechas de vencimiento obtenidas:', fechasObtenidas[clavePrueba]);
        
        // Limpiar datos de prueba
        console.log('🧹 Limpiando datos de prueba...');
        const docRef = doc(db, "fechasVencimiento", clavePrueba);
        await deleteDoc(docRef);
        console.log('✅ Datos de prueba eliminados');
        
        // Mostrar notificación de éxito
        if (window.mostrarMensaje) {
            window.mostrarMensaje('✅ Sincronización de fechas de vencimiento funcionando correctamente', 'exito');
        }
        
        console.log('🎉 PRUEBA DE SINCRONIZACIÓN COMPLETADA EXITOSAMENTE');
        return true;
        
    } catch (error) {
        console.error('❌ ERROR EN PRUEBA DE SINCRONIZACIÓN:', error);
        console.error('❌ Detalles del error:', error.message, error.code);
        
        if (window.mostrarMensaje) {
            window.mostrarMensaje(`❌ Error en prueba de sincronización: ${error.message}`, 'error');
        }
        
        return false;
    }
};

// Función para verificar y configurar reglas de Firebase
window.verificarReglasFirebase = async function() {
    try {
        console.log('🔍 VERIFICANDO REGLAS DE FIREBASE...');
        
        // Probar escritura en diferentes colecciones
        const colecciones = ['movimientos', 'productos', 'lotes', 'fechasVencimiento'];
        const resultados = {};
        
        for (const coleccion of colecciones) {
            try {
                console.log(`📝 Probando escritura en ${coleccion}...`);
                const testDoc = await addDoc(collection(db, coleccion), {
                    test: true,
                    timestamp: new Date().toISOString()
                });
                await deleteDoc(doc(db, coleccion, testDoc.id));
                resultados[coleccion] = '✅ Permitido';
                console.log(`✅ ${coleccion}: Escritura permitida`);
            } catch (error) {
                resultados[coleccion] = `❌ Error: ${error.message}`;
                console.log(`❌ ${coleccion}: ${error.message}`);
            }
        }
        
        console.log('📊 RESULTADOS DE VERIFICACIÓN:');
        Object.entries(resultados).forEach(([coleccion, resultado]) => {
            console.log(`  ${coleccion}: ${resultado}`);
        });
        
        // Mostrar resumen
        const permitidas = Object.values(resultados).filter(r => r.includes('✅')).length;
        const total = colecciones.length;
        
        if (window.mostrarMensaje) {
            if (permitidas === total) {
                window.mostrarMensaje(`✅ Todas las colecciones permiten escritura (${permitidas}/${total})`, 'exito');
            } else {
                window.mostrarMensaje(`⚠️ Solo ${permitidas}/${total} colecciones permiten escritura`, 'warning');
            }
        }
        
        return resultados;
        
    } catch (error) {
        console.error('❌ Error verificando reglas:', error);
        if (window.mostrarMensaje) {
            window.mostrarMensaje(`❌ Error verificando reglas: ${error.message}`, 'error');
        }
        return null;
    }
};

console.log('🔥 Firebase configurado correctamente');
