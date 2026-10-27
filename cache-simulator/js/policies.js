/* ==========================================================
   SIMULADOR DE MEMORIA CACHÉ 351
   Universidad Industrial de Santander

   Archivo: js/policies.js
   Versión 2

   POLÍTICAS DE REEMPLAZO:
   - LRU
   - FIFO
   - LFU
   - RANDOM
========================================================== */


/* ==========================================================
   1. VALIDAR CONJUNTO
========================================================== */

/*
   Comprueba que se recibió un arreglo
   de líneas de caché válido.
*/

function validateLines(lines) {

    if (!Array.isArray(lines)) {

        throw new Error(
            "Las líneas de caché deben estar en un arreglo."
        );
    }

    if (lines.length === 0) {

        throw new Error(
            "El conjunto no contiene líneas de caché."
        );
    }
}


/* ==========================================================
   2. POLÍTICA LRU
========================================================== */

/*
   Least Recently Used

   Selecciona la línea utilizada hace más tiempo.

   Cada línea almacena:

   lastUsed:
       Instante de su último acceso.

   Devuelve:
       Índice de la vía seleccionada.
*/

export function LRU(lines) {

    validateLines(lines);

    let victimIndex = 0;

    let oldestTime = lines[0].lastUsed ?? 0;

    for (let i = 1; i < lines.length; i++) {

        const currentTime =
            lines[i].lastUsed ?? 0;

        if (currentTime < oldestTime) {

            oldestTime = currentTime;

            victimIndex = i;
        }
    }

    return victimIndex;
}


/* ==========================================================
   3. POLÍTICA FIFO
========================================================== */

/*
   First In, First Out

   Selecciona el bloque que ingresó primero
   al conjunto.

   Cada línea almacena:

   insertedAt:
       Instante en que se cargó el bloque.

   Importante:
       Los HIT no modifican insertedAt.
*/

export function FIFO(lines) {

    validateLines(lines);

    let victimIndex = 0;

    let oldestInsertion =
        lines[0].insertedAt ?? 0;

    for (let i = 1; i < lines.length; i++) {

        const currentInsertion =
            lines[i].insertedAt ?? 0;

        if (currentInsertion < oldestInsertion) {

            oldestInsertion = currentInsertion;

            victimIndex = i;
        }
    }

    return victimIndex;
}


/* ==========================================================
   4. POLÍTICA LFU
========================================================== */

/*
   Least Frequently Used

   Selecciona el bloque con menor frecuencia
   de utilización.

   Cada línea almacena:

   frequency:
       Número de accesos realizados al bloque.

   En caso de empate utilizamos LRU.

   Ejemplo:

   Vía 0 -> Frecuencia 5
   Vía 1 -> Frecuencia 2
   Vía 2 -> Frecuencia 8
   Vía 3 -> Frecuencia 4

   Se reemplaza la vía 1.
*/

export function LFU(lines) {

    validateLines(lines);

    let victimIndex = 0;

    let minFrequency =
        lines[0].frequency ?? 0;

    let oldestTime =
        lines[0].lastUsed ?? 0;

    for (let i = 1; i < lines.length; i++) {

        const currentFrequency =
            lines[i].frequency ?? 0;

        const currentTime =
            lines[i].lastUsed ?? 0;

        if (currentFrequency < minFrequency) {

            minFrequency = currentFrequency;

            oldestTime = currentTime;

            victimIndex = i;

        } else if (
            currentFrequency === minFrequency &&
            currentTime < oldestTime
        ) {

            oldestTime = currentTime;

            victimIndex = i;
        }
    }

    return victimIndex;
}


/* ==========================================================
   5. POLÍTICA RANDOM
========================================================== */

/*
   Random Replacement

   Selecciona aleatoriamente una vía.

   Puede recibir una función generadora
   de números aleatorios.

   Esto permite que cache.js utilice
   una semilla reproducible.

   La función debe generar números
   dentro del intervalo [0, 1).
*/

