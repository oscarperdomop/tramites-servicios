require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const crypto = require('crypto');
const axios = require('axios');
const xlsx = require('xlsx'); 

const app = express();
const PORT = process.env.PORT || 3000;

// ==========================================
// [PARCHE] DEFENSA ACTIVA (Antivirus / DDoS)
// ==========================================
// Proxy Trust para Ngrok/Reversos (Evita Crash de Rate-Limit por IP compartida)
app.set('trust proxy', 1);
app.use(helmet());

const limiter = rateLimit({
    windowMs: 1 * 60 * 1000, 
    max: 100, 
    message: 'Demasiadas peticiones desde esta IP, por favor inténtalo más tarde.'
});
app.use('/webhook', limiter);
app.use(express.json({ limit: '10kb' })); 

// ==========================================
// CARGA DE DATOS MEMORY-SAFE (O(1))
// ==========================================
function cargarBaseDeDatos() {
    try {
        const workbook = xlsx.readFile('base_datos.xlsx');
        const nombrePrimeraHoja = workbook.SheetNames[0];
        const datos = xlsx.utils.sheet_to_json(workbook.Sheets[nombrePrimeraHoja]);
        
        const mapaIndexado = new Map();
        
        for (const fila of datos) {
            const cedula = String(fila['Cédula / Nit']).trim();
            if (cedula) {
                if (!mapaIndexado.has(cedula)) {
                    mapaIndexado.set(cedula, []);
                }
                mapaIndexado.get(cedula).push(fila);
            }
        }
        
        console.log(`[SISTEMA] ✅ Base de datos Excel cargada e indexada en RAM (Elementos O(1)): ${mapaIndexado.size}`);
        return mapaIndexado;
    } catch (error) {
        console.warn("[CRÍTICO] ❌ Error leyendo 'base_datos.xlsx'. Actuando en modo Fallback.");
        return new Map();
    }
}

const baseDeDatosPredial = cargarBaseDeDatos();

// Módulo de Estado In-Memory (Sustituye la variable cruda {} para purgar RAM sola)
const gestorSesiones = new Map();

// ==========================================
// CONFIGURACIÓN DE RED (Meta) SECURE
// ==========================================
const TOKEN_META = process.env.TOKEN_META;
const PHONE_ID = process.env.PHONE_ID;

async function enviarMensaje(numeroDestino, textoRespuesta) {
    try {
        await axios({
            method: 'POST',
            url: `https://graph.facebook.com/v25.0/${PHONE_ID}/messages`,
            headers: {
                'Authorization': `Bearer ${TOKEN_META}`,
                'Content-Type': 'application/json'
            },
            data: {
                messaging_product: 'whatsapp',
                to: numeroDestino,
                type: 'text',
                text: { body: textoRespuesta }
            },
            timeout: 5000 // Bloquea Timeout Infinito
        });
        console.log(`[BOT -> ${numeroDestino}] ✉️ Emitido.`);
    } catch (error) {
        console.error("[CRÍTICO] ❌ Error de Salida:", error.message);
    }
}

// ==========================================
// ENDPOINT DE VERIFICACIÓN (GET)
// ==========================================
app.get('/webhook', (req, res) => {
    const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
    let mode = req.query['hub.mode'];
    let token = req.query['hub.verify_token'];
    let challenge = req.query['hub.challenge'];
    
    if (mode && token) {
        const safeCompare = (a, b) => {
            if (a.length !== b.length) return false;
            return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
        };

        if (mode === 'subscribe' && token.length === VERIFY_TOKEN.length && safeCompare(token, VERIFY_TOKEN)) {
            return res.status(200).send(challenge);
        } else {
            return res.sendStatus(403);
        }
    }
    return res.sendStatus(400);
});

