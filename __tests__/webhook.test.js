const request = require('supertest');
const axios = require('axios');
const app = require('../index');

jest.mock('axios');

describe('Modulo QA Automatizado - Auditoría de Seguridad Bidireccional (Webhook)', () => {

    beforeAll(() => {
        process.env.VERIFY_TOKEN = 'token_test_123';
        process.env.TOKEN_META = 'meta_test_token';
        process.env.PHONE_ID = '12345';
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('[QA] Debe rechazar verificación GET si no incluye token (HTTP 400)', async () => {
        const res = await request(app).get('/webhook');
        expect(res.statusCode).toEqual(400);
    });

    it('[QA] Debe rechazar verificación GET con un token de atacante (HTTP 403)', async () => {
        const res = await request(app).get('/webhook?hub.mode=subscribe&hub.verify_token=t0k3n_fals0&hub.challenge=111');
        expect(res.statusCode).toEqual(403);
    });

    it('[QA] Debe aceptar verificación GET con el token legítimo y responder con challenge (HTTP 200)', async () => {
        const res = await request(app).get('/webhook?hub.mode=subscribe&hub.verify_token=token_test_123&hub.challenge=123456');
        expect(res.statusCode).toEqual(200);
        expect(res.text).toBe('123456');
    });

    it('[QA] POST debe procesar un payload legítimo y enviar un mensaje usando axios hacia Meta', async () => {
        axios.mockResolvedValue({ status: 200, data: {} });

        // Estructura oficial de Meta
        const metaPayload = {
            object: "whatsapp_business_account",
            entry: [{
                id: "123456789",
                changes: [{
                    value: {
                        messaging_product: "whatsapp",
                        metadata: { display_phone_number: "15551234567", phone_number_id: "123456789" },
                        messages: [{
                            from: "573001234567",
                            id: "wamid.HBgL...",
                            timestamp: "1710000000",
                            type: "text",
                            text: { body: "35209411" } // Documento en base de datos mock
                        }]
                    },
                    field: "messages"
                }]
            }]
        };

        const res = await request(app)
            .post('/webhook')
            .send(metaPayload);
            
        expect(res.statusCode).toEqual(200);
        
        // Verificamos que Axios se haya llamado para responder (Defensa SSRF superada)
        expect(axios).toHaveBeenCalledTimes(1);
        expect(axios).toHaveBeenCalledWith(expect.objectContaining({
            url: 'https://graph.facebook.com/v25.0/12345/messages',
            method: 'POST'
        }));
    });

    it('[QA-DDoS] Debe bloquear payloads maliciosos gigantes (DoS vector mitigado - HTTP 413)', async () => {
        const bigPayload = { entry: "A".repeat(20000) }; 
        const res = await request(app)
            .post('/webhook')
            .send(bigPayload);
        expect(res.statusCode).toEqual(413);
    });
});
