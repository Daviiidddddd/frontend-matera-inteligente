'use strict';

/* =====================================================================
   Matera Inteligente · Frontend
   Este archivo NO contiene URLs: todo sale de config.js.
   Habla con el backend solo por el contrato HTTP/JSON de docs/API.md.
   ===================================================================== */

const CLAVE_TOKEN = 'matera_token';
const CLAVE_EMAIL = 'matera_email';

let token = leerAlmacen(CLAVE_TOKEN);
let emailActual = leerAlmacen(CLAVE_EMAIL);
let especies = [];
let plantas = [];
let plantaActiva = null;
let temporizador = null;
let pidiendoEstado = false;
let modoRegistro = false;

/* ---------------------------------------------------------------------
   1. Capa de acceso a la API
   --------------------------------------------------------------------- */

class ErrorAPI extends Error {
    constructor(estado, mensaje) {
        super(mensaje);
        this.estado = estado;
    }
}

async function pedir(ruta, opciones) {
    const cfg = opciones || {};
    const metodo = cfg.metodo || 'GET';
    const cuerpo = cfg.cuerpo === undefined ? null : cfg.cuerpo;
    const conAuth = cfg.auth !== false;

    if (CONFIG.USAR_MOCKS) {
        return responderConMock(metodo, ruta);
    }

    const cabeceras = { 'Content-Type': 'application/json' };
    if (conAuth && token) {
        cabeceras['Authorization'] = 'Bearer ' + token;
    }

    let respuesta;
    try {
        respuesta = await fetch(CONFIG.API_BASE_URL + ruta, {
            method: metodo,
            headers: cabeceras,
            body: cuerpo === null ? undefined : JSON.stringify(cuerpo)
        });
    } catch (error) {
        throw new ErrorAPI(0, 'Sin conexión con el backend. Revisa que esté corriendo y que permita este origen (CORS).');
    }

    const texto = await respuesta.text();
    let datos = {};
    if (texto) {
        try { datos = JSON.parse(texto); } catch (e) { datos = {}; }
    }

    if (!respuesta.ok) {
        if (respuesta.status === 401 && conAuth && token) {
            cerrarSesion('Tu sesión expiró. Vuelve a entrar.');
        }
        throw new ErrorAPI(respuesta.status, datos.error || ('El servidor respondió ' + respuesta.status + '.'));
    }
    return datos;
}

/* Resuelve una ruta contra CONFIG.MOCKS. Solo se usa con USAR_MOCKS = true. */
function responderConMock(metodo, ruta) {
    const sinConsulta = ruta.split('?')[0];
    const plantilla = sinConsulta.replace(/^\/api\/plantas\/[^/]+\//, '/api/plantas/{id}/');
    const clave = metodo + ' ' + plantilla;
    const mock = CONFIG.MOCKS[clave];

    return new Promise(function (resolver, rechazar) {
        setTimeout(function () {
            if (!mock) {
                rechazar(new ErrorAPI(404, 'No hay respuesta de ejemplo para "' + clave + '" en config.js.'));
                return;
            }
            if (mock.estado >= 400) {
                rechazar(new ErrorAPI(mock.estado, (mock.cuerpo && mock.cuerpo.error) || 'Error de ejemplo.'));
                return;
            }
            const copia = JSON.parse(JSON.stringify(mock.cuerpo));
            // Solo en modo ejemplo: mueve un poco las lecturas para que se vea el refresco.
            resolver(clave === 'GET /api/plantas/{id}/estado' ? variarEjemplo(copia) : copia);
        }, 150);
    });
}

function variarEjemplo(estado) {
    const r = function (base, amplitud) {
        return Math.round((base + (Math.random() - 0.5) * amplitud) * 10) / 10;
    };
    estado.marca_tiempo = new Date().toISOString();
    estado.lecturas.humedad = r(52, 14);
    estado.lecturas.luz = Math.round(r(15200, 4000));
    estado.lecturas.temperatura = r(21.4, 6);
    estado.estados.humedad = clasificar(estado.lecturas.humedad, 40, 70);
    estado.estados.luz = clasificar(estado.lecturas.luz, 10000, 20000);
    estado.estados.temperatura = clasificar(estado.lecturas.temperatura, 18, 25);
    const dentro = ['humedad', 'luz', 'temperatura'].filter(function (k) {
        return estado.estados[k] === 'OPTIMO';
    }).length;
    estado.vitalidad.porcentaje = [55, 72, 88, 100][dentro];
    estado.vitalidad.nivel = nivelDesdePorcentaje(estado.vitalidad.porcentaje);
    return estado;
}

function clasificar(valor, minimo, maximo) {
    if (valor < minimo) return 'BAJO';
    if (valor > maximo) return 'ALTO';
    return 'OPTIMO';
}

function nivelDesdePorcentaje(p) {
    if (p >= 85) return 'EXCELENTE';
    if (p >= 70) return 'BUENO';
    if (p >= 50) return 'REGULAR';
    return 'CRITICO';
}

/* ---------------------------------------------------------------------
   2. Normalización de la respuesta
   El backend debe devolver la forma anidada de docs/API.md:
   { lecturas: {...}, estados: {...}, vitalidad: {...} }
   Las ramas de la derecha toleran la forma plana que hoy produce
   dataclasses.asdict en la fase 1. Cuando el back cumpla API.md, bórralas.
   --------------------------------------------------------------------- */

function normalizarEstado(datos) {
    return {
        planta_id: datos.planta_id || null,
        nombre: datos.nombre || datos.especie || '',
        especie: datos.especie || '',
        marca_tiempo: datos.marca_tiempo || null,
        lecturas: datos.lecturas || {
            humedad: datos.humedad_medida,
            luz: datos.luz_medida,
            temperatura: datos.temperatura_medida
        },
        estados: datos.estados || {
            humedad: datos.estado_humedad,
            luz: datos.estado_luz,
            temperatura: datos.estado_temperatura
        },
        vitalidad: datos.vitalidad || {
            porcentaje: datos.porcentaje_vitalidad,
            nivel: datos.nivel_vitalidad
        }
    };
}

/* ---------------------------------------------------------------------
   3. Autenticación
   --------------------------------------------------------------------- */

async function enviarFormularioAuth(evento) {
    evento.preventDefault();
    const email = el('email').value.trim();
    const password = el('password').value;

    if (!email || password.length < 8) {
        avisar('Escribe un correo válido y una contraseña de al menos 8 caracteres.', 'error');
        return;
    }

    const boton = el('btn-auth');
    boton.disabled = true;
    try {
        if (modoRegistro) {
            await pedir('/api/auth/registro', { metodo: 'POST', cuerpo: { email: email, password: password }, auth: false });
            avisar('Cuenta creada. Entrando…', 'ok');
        }
        const datos = await pedir('/api/auth/login', { metodo: 'POST', cuerpo: { email: email, password: password }, auth: false });
        if (!datos.token) {
            throw new ErrorAPI(0, 'El backend no devolvió un token.');
        }
        token = datos.token;
        emailActual = email;
        escribirAlmacen(CLAVE_TOKEN, token);
        escribirAlmacen(CLAVE_EMAIL, email);
        el('password').value = '';
        await mostrarPanel();
    } catch (error) {
        if (error.estado === 409) {
            avisar('Ese correo ya está registrado. Inicia sesión.', 'error');
            cambiarModo(false);
        } else if (error.estado === 401) {
            avisar('Correo o contraseña incorrectos.', 'error');
        } else {
            avisar(error.message, 'error');
        }
    } finally {
        boton.disabled = false;
    }
}

function cambiarModo(registro) {
    modoRegistro = registro;
    el('auth-sub').textContent = registro ? 'Crea una cuenta para empezar' : 'Inicia sesión para ver tus plantas';
    el('btn-auth').textContent = registro ? 'Crear cuenta' : 'Entrar';
    el('alterna-texto').textContent = registro ? '¿Ya tienes cuenta?' : '¿No tienes cuenta?';
    el('btn-cambiar-modo').textContent = registro ? 'Inicia sesión' : 'Regístrate';
    el('password').setAttribute('autocomplete', registro ? 'new-password' : 'current-password');
}

function cerrarSesion(mensaje) {
    detenerRefresco();
    token = null;
    emailActual = null;
    plantaActiva = null;
    plantas = [];
    especies = [];
    escribirAlmacen(CLAVE_TOKEN, null);
    escribirAlmacen(CLAVE_EMAIL, null);
    el('vista-panel').classList.add('oculto');
    el('vista-auth').classList.remove('oculto');
    cambiarModo(false);
    if (mensaje) avisar(mensaje, 'error');
}

/* ---------------------------------------------------------------------
   4. Panel: especies, plantas, vinculación
   --------------------------------------------------------------------- */

async function mostrarPanel() {
    el('vista-auth').classList.add('oculto');
    el('vista-panel').classList.remove('oculto');
    el('usuario-email').textContent = emailActual || '';
    el('pie').textContent = CONFIG.USAR_MOCKS
        ? 'Modo ejemplo: respuestas de config.js, sin backend.'
        : 'Conectado a ' + CONFIG.API_BASE_URL;

    await cargarEspecies();
    await cargarPlantas();
}

async function cargarEspecies() {
    try {
        const datos = await pedir('/api/especies');
        especies = Array.isArray(datos) ? datos : [];
    } catch (error) {
        especies = [];
        avisar('No se pudo cargar el catálogo de especies: ' + error.message, 'error');
    }

    [el('vin-especie'), el('eva-especie')].forEach(function (select) {
        select.innerHTML = '';
        especies.forEach(function (especie) {
            const opcion = document.createElement('option');
            opcion.value = especie.nombre;
            opcion.textContent = especie.nombre;
            select.appendChild(opcion);
        });
    });
}

async function cargarPlantas() {
    try {
        const datos = await pedir('/api/plantas');
        plantas = Array.isArray(datos) ? datos : [];
    } catch (error) {
        plantas = [];
        avisar('No se pudieron cargar tus plantas: ' + error.message, 'error');
    }

    const lista = el('lista-plantas');
    lista.innerHTML = '';
    el('sin-plantas').classList.toggle('oculto', plantas.length > 0);

    plantas.forEach(function (planta) {
        const item = document.createElement('li');
        const boton = document.createElement('button');
        boton.type = 'button';
        boton.className = 'planta' + (planta.planta_id === plantaActiva ? ' activa' : '');
        boton.innerHTML = '<span class="planta-nombre"></span><span class="planta-especie"></span>';
        boton.querySelector('.planta-nombre').textContent = planta.nombre || planta.planta_id;
        boton.querySelector('.planta-especie').textContent = planta.especie || '';
        boton.addEventListener('click', function () { seleccionarPlanta(planta.planta_id); });
        item.appendChild(boton);
        lista.appendChild(item);
    });

    const sigueExistiendo = plantas.some(function (p) { return p.planta_id === plantaActiva; });
    if (!sigueExistiendo) {
        plantaActiva = null;
        detenerRefresco();
    }
    if (!plantaActiva && plantas.length > 0) {
        seleccionarPlanta(plantas[0].planta_id);
    }
}

async function vincularPlanta(evento) {
    evento.preventDefault();
    const nombre = el('vin-nombre').value.trim();
    const especie = el('vin-especie').value;
    const codigo = el('vin-codigo').value.trim();

    if (!nombre || !especie || !codigo) {
        avisar('Completa nombre, especie y código de emparejamiento.', 'error');
        return;
    }

    const boton = evento.target.querySelector('button[type="submit"]');
    boton.disabled = true;
    try {
        const datos = await pedir('/api/plantas', {
            metodo: 'POST',
            cuerpo: { nombre: nombre, especie: especie, codigo: codigo }
        });
        el('vin-nombre').value = '';
        el('vin-codigo').value = '';
        if (datos.token_dispositivo) {
            el('token-valor').textContent = datos.token_dispositivo;
            el('token-dispositivo').classList.remove('oculto');
        }
        avisar('Planta vinculada.', 'ok');
        plantaActiva = datos.planta_id || plantaActiva;
        await cargarPlantas();
    } catch (error) {
        if (error.estado === 404) {
            avisar('Ese código de emparejamiento no existe.', 'error');
        } else if (error.estado === 409) {
            avisar('Ese dispositivo ya está vinculado a otra planta.', 'error');
        } else {
            avisar(error.message, 'error');
        }
    } finally {
        boton.disabled = false;
    }
}

/* ---------------------------------------------------------------------
   5. Estado en vivo (refresco cada CONFIG.REFRESCO_MS)
   --------------------------------------------------------------------- */

function seleccionarPlanta(plantaId) {
    plantaActiva = plantaId;
    const planta = plantas.filter(function (p) { return p.planta_id === plantaId; })[0];
    el('estado-titulo').textContent = planta ? (planta.nombre || 'Estado') : 'Estado';

    Array.prototype.forEach.call(document.querySelectorAll('.planta'), function (boton, indice) {
        boton.classList.toggle('activa', plantas[indice] && plantas[indice].planta_id === plantaId);
    });

    refrescarEstado();
    iniciarRefresco();
}

function iniciarRefresco() {
    detenerRefresco();
    temporizador = setInterval(function () {
        if (document.visibilityState === 'visible') refrescarEstado();
    }, CONFIG.REFRESCO_MS);
    el('refresco-aviso').textContent = 'se actualiza cada ' + Math.round(CONFIG.REFRESCO_MS / 1000) + ' s';
}

function detenerRefresco() {
    if (temporizador !== null) {
        clearInterval(temporizador);
        temporizador = null;
    }
    el('refresco-aviso').textContent = '';
}

async function refrescarEstado() {
    if (!plantaActiva || pidiendoEstado) return;
    pidiendoEstado = true;
    try {
        const crudo = await pedir('/api/plantas/' + encodeURIComponent(plantaActiva) + '/estado');
        pintarEstado(normalizarEstado(crudo));
        await cargarHistorial();
    } catch (error) {
        if (error.estado === 403) {
            detenerRefresco();
            avisar('Esa planta no es tuya (403).', 'error');
        } else if (error.estado === 404) {
            detenerRefresco();
            el('estado').classList.add('oculto');
            el('estado-vacio').classList.remove('oculto');
            el('estado-vacio').textContent = 'Esa planta todavía no tiene lecturas.';
        } else {
            avisar('No se pudo leer el estado: ' + error.message, 'error');
        }
    } finally {
        pidiendoEstado = false;
    }
}

function pintarEstado(estado) {
    el('estado-vacio').classList.add('oculto');
    el('estado').classList.remove('oculto');

    el('estado-marca').textContent = estado.marca_tiempo
        ? 'Última lectura: ' + formatearHora(estado.marca_tiempo)
        : '';

    const porcentaje = numero(estado.vitalidad.porcentaje);
    el('estado-nivel').textContent = (estado.vitalidad.nivel || '—') +
        (porcentaje === null ? '' : ' · ' + porcentaje + '%');

    const barra = el('estado-barra');
    barra.style.width = (porcentaje === null ? 0 : porcentaje) + '%';
    barra.style.backgroundColor = colorVitalidad(porcentaje);

    pintarParametro('humedad', estado.lecturas.humedad, '%', estado.estados.humedad, 'par-humedad', 'ins-humedad');
    pintarParametro('luz', estado.lecturas.luz, ' lux', estado.estados.luz, 'par-luz', 'ins-luz');
    pintarParametro('temperatura', estado.lecturas.temperatura, ' °C', estado.estados.temperatura, 'par-temperatura', 'ins-temperatura');
}

function pintarParametro(nombre, valor, unidad, estado, idValor, idInsignia) {
    const v = numero(valor);
    el(idValor).textContent = v === null ? '—' : v.toLocaleString('es-CO') + unidad;
    const insignia = el(idInsignia);
    insignia.textContent = estado || '—';
    insignia.className = 'insignia ' + (estado ? estado.toLowerCase() : '');
}

async function cargarHistorial() {
    let filas = [];
    try {
        const datos = await pedir('/api/plantas/' + encodeURIComponent(plantaActiva) + '/historial?limite=10');
        filas = Array.isArray(datos) ? datos : (datos.lecturas || []);
    } catch (error) {
        return; // el historial es secundario: si falla, el estado ya se mostró
    }

    const cuerpo = el('cuerpo-historial');
    cuerpo.innerHTML = '';
    filas.map(normalizarEstado).forEach(function (fila) {
        const tr = document.createElement('tr');
        [
            fila.marca_tiempo ? formatearHora(fila.marca_tiempo) : '—',
            textoValor(fila.lecturas.humedad, '%'),
            textoValor(fila.lecturas.luz, ''),
            textoValor(fila.lecturas.temperatura, '°'),
            (numero(fila.vitalidad.porcentaje) === null ? '—' : numero(fila.vitalidad.porcentaje) + '%')
        ].forEach(function (celda) {
            const td = document.createElement('td');
            td.textContent = celda;
            tr.appendChild(td);
        });
        cuerpo.appendChild(tr);
    });
}

/* ---------------------------------------------------------------------
   6. Evaluación manual (R1 de la fase 1)
   --------------------------------------------------------------------- */

async function evaluarManual(evento) {
    evento.preventDefault();
    const cuerpo = {
        especie: el('eva-especie').value,
        humedad: parseFloat(el('eva-humedad').value),
        luz: parseFloat(el('eva-luz').value),
        temperatura: parseFloat(el('eva-temperatura').value)
    };

    if ([cuerpo.humedad, cuerpo.luz, cuerpo.temperatura].some(isNaN)) {
        avisar('Las tres lecturas deben ser números.', 'error');
        return;
    }

    const boton = evento.target.querySelector('button[type="submit"]');
    boton.disabled = true;
    try {
        const estado = normalizarEstado(await pedir('/api/evaluar', { metodo: 'POST', cuerpo: cuerpo }));
        el('resultado-manual').classList.remove('oculto');

        const porcentaje = numero(estado.vitalidad.porcentaje);
        el('man-nivel').textContent = (estado.vitalidad.nivel || '—') +
            (porcentaje === null ? '' : ' · ' + porcentaje + '%');
        const barra = el('man-barra');
        barra.style.width = (porcentaje === null ? 0 : porcentaje) + '%';
        barra.style.backgroundColor = colorVitalidad(porcentaje);

        pintarParametro('humedad', estado.lecturas.humedad, '%', estado.estados.humedad, 'man-humedad', 'man-ins-humedad');
        pintarParametro('luz', estado.lecturas.luz, ' lux', estado.estados.luz, 'man-luz', 'man-ins-luz');
        pintarParametro('temperatura', estado.lecturas.temperatura, ' °C', estado.estados.temperatura, 'man-temperatura', 'man-ins-temperatura');
    } catch (error) {
        if (error.estado === 404) {
            avisar('Esa especie no está registrada (404).', 'error');
        } else if (error.estado === 400) {
            avisar(error.message, 'error');
        } else {
            avisar(error.message, 'error');
        }
    } finally {
        boton.disabled = false;
    }
}

/* ---------------------------------------------------------------------
   7. Utilidades
   --------------------------------------------------------------------- */

function el(id) {
    return document.getElementById(id);
}

function numero(valor) {
    const n = typeof valor === 'number' ? valor : parseFloat(valor);
    return isNaN(n) ? null : Math.round(n * 100) / 100;
}

function textoValor(valor, unidad) {
    const n = numero(valor);
    return n === null ? '—' : n.toLocaleString('es-CO') + unidad;
}

function colorVitalidad(porcentaje) {
    if (porcentaje === null) return '#9ca3af';
    if (porcentaje >= 70) return '#4ade80';
    if (porcentaje >= 50) return '#facc15';
    return '#ef4444';
}

function formatearHora(iso) {
    const fecha = new Date(iso);
    if (isNaN(fecha.getTime())) return iso;
    return fecha.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

let temporizadorAviso = null;

function avisar(mensaje, tipo) {
    const caja = el('aviso');
    caja.textContent = mensaje;
    caja.className = 'aviso ' + (tipo || 'ok');
    if (temporizadorAviso !== null) clearTimeout(temporizadorAviso);
    temporizadorAviso = setTimeout(function () {
        caja.classList.add('oculto');
    }, 6000);
}

function leerAlmacen(clave) {
    try { return localStorage.getItem(clave); } catch (e) { return null; }
}

function escribirAlmacen(clave, valor) {
    try {
        if (valor === null) localStorage.removeItem(clave);
        else localStorage.setItem(clave, valor);
    } catch (e) { /* navegación privada: la sesión dura lo que la pestaña */ }
}

/* ---------------------------------------------------------------------
   8. Arranque
   --------------------------------------------------------------------- */

el('form-auth').addEventListener('submit', enviarFormularioAuth);
el('form-vincular').addEventListener('submit', vincularPlanta);
el('form-evaluar').addEventListener('submit', evaluarManual);
el('btn-cambiar-modo').addEventListener('click', function () { cambiarModo(!modoRegistro); });
el('btn-salir').addEventListener('click', function () { cerrarSesion(null); });
el('btn-copiar').addEventListener('click', async function () {
    try {
        await navigator.clipboard.writeText(el('token-valor').textContent);
        avisar('Token copiado.', 'ok');
    } catch (e) {
        avisar('Copia el token manualmente.', 'error');
    }
});
document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible' && plantaActiva) refrescarEstado();
});

cambiarModo(false);
if (token) {
    mostrarPanel();
}