export function RANDOM(
    lines,
    randomFunction = Math.random
) {

    validateLines(lines);

    if (typeof randomFunction !== "function") {

        throw new Error(
            "El generador aleatorio debe ser una función."
        );
    }

    const randomValue = randomFunction();

    if (
        !Number.isFinite(randomValue) ||
        randomValue < 0 ||
        randomValue >= 1
    ) {

        throw new Error(
            "El generador debe devolver un valor entre 0 y 1."
        );
    }

    return Math.floor(
        randomValue * lines.length
    );
}


/* ==========================================================
   6. BUSCAR UNA VÍA LIBRE
========================================================== */

/*
   Antes de aplicar reemplazo se verifica
   si existe una línea inválida.

   Bit V = 0:
       La línea está libre.

   Bit V = 1:
       La línea contiene información válida.

   Si existe una vía libre, se utiliza
   sin incrementar los reemplazos.
*/

export function findInvalidLine(lines) {

    validateLines(lines);

    for (let i = 0; i < lines.length; i++) {

        if (!lines[i].valid) {

            return i;
        }
    }

    return -1;
}


/* ==========================================================
   7. SELECCIONAR VÍA VÍCTIMA
========================================================== */

/*
   Función principal del módulo.

   Parámetros:

   lines:
       Líneas pertenecientes a un conjunto.

   policy:
       LRU, FIFO, LFU o RANDOM.

   randomFunction:
       Generador utilizado por RANDOM.

   Funcionamiento:

   1. Buscar una línea inválida.

   2. Si existe, utilizarla directamente.

   3. Si todas están ocupadas, ejecutar
      la política seleccionada.

   Devuelve:

   {
       index,
       replacement,
       policy,
       reason
   }
*/

export function selectVictim(
    lines,
    policy = "LRU",
    randomFunction = Math.random
) {

    validateLines(lines);

    const selectedPolicy =
        String(policy).toUpperCase();


    /* --------------------------------------------------
       VALIDAR POLÍTICA
    -------------------------------------------------- */

    const validPolicies = [
        "LRU",
        "FIFO",
        "LFU",
        "RANDOM"
    ];

    if (!validPolicies.includes(selectedPolicy)) {

        throw new Error(
            `Política de reemplazo no reconocida: ${policy}`
        );
    }


    /* --------------------------------------------------
       BUSCAR UNA VÍA LIBRE
    -------------------------------------------------- */

    const freeIndex = findInvalidLine(lines);

    if (freeIndex !== -1) {

        return {

            index: freeIndex,

            replacement: false,

            policy: "FREE",

            reason:
                `Se utiliza la vía ${freeIndex} porque ` +
                "su bit de validez es 0."
        };
    }


    /* --------------------------------------------------
       TODAS LAS VÍAS ESTÁN OCUPADAS
    -------------------------------------------------- */

    let victimIndex = -1;

    let reason = "";


    switch (selectedPolicy) {

        case "LRU":

            victimIndex = LRU(lines);

            reason =
                `LRU seleccionó la vía ${victimIndex} ` +
                "porque contiene el bloque menos " +
                "recientemente utilizado.";

            break;


        case "FIFO":

            victimIndex = FIFO(lines);

            reason =
                `FIFO seleccionó la vía ${victimIndex} ` +
                "porque contiene el bloque que " +
                "ingresó primero al conjunto.";

            break;


        case "LFU":

            victimIndex = LFU(lines);

            reason =
                `LFU seleccionó la vía ${victimIndex} ` +
                "porque contiene el bloque con " +
                "menor frecuencia de utilización.";

            break;


        case "RANDOM":

            victimIndex = RANDOM(
                lines,
                randomFunction
            );

            reason =
                `RANDOM seleccionó aleatoriamente ` +
                `la vía ${victimIndex}.`;

            break;
    }


    return {

        index: victimIndex,

        replacement: true,

        policy: selectedPolicy,

        reason
    };
}


/* ==========================================================
   8. ACTUALIZAR METADATOS DE UN HIT
========================================================== */