// ==========================================
// ENRUTADOR POST Y MENÚ DE LÓGICA MÚLTIPLE
// ==========================================
app.post('/webhook', (req, res) => {
    res.sendStatus(200);

    try {
        let body = req.body;
        const messageData = body?.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
        
        if (messageData && messageData.type === 'text') {
            
            let mensajeUsuario = messageData.text.body;
            let numeroUsuario = messageData.from;

            if (typeof mensajeUsuario !== 'string') return;
            mensajeUsuario = mensajeUsuario.trim();
            if (mensajeUsuario.length === 0) return;

            console.log(`\n======================================`);
            console.log(`✉️ RECIBIDO: ${numeroUsuario} -> ${mensajeUsuario}`);
            console.log(`======================================`);

            let esSoloNumero = /^\d+$/.test(mensajeUsuario);
            const session = gestorSesiones.get(numeroUsuario);

            // [NUEVA GESTIÓN DE ESTADOS]: Control de búsqueda fallida
            if (session && session.estado === 'FALLIDO') {
                if (mensajeUsuario === "0") {
                    gestorSesiones.delete(numeroUsuario);
                    enviarMensaje(numeroUsuario, `¡Chat reiniciado! 👋\n\nPara consultar tu estado de cuenta predial, por favor digita tu número de documento (CC/NIT) sin puntos ni espacios (Ej: 35209411).`);
                    return;
                } else if (mensajeUsuario === "1") {
                    gestorSesiones.delete(numeroUsuario);
                    enviarMensaje(numeroUsuario, `🤖 Entendido. Por favor, digita el número de documento a consultar sin espacios ni puntos.`);
                    return;
                } else {
                    if (!session.advertido) {
                        session.advertido = true;
                        gestorSesiones.set(numeroUsuario, session);
                        enviarMensaje(numeroUsuario, `🤖 El documento ${session.cedula} no registra recibos pendientes actualmente o no se encuentra en nuestra base de datos.\n\nEscribe *1* para intentar con otro documento o *0* para reiniciar el chat.`);
                        return;
                    } else {
                        gestorSesiones.delete(numeroUsuario);
                        enviarMensaje(numeroUsuario, `🤖 Se ha detectado una respuesta inválida nuevamente. El chat ha sido terminado automáticamente. Que tengas un excelente día. 👋`);
                        return;
                    }
                }
            }

            // 1. REPETIR CONSULTA
            if (mensajeUsuario === "1") {
                enviarMensaje(numeroUsuario, `Para consultar, por favor digite su número de documento sin puntos ni espacios (Ej: 35209411).`);
            
            // 2. PORTAL DE PAGO
            } else if (mensajeUsuario === "2") {
                enviarMensaje(numeroUsuario, `💳 *Pago en línea PSE*\n\nPuedes realizar tu pago de forma rápida y segura ingresando al siguiente enlace oficial:\nhttps://www.psepagos.co/PSEHostingUI/ShowTicketOffice.aspx?ID=11297`);
            
            // 3. CONTACTO ASESOR (URL ENCODING)
            } else if (mensajeUsuario === "3") {
                let enlaceWhatsApp = "";

                if (session && session.nombre && session.cedula) {
                    let textoAsesor = `Hola mi nombre es ${session.nombre}, mi documento es ${session.cedula}, podrias enviarme mi recibo en PDF por favor.`;
                    enlaceWhatsApp = `https://wa.me/573228061144?text=${encodeURIComponent(textoAsesor)}`;
                } else {
                    let textoAsesor = `Hola, podrias enviarme mi recibo en PDF por favor.`;
                    enlaceWhatsApp = `https://wa.me/573228061144?text=${encodeURIComponent(textoAsesor)}`;
                }

                enviarMensaje(numeroUsuario, `📄 *Solicitud de Recibo en PDF*\n\nPor favor, haz clic en el siguiente enlace. Esto abrirá un chat directo con nuestro asesor de Hacienda con tu solicitud ya escrita:\n\n👉 ${enlaceWhatsApp}`);
            
            // 4. SALIDA
            } else if (mensajeUsuario === "4" || mensajeUsuario.toLowerCase() === "terminar") {
                enviarMensaje(numeroUsuario, `¡Gracias por comunicarte con la Secretaría de Hacienda! Que tengas un excelente día. 👋`);
                gestorSesiones.delete(numeroUsuario); // Limpiamos Memoria
            
            // BÚSQUEDA DE BASE DE DATOS EXCEL
            } else if (esSoloNumero && mensajeUsuario.length >= 5 && mensajeUsuario.length <= 15) {
                
                // [Optimizacion O(1)] Reemplazo de .find por Map Array
                let registrosUsuario = baseDeDatosPredial.get(mensajeUsuario);
                
                if (registrosUsuario && registrosUsuario.length > 0) {
                    // Refinamiento Visual y Acumulación Financiera (Multi-Predio)
                    let nombre = String(registrosUsuario[0]['Propietario'] || 'Contribuyente').trim();
                    let cantidadPredios = registrosUsuario.length;
                    
                    let totalPagar = 0;
                    
                    // Ensamblado detallado por cada predio
                    let detallePredios = registrosUsuario.map((reg, index) => {
                        let direccion = String(reg['Direccion'] || 'Sin dirección registrada').trim();
                        let valorPredio = Number(reg['TOTAL']);
                        valorPredio = isNaN(valorPredio) ? 0 : valorPredio;
                        totalPagar += valorPredio; // Suma al acumulado
                        
                        let formatPredio = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 }).format(valorPredio);
                        return `🏠 *Predio ${index + 1}*\n📍 Dir: ${direccion}\n💰 Valor: *$${formatPredio}*`;
                    }).join('\n\n');
                    
                    // Formato Moneda Limpio (Sin Decimales) para Total Acumulado
                    let totalFormateado = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 }).format(totalPagar);

                    // Almacenar el historial de la sesión
                    gestorSesiones.set(numeroUsuario, { estado: 'EXITOSO', nombre: nombre, cedula: mensajeUsuario });

                    // Auto-limpieza por Garbage Collector en 15 Minutos para evitar Leaks
                    setTimeout(() => {
                        if (gestorSesiones.has(numeroUsuario)) {
                            gestorSesiones.delete(numeroUsuario);
                            console.log(`[OPSEC] Memoria liberada de ${numeroUsuario} tras inactividad.`);
                        }
                    }, 15 * 60 * 1000);

                    let textoPredios = cantidadPredios > 1 ? `en sus *${cantidadPredios} predios*` : `de Impuesto Predial`;

                    let mensajeRespuesta = 
`🤖 Hola, 
*${nombre}*.

El documento consultado presenta un saldo pendiente ${textoPredios} por un valor total acumulado de *$${totalFormateado}*.

${detallePredios}

Este valor ya incluye el descuento especial por pronto pago, válido hasta el *30 de abril*. 

Puede pasar por las oficinas de la Secretaría de Hacienda en la Alcaldía para reclamar sus recibos físicos.

*¿Qué deseas hacer ahora?*
1️⃣ Enviar el número *1* para volver a consultar.
2️⃣ Enviar el número *2* para Link de pago PSE.
3️⃣ Enviar el número *3* para solicitar tu recibo en PDF.
4️⃣ Enviar el número *4* para terminar el chat.`;

                    enviarMensaje(numeroUsuario, mensajeRespuesta);
                } else {
                    enviarMensaje(numeroUsuario, `🤖 El documento ${mensajeUsuario} no registra recibos pendientes actualmente o no se encuentra en nuestra base de datos.\n\nEscribe *1* para intentar con otro documento o *0* para reiniciar el chat.`);
                    
                    // Bloqueo de Estado Fallido
                    gestorSesiones.set(numeroUsuario, { estado: 'FALLIDO', cedula: mensajeUsuario, advertido: false });
                    
                    setTimeout(() => {
                        if (gestorSesiones.has(numeroUsuario)) gestorSesiones.delete(numeroUsuario);
                    }, 15 * 60 * 1000);
                }
            
            // CASO POR DEFECTO: SALUDO
            } else {
                const horaActual = new Date().getHours();
                let saludo = horaActual >= 6 && horaActual < 12 ? "Buenos días" : horaActual >= 12 && horaActual < 19 ? "Buenas tardes" : "Buenas noches";
                enviarMensaje(numeroUsuario, `¡Hola, ${saludo}! Bienvenido al sistema de la Secretaría de Hacienda.\n\nPara consultar tu estado de cuenta predial, por favor digita tu número de documento (CC/NIT) sin puntos ni espacios (Ej: 35209411).`);
            }
        }
    } catch (error) {
        console.error("[CRÍTICO] Fallo de serialización interna.");
    }
});

process.on('unhandledRejection', (reason) => {
    console.error('[CRÍTICO] Promesa no manejada:', reason);
});

if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`[TERMINAL CERO] Servidor Auditado y Múltiples Opciones Operativas en puerto ${PORT}`);
    });
}

module.exports = app;
