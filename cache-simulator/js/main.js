
/* =========================================
   1. REFERENCIAS A ELEMENTOS HTML
========================================= */

const configurationResult = document.getElementById(
    "configurationResult"
);

const configSummary = document.getElementById("configSummary");

const cacheTableBody = document.getElementById(
    "cacheTableBody"
);

const tioTable = document.getElementById("tioTable");

const addressInput = document.getElementById("memoryAddress");

const addressReadout = document.getElementById("addressReadout");

// Configuración vigente (null si la elegida es inválida)
let configActual = null;
let parametrosActuales = null;


/* =========================================
   2. LEER LA CONFIGURACIÓN
========================================= */

function obtenerConfiguracion() {

    const m = Number(
        document.getElementById("addressWidth").value
    );

    const C = Number(
        document.getElementById("cacheSize").value
    );

    const K = Number(
        document.getElementById("blockSize").value
    );

    const E = Number(
        document.getElementById("ways").value
    );

    const replacementPolicy = document.getElementById(
        "replacementPolicy"
    ).value;

    const writeHitPolicy = document.getElementById(
        "writeHitPolicy"
    ).value;

    const writeMissPolicy = document.getElementById(
        "writeMissPolicy"
    ).value;

    return {
        m,
        C,
        K,
        E,
        replacementPolicy,
        writeHitPolicy,
        writeMissPolicy
    };
}


/* =========================================
   3. VALIDAR LA CONFIGURACIÓN
========================================= */

function validarConfiguracion(config) {

    const { m, C, K, E } = config;

    const memoriaPrincipal = 2 ** m;

    if (C > memoriaPrincipal) {
        return "La caché no puede superar la memoria principal.";
    }

    if (K > C) {
        return "El bloque no puede superar la capacidad de caché.";
    }

    if (C % (K * E) !== 0) {
        return "La capacidad no permite esa asociatividad.";
    }

    const S = C / (K * E);

    if (S < 1) {
        return "El número de conjuntos debe ser al menos 1.";
    }

    // Los parámetros elegidos deben generar potencias de 2.
    if (!Number.isInteger(Math.log2(S))) {
        return "El número de conjuntos debe ser potencia de 2.";
    }

    return null;
}


/* =========================================
   4. CALCULAR PARÁMETROS
========================================= */

function calcularParametros(config) {

    const { m, C, K, E } = config;

    const memoriaPrincipal = 2 ** m;

    const bloques = C / K;

    const sets = bloques / E;

    const offsetBits = Math.log2(K);

    const indexBits = Math.log2(sets);

    const tagBits = m - indexBits - offsetBits;

    return {
        memoriaPrincipal,
        bloques,
        sets,
        offsetBits,
        indexBits,
        tagBits
    };
}


/* =========================================
   5. GENERAR TABLA DE CACHÉ
========================================= */

function generarTablaCache(config, parametros) {

    const { E, K } = config;

    const { sets, indexBits } = parametros;

    const datos = Array(K).fill("--").join(" ");

    let filas = "";

    // Recorrer cada conjunto
    for (let set = 0; set < sets; set++) {

        const alterno = set % 2 === 1 ? "set-alt" : "";

        const setBinario = indexBits > 0
            ? `<small>${set.toString(2).padStart(indexBits, "0")}</small>`
            : "";

        // Recorrer cada vía
        for (let way = 0; way < E; way++) {

            // La celda del conjunto abarca todas sus vías
            const celdaSet = way === 0
                ? `<th scope="rowgroup" rowspan="${E}" class="set">${set}${setBinario}</th>`
                : "";

            filas += `
                <tr data-set="${set}" class="${alterno}">
                    ${celdaSet}
                    <td>${way}</td>
                    <td>0</td>
                    <td>0</td>
                    <td class="tag">--</td>
                    <td class="datos">${datos}</td>
                </tr>
            `;
        }
    }

    cacheTableBody.innerHTML = filas;
}


/* =========================================
   6. RESUMEN EN EL ENCABEZADO
========================================= */

function mostrarResumen(parametros) {

    if (parametros === null) {
        configSummary.innerHTML = "";
        return;
    }

    const datos = [
        ["Memoria", `${parametros.memoriaPrincipal} B`],
        ["Bloques", parametros.bloques],
        ["Conjuntos", parametros.sets],
        ["Bits t / s / b", `${parametros.tagBits} / ${parametros.indexBits} / ${parametros.offsetBits}`]
    ];

    configSummary.innerHTML = datos
        .map(([nombre, valor]) => `<div><dt>${nombre}</dt><dd>${valor}</dd></div>`)
        .join("");
}