/*
   Se ejecuta cuando una operación encuentra
   el bloque solicitado en caché.

   lastUsed:
       Se actualiza al instante actual.

   frequency:
       Aumenta en una unidad.

   insertedAt:
       Permanece igual, porque FIFO depende
       de la fecha original de inserción.
*/

export function updateLineAccess(
    line,
    currentTime
) {

    if (!line || !line.valid) {

        return;
    }

    line.lastUsed = currentTime;

    line.frequency =
        (line.frequency ?? 0) + 1;
}


/* ==========================================================
   9. INICIALIZAR METADATOS DE UN BLOQUE
========================================================== */

/*
   Se ejecuta cuando un bloque de RAM
   se carga en una línea de caché.

   También se utiliza después de reemplazar
   un bloque anterior.

   Todos los metadatos deben reiniciarse
   para el bloque nuevo.

   El acceso que carga el bloque cuenta
   como su primer acceso.
*/

export function initializeLineMetadata(
    line,
    currentTime
) {

    if (!line) {

        throw new Error(
            "No se puede inicializar una línea inexistente."
        );
    }

    line.insertedAt = currentTime;

    line.lastUsed = currentTime;

    line.frequency = 1;
}


/* ==========================================================
   10. INFORMACIÓN DE LAS POLÍTICAS
========================================================== */

/*
   Proporciona descripciones que podemos
   utilizar en mensajes y explicaciones.
*/

export function getPolicyInfo(policy) {

    const policies = {

        LRU: {

            name: "Least Recently Used",

            spanish: "Menos recientemente utilizado",

            description:
                "Reemplaza el bloque que lleva más tiempo sin utilizarse.",

            advantage:
                "Aprovecha la localidad temporal de los accesos.",

            disadvantage:
                "Necesita almacenar información sobre los accesos recientes."
        },

        FIFO: {

            name: "First In, First Out",

            spanish: "Primero en entrar, primero en salir",

            description:
                "Reemplaza el bloque que ingresó primero a la caché.",

            advantage:
                "Es fácil de comprender e implementar.",

            disadvantage:
                "Puede reemplazar bloques utilizados frecuentemente."
        },

        LFU: {

            name: "Least Frequently Used",

            spanish: "Menos frecuentemente utilizado",

            description:
                "Reemplaza el bloque con menor número de accesos.",

            advantage:
                "Conserva los bloques más utilizados.",

            disadvantage:
                "Puede conservar bloques que fueron populares en el pasado."
        },

        RANDOM: {

            name: "Random Replacement",

            spanish: "Reemplazo aleatorio",

            description:
                "Selecciona aleatoriamente una vía del conjunto.",

            advantage:
                "No requiere registrar el historial de uso.",

            disadvantage:
                "Puede reemplazar un bloque utilizado frecuentemente."
        }
    };

    const selected =
        String(policy).toUpperCase();

    return policies[selected] ?? null;
}


/* ==========================================================
   11. OBTENER LISTA DE POLÍTICAS
========================================================== */

/*
   Función adicional que permite consultar
   las políticas disponibles.
*/

export function getAvailablePolicies() {

    return [
        "LRU",
        "FIFO",
        "LFU",
        "RANDOM"
    ];
}


/* ==========================================================
   12. OBTENER INFORMACIÓN DE UNA LÍNEA
========================================================== */

/*
   Función auxiliar para consultar los
   metadatos de una línea.

   Podrá utilizarse posteriormente en
   explicaciones paso a paso.
*/

export function getLineMetadata(line) {

    if (!line) {
        return null;
    }

    return {

        valid: Boolean(line.valid),

        insertedAt: line.insertedAt ?? 0,

        lastUsed: line.lastUsed ?? 0,

        frequency: line.frequency ?? 0,

        blockNumber: line.blockNumber ?? null,

        tag: line.tag ?? null
    };
}


/* ==========================================================
   FIN DEL ARCHIVO policies.js
========================================================== */