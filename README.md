# 🏢 Secretaría de Hacienda - Bot Predial Automatizado (WhatsApp API)

![Bot Predial (Stateful)](https://img.shields.io/badge/Architecture-Stateful_Node.js-blue)
![Security](https://img.shields.io/badge/Security-Hardened%20(Helmet%20%2B%20RateLimit)-green)
![O(1) Data](https://img.shields.io/badge/Performance-O(1)%20In--Memory%20Map-orange)
![Meta Webhook](https://img.shields.io/badge/Integration-Meta%20Graph%20API-lightgrey)

Plataforma de automatización orientada a simplificar los procesos de tramitación de Impuestos Prediales mediante la integración directa con Meta Graph API (WhatsApp Business). Está diseñado bajo una arquitectura de alto rendimiento con validaciones de seguridad de grado industrial mitigando ataques de red y cuellos de botella mediante memoria volátil.

## 🛡️ Arquitectura y Seguridad (Hardening)
- **Indexación `O(1)` en RAM:** Se omite el acceso transaccional a Disco o iteraciones lineales (`Array.find()`) al transformar reportes de Excel (`.xlsx`) en mapas de Hash (`Map()`) desde el arranque. Esto reduce el consumo de CPU a casi cero durante asedios transaccionales.
- **Garbage Collector y Control de Sesiones Time-To-Live (TTL):** Evita la degradación de recursos mediante la administración del Estado del Usuario (*Stateful*) con directrices de purga para toda inactividad que supere los 15 minutos en el túnel.
- **Escudos Firewall L7:** Capa intermedia controladora (*Express-Rate-Limit* y *Helmet*) programada para frenar automáticamente solicitudes por fuerza bruta que excedan las 100 peticiones/min.
- **Mitigación ReDoS e Inyecciones:** Inyección de escudos Regex (`/^\d{5,15}$/`) que limitan y aíslan búsquedas de cadenas alfanuméricas inválidas sin consultar el motor de datos.

## 🚀 Funcionalidades Clave
1. **Enrutador Multinivel Stateful:** Flujo interactivo en donde el ciudadano avanza entre fases estructuradas: Re-consultas, pasarelas **PSE**, y enlace humano encriptado (`wa.me` URL Params) que abre vía a asesores reales.
2. **Consolidación Multi-Predio:** Al leer la base nativa, el algoritmo busca y agrupa propiedades anidadas a un mismo individuo. En lugar de limitarse al último registro, suma los deudados individualmente (`TOTAL`) bajo una lista estructurada (`Dirección` a `Dirección`) formulando e imprimiendo el *Gran Acumulado* orgánicamente.
3. **Telemetría UX (Notificaciones Autodirigidas):** Protocolo ciego que remite voluntariamente una señal terminal de desconexión una vez que el sistema borra activamente los datos de su caché.

## ⚙️ Estructura de Entorno `.env`
Las directrices arquitectónicas demandan el ocultamiento de las credenciales de Meta Graph en la bóveda ambiental.
Para arrancar debes disponer en la raíz de tu proyecto un archivo codificado llamado `.env`:
```env
PORT=3000
VERIFY_TOKEN=tu_contrasena_de_verificacion_interna
TOKEN_META=EAA... [Token Temporal provisto en la bandeja Sandbox]
PHONE_ID=101... [Identificador Telefónico de tu Cuenta Bussiness (Emisor)]
```

## 🏗️ Despliegue Táctico

1. **Gestor de Paquetes:** Instalar dependencias estrictas.  
   ```bash
   npm install
   ```
2. **Motor de Datos Inicial:** Posicionar tu listado general (`base_datos.xlsx`) explícitamente en el directorio de acceso resguardando las cabeceras mandatorias: `Cédula / Nit`, `Propietario`, `Direccion`, `TOTAL`.
3. **Arranque a Escucha Activa:** Inicia el observador transaccional.  
   ```bash
   npm run dev
   ```

*(Nota de Infraestructura: En servidores locales, es vital atar el Endpoint de Callback Meta usando una herramienta de Proxy Reverso como **Ngrok** anclado a tu `localhost:3000`. Cuidado con rotaciones de Webhook).*

## 🧪 Módulo QA: Condicionamiento Humano Masivo (Stress Test)
Existe en el repositorio el núcleo de Inyección Simultánea `test-carga.js`. Es un simulador que emula docenas de envíos ciudadanos concurrentes incluyendo demoras intencionales (`delays`). Este subsistema verifica la solvencia de la arquitectura evitando condiciones de carrera (`Race Conditions`).  
Ejecución en consola independiente:  
```bash
node test-carga.js
```

---
*Identity Signature: `Zero` - Ethical Hacking & QA Automations.*
