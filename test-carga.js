const axios = require('axios');

const URL_WEBHOOK = 'http://localhost:3000/webhook';
const NUMERO_REAL = '573228061144';

// 1. La lista de documentos proporcionados
const documentos = [
    "14257822", "14257822", "3209463", "38196946", "38201335",
    "5856961", "40693092", "1109417480", "2280508", "2280508",
    "14190268", "14256105", "14192665", "1109414049", "_7F80VYBA4",
    "51949729", "1616786", "_7F80VYBAF", "38204340", "4870146",
    "14193396", "6709644", "93472544", "14255777", "14256401",
    "14192689", "4884381", "38204340", "1006031440", "1006031440"
];

// 2. Función para crear el paquete de datos de WhatsApp
// [MODIFICACIÓN ZERO]: Añadidas reglas explícitas "object" y "type: text" para superar escudo de Node.js.
function crearPaquete(numero, texto) {
    return {
        object: "whatsapp_business_account",
        entry: [{
            changes: [{
                value: {
                    messages: [{
                        from: numero,
                        type: "text",
                        text: { body: texto }
                    }]
                }
            }]
        }]
    };
}

// 3. Función mágica para hacer que el código "espere" como un humano (en milisegundos)
const esperar = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// 4. El comportamiento individual de cada "Ciudadano"
async function simularCiudadano(numeroCelular, documento, retrasoInicial) {
    try {
        // Esperamos un tiempo aleatorio para que no todos escriban al mismo milisegundo exacto
        await esperar(retrasoInicial);

        console.log(`[👤 ${numeroCelular}] -> Escribe: "Hola"`);
        await axios.post(URL_WEBHOOK, crearPaquete(numeroCelular, "Hola"));

        // Simulamos que el usuario lee el menú del bot y tarda entre 2 y 4 segundos en responder
        let tiempoLectura = Math.floor(Math.random() * 2000) + 2000;
        await esperar(tiempoLectura);

        console.log(`[👤 ${numeroCelular}] -> Consulta el documento: "${documento}"`);
        await axios.post(URL_WEBHOOK, crearPaquete(numeroCelular, documento));
        
    } catch (error) {
        // El servidor Nodemon puede rechazar peticiones por Rate-Limit (429) o fallar.
        console.error(`❌ Error en simulación del número ${numeroCelular}: Servidor puede haber bloqueado el ataque.`);
    }
}

// 5. Función principal que lanza a todos los usuarios a la vez
async function iniciarPruebaMasiva() {
    console.log("🚀 [ZERO QA] INICIANDO PRUEBA DE ESTRÉS CON COMPORTAMIENTO HUMANO...");
    console.log(`Se simularán ${documentos.length} ciudadanos simultáneos independientes.\n`);
    
    const simulaciones = [];

    // Recorremos la lista de documentos para crear los usuarios
    for (let i = 0; i < documentos.length; i++) {
        // El primer usuario será tu número real, los demás serán inventados
        let numeroCelular = (i === 0) ? NUMERO_REAL : `5730000000${i < 10 ? '0'+i : i}`;
        let documento = documentos[i];
        
        // Cada usuario empieza a escribir en un momento ligeramente distinto (entre 0 y 2 segundos)
        let retrasoInicial = Math.floor(Math.random() * 2000);

        // Agregamos la simulación a nuestra lista de tareas
        simulaciones.push(simularCiudadano(numeroCelular, documento, retrasoInicial));
    }

    // Ejecutamos TODAS las simulaciones concurrentemente
    await Promise.all(simulaciones);
    console.log("\n✅ PRUEBA MASIVA FINALIZADA. Todos los ciudadanos han enviado sus mensajes y consultas.");
}

iniciarPruebaMasiva();