/* =========================================
   7. INTERPRETAR UNA DIRECCIÓN
   Acepta 0x.. (hex), 0b.. (binario) o decimal.
   Devuelve { valor } o { error }.
========================================= */

function interpretarDireccion(texto, m) {

    const limpio = texto.trim().toLowerCase();

    let valor;

    if (/^0x[0-9a-f]+$/.test(limpio)) {
        valor = parseInt(limpio.slice(2), 16);
    } else if (/^0b[01]+$/.test(limpio)) {
        valor = parseInt(limpio.slice(2), 2);
    } else if (/^\d+$/.test(limpio)) {
        valor = parseInt(limpio, 10);
    } else {
        return { error: "Formato no válido. Usa 0x2C, 0b101100 o 44." };
    }

    if (valor >= 2 ** m) {
        const maximo = (2 ** m - 1).toString(16).toUpperCase();
        return { error: `Fuera de rango: con ${m} bits el máximo es 0x${maximo}.` };
    }

    return { valor };
}


/* =========================================
   8. TABLA TAG / INDEX / OFFSET EN BINARIO
========================================= */

function mostrarDescomposicion() {

    if (configActual === null) {
        tioTable.innerHTML = "";
        addressReadout.textContent = "";
        mostrarExplicacion(null)
        return;
    }

    const { m } = configActual;

    const { tagBits, indexBits, offsetBits } = parametrosActuales;

    // Dirección escrita por el usuario (o ninguna)
    let direccion = null;
    let error = null;

    if (addressInput.value.trim() !== "") {
        const resultado = interpretarDireccion(addressInput.value, m);
        direccion = resultado.error ? null : resultado.valor;
        error = resultado.error ?? null;
    }

    addressInput.setAttribute("aria-invalid", error !== null);

    addressReadout.classList.toggle("error", error !== null);

    if (error !== null) {
        addressReadout.textContent = error;
    } else if (direccion !== null) {
        addressReadout.textContent =
            `0x${direccion.toString(16).toUpperCase()} = ${direccion}`;
    } else {
        addressReadout.textContent = "Escribe una dirección para verla en binario";
    }

    const binario = direccion !== null
        ? direccion.toString(2).padStart(m, "0")
        : null;
        mostrarExplicacion(direccion);

    // Campos de izquierda (MSB) a derecha (LSB); un campo de 0 bits no se muestra
    const campos = [
        { nombre: "Tag", clase: "f-tag", bits: tagBits },
        { nombre: "Index", clase: "f-index", bits: indexBits },
        { nombre: "Offset", clase: "f-offset", bits: offsetBits }
    ].filter(campo => campo.bits > 0);

    let filaCampos = `<th scope="row">Campo</th>`;
    let filaPosiciones = `<th scope="row">Bit</th>`;
    let filaBits = `<th scope="row">Binario</th>`;
    let filaValores = `<th scope="row">Valor</th>`;

    let posicion = m - 1;
    let inicioCampo = 0;

    for (const campo of campos) {

        const sufijo = campo.bits === 1 ? "bit" : "bits";

        filaCampos += `
            <th scope="col" colspan="${campo.bits}" class="field inicio ${campo.clase}">
                ${campo.nombre}<small>${campo.bits} ${sufijo}</small>
            </th>
        `;

        for (let i = 0; i < campo.bits; i++) {

            const inicio = i === 0 ? "inicio" : "";

            const bit = binario !== null
                ? binario[inicioCampo + i]
                : "–";

            const vacio = binario === null ? "vacio" : "";

            filaPosiciones += `<td class="pos ${inicio}">${posicion}</td>`;
            filaBits += `<td class="bit ${campo.clase} ${inicio} ${vacio}">${bit}</td>`;

            posicion--;
        }

        let valor = "–";

        if (binario !== null) {
            const numero = parseInt(
                binario.slice(inicioCampo, inicioCampo + campo.bits),
                2
            );
            valor = `${numero}<small>0x${numero.toString(16).toUpperCase()}</small>`;
        }

        filaValores += `<td colspan="${campo.bits}" class="valor inicio">${valor}</td>`;

        inicioCampo += campo.bits;
    }

    tioTable.innerHTML = `
        <thead><tr>${filaCampos}</tr></thead>
        <tbody>
            <tr>${filaPosiciones}</tr>
            <tr>${filaBits}</tr>
            <tr>${filaValores}</tr>
        </tbody>
    `;

    // Resaltar en la tabla de caché el conjunto al que apunta el index
    const setActivo = binario !== null && indexBits > 0
        ? parseInt(binario.slice(tagBits, tagBits + indexBits), 2)
        : binario !== null ? 0 : null;

    for (const fila of cacheTableBody.querySelectorAll("tr[data-set]")) {
        fila.classList.toggle(
            "activo",
            Number(fila.dataset.set) === setActivo
        );
    }
}


/* =========================================
   9. CONFIGURAR LA CACHÉ
========================================= */

function configurarCache() {

    const config = obtenerConfiguracion();

    const error = validarConfiguracion(config);
    mostrarRangoDirecciones(config.m);

    if (error !== null) {
        configActual = null;
        parametrosActuales = null;

        configurationResult.textContent = error;
        configurationResult.classList.add("error");

        cacheTableBody.innerHTML = `
            <tr class="empty"><td colspan="6">Corrige la configuración para ver la caché.</td></tr>
        `;

        mostrarResumen(null);
        mostrarDescomposicion();
        return;
    }

    configActual = config;
    parametrosActuales = calcularParametros(config);

    configurationResult.textContent = "";
    configurationResult.classList.remove("error");

    mostrarResumen(parametrosActuales);
    generarTablaCache(configActual, parametrosActuales);
    mostrarDescomposicion();

    console.log("Configuración:", configActual);
    console.log("Parámetros:", parametrosActuales);
}


/* =========================================
   EXPLICACIÓN DEL DIRECCIONAMIENTO
========================================= */

function mostrarExplicacion(direccion) {
    const panel = document.getElementById("explanationContent");

    if (direccion === null || !configActual) {
        panel.textContent = "Introduce una dirección válida para ver los cálculos.";
        return;
    }

    const { m, C, K, E } = configActual;
    const { sets, tagBits, indexBits, offsetBits } = parametrosActuales;

    const bloque = Math.floor(direccion / K);
    const conjunto = bloque % sets;
    const offset = direccion % K;
    const tag = Math.floor(bloque / sets);
    const base = bloque * K;

    const hex = n => "0x" + n.toString(16).toUpperCase()
        .padStart(Math.ceil(m / 4), "0");

    panel.innerHTML = `
        <p><strong>1. Número de conjuntos:</strong></p>
        <p>S = C / (K × E) = ${C} / (${K} × ${E}) = ${sets}</p>

        <hr>

        <p><strong>2. Distribución de bits:</strong></p>
        <p>Offset = log₂(${K}) = ${offsetBits} bits</p>
        <p>Index = log₂(${sets}) = ${indexBits} bits</p>
        <p>Tag = ${m} − ${indexBits} − ${offsetBits} = ${tagBits} bits</p>

        <hr>

        <p><strong>3. Resultado del direccionamiento:</strong></p>
        <p>Bloque = ⌊${direccion} / ${K}⌋ = ${bloque}</p>
        <p>Conjunto = ${bloque} mod ${sets} = <strong>${conjunto}</strong></p>
        <p>Offset = ${direccion} mod ${K} = <strong>${offset}</strong></p>
        <p>Tag = ⌊${bloque} / ${sets}⌋ = <strong>${tag}</strong></p>
        <p>Direcciones del bloque: <strong>${hex(base)} – ${hex(base + K - 1)}</strong></p>
    `;
}


/* =========================================
   10. EVENTOS
========================================= */

const generateBtn = document.getElementById("generateBtn");

// Aplicar parámetros solo al presionar el botón
generateBtn.addEventListener("click", configurarCache);

// Mostrar una indicación inicial
configurationResult.textContent =
    "Selecciona los parámetros y genera el sistema.";

addressInput.addEventListener("input", mostrarDescomposicion);

/* =========================================
   10. Rango de direcciones
========================================= */

function mostrarRangoDirecciones(m) {
    const maximo = 2 ** m - 1;
    const digitos = Math.ceil(m / 4);

    const hex = maximo.toString(16)
        .toUpperCase()
        .padStart(digitos, "0");

    document.getElementById("addressRange").textContent =
        `Rango disponible: 0x${"0".repeat(digitos)} - 0x${hex}`;
}
