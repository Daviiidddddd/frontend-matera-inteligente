// Configuración del frontend de Matera Inteligente.
// Es el ÚNICO archivo que se edita al cambiar de entorno: app.js no contiene URLs.

const CONFIG = {
    // URL base del backend (repo matera-backend). Sin barra al final.
    // Local: 'http://127.0.0.1:5000'
    API_BASE_URL: 'http://127.0.0.1:5000',

    // Cada cuántos milisegundos se vuelve a pedir el estado de la planta seleccionada.
    REFRESCO_MS: 5000,

    // true  -> el front funciona solo, con las respuestas de ejemplo de abajo.
    // false -> el front habla con el backend real.
    // Déjalo en true mientras el back no esté listo; ponlo en false para la sustentación.
    USAR_MOCKS: true,

    // Respuestas de ejemplo tomadas de docs/API.md del backend.
    // Funcionan como contrato: el backend debe devolver exactamente estas claves.
    // Las rutas con id variable se escriben con el marcador {id}.
    MOCKS: {
        'POST /api/auth/registro': {
            estado: 201,
            cuerpo: { usuario_id: 'u-001', email: 'demo@matera.co' }
        },

        'POST /api/auth/login': {
            estado: 200,
            cuerpo: { token: 'jwt-de-ejemplo-del-usuario' }
        },

        'GET /api/especies': {
            estado: 200,
            cuerpo: [
                {
                    nombre: 'Orquidea',
                    rangos: {
                        humedad: { min: 40, max: 70 },
                        luz: { min: 10000, max: 20000 },
                        temperatura: { min: 18, max: 25 }
                    }
                },
                {
                    nombre: 'Cactus',
                    rangos: {
                        humedad: { min: 10, max: 30 },
                        luz: { min: 25000, max: 50000 },
                        temperatura: { min: 15, max: 35 }
                    }
                },
                {
                    nombre: 'Helecho',
                    rangos: {
                        humedad: { min: 60, max: 90 },
                        luz: { min: 3000, max: 8000 },
                        temperatura: { min: 16, max: 24 }
                    }
                },
                {
                    nombre: 'Suculenta',
                    rangos: {
                        humedad: { min: 20, max: 40 },
                        luz: { min: 15000, max: 30000 },
                        temperatura: { min: 12, max: 30 }
                    }
                },
                {
                    nombre: 'Ficus',
                    rangos: {
                        humedad: { min: 50, max: 75 },
                        luz: { min: 8000, max: 18000 },
                        temperatura: { min: 15, max: 28 }
                    }
                }
            ]
        },

        'GET /api/plantas': {
            estado: 200,
            cuerpo: [
                {
                    planta_id: 'p-001',
                    nombre: 'Orquídea de la sala',
                    especie: 'Orquidea',
                    dispositivo_id: 'd-001'
                },
                {
                    planta_id: 'p-002',
                    nombre: 'Cactus del escritorio',
                    especie: 'Cactus',
                    dispositivo_id: 'd-002'
                }
            ]
        },

        'POST /api/plantas': {
            estado: 201,
            cuerpo: {
                planta_id: 'p-003',
                dispositivo_id: 'd-003',
                token_dispositivo: 'jwt-de-ejemplo-del-dispositivo'
            }
        },

        'GET /api/plantas/{id}/estado': {
            estado: 200,
            cuerpo: {
                planta_id: 'p-001',
                nombre: 'Orquídea de la sala',
                especie: 'Orquidea',
                dispositivo_id: 'd-001',
                marca_tiempo: '2026-10-26T21:40:00Z',
                lecturas: { humedad: 52.0, luz: 15200.0, temperatura: 21.4 },
                estados: { humedad: 'OPTIMO', luz: 'OPTIMO', temperatura: 'OPTIMO' },
                vitalidad: { porcentaje: 100.0, nivel: 'EXCELENTE' }
            }
        },

        'GET /api/plantas/{id}/historial': {
            estado: 200,
            cuerpo: [
                {
                    marca_tiempo: '2026-10-26T21:40:00Z',
                    lecturas: { humedad: 52.0, luz: 15200.0, temperatura: 21.4 },
                    estados: { humedad: 'OPTIMO', luz: 'OPTIMO', temperatura: 'OPTIMO' },
                    vitalidad: { porcentaje: 100.0, nivel: 'EXCELENTE' }
                },
                {
                    marca_tiempo: '2026-10-26T21:39:55Z',
                    lecturas: { humedad: 38.5, luz: 14800.0, temperatura: 21.1 },
                    estados: { humedad: 'BAJO', luz: 'OPTIMO', temperatura: 'OPTIMO' },
                    vitalidad: { porcentaje: 95.42, nivel: 'EXCELENTE' }
                },
                {
                    marca_tiempo: '2026-10-26T21:39:50Z',
                    lecturas: { humedad: 51.2, luz: 26000.0, temperatura: 20.8 },
                    estados: { humedad: 'OPTIMO', luz: 'ALTO', temperatura: 'OPTIMO' },
                    vitalidad: { porcentaje: 90.0, nivel: 'EXCELENTE' }
                }
            ]
        },

        'POST /api/evaluar': {
            estado: 200,
            cuerpo: {
                especie: 'Orquidea',
                lecturas: { humedad: 50.0, luz: 15000.0, temperatura: 20.0 },
                estados: { humedad: 'OPTIMO', luz: 'OPTIMO', temperatura: 'OPTIMO' },
                vitalidad: { porcentaje: 100.0, nivel: 'EXCELENTE' }
            }
        }
    }
};
