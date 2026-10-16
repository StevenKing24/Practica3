
/* =========================================
   1. REFERENCIAS A ELEMENTOS HTML
========================================= */

const configureBtn = document.getElementById("configureBtn");

const configurationResult = document.getElementById(
    "configurationResult"
);

const cacheTableBody = document.getElementById(
    "cacheTableBody"
);


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

    const { sets } = parametros;

    // Eliminar filas anteriores
    cacheTableBody.innerHTML = "";

    // Recorrer cada conjunto
    for (let set = 0; set < sets; set++) {

        // Recorrer cada vía
        for (let way = 0; way < E; way++) {

            const fila = document.createElement("tr");

            const datos = Array(K).fill("--").join(" ");

            fila.innerHTML = `
                <td>${set}</td>
                <td>${way}</td>
                <td>0</td>
                <td>0</td>
                <td>--</td>
                <td>${datos}</td>
            `;

            cacheTableBody.appendChild(fila);
        }
    }
}


/* =========================================
   6. CONFIGURAR LA CACHÉ
========================================= */

function configurarCache() {

    const config = obtenerConfiguracion();

    const error = validarConfiguracion(config);

    if (error !== null) {
        configurationResult.textContent = error;
        configurationResult.style.color = "#dc2626";
        return;
    }

    const parametros = calcularParametros(config);

    generarTablaCache(config, parametros);

    configurationResult.style.color = "#16a34a";

    configurationResult.innerHTML = `
        <strong>Configuración aplicada correctamente.</strong>
        <p>Memoria principal: ${parametros.memoriaPrincipal} bytes</p>
        <p>Bloques de caché: ${parametros.bloques}</p>
        <p>Conjuntos: ${parametros.sets}</p>
        <p>Bits de Tag: ${parametros.tagBits}</p>
        <p>Bits de Index: ${parametros.indexBits}</p>
        <p>Bits de Offset: ${parametros.offsetBits}</p>
    `;

    console.log("Configuración:", config);
    console.log("Parámetros:", parametros);
}


/* =========================================
   7. EVENTOS
========================================= */

configureBtn.addEventListener("click", configurarCache);

// Mostrar configuración inicial al cargar.
configurarCache();
