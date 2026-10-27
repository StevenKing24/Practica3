/* ==========================================================
   SIMULADOR DE MEMORIA CACHÉ 351
   Universidad Industrial de Santander

   Archivo: js/main.js
   Versión 3 - Controlador integrado

   Compatible con:
   - index.html V2
   - style.css V2
   - policies.js V2
   - cache.js V2
========================================================== */

import { CacheSimulator } from "./cache.js";


/* ==========================================================
   1. SECUENCIAS DEL TALLER
========================================================== */

const READ_TEST = [
    8, 124, 48, 165, 80,
    226, 58, 96, 212, 56
];

const REPLACEMENT_TEST = [
    8, 16, 24, 32, 40, 48, 56, 240,
    245, 125, 85, 101, 21, 43, 201, 95
];


/* ==========================================================
   2. ESTADO DE LA APLICACIÓN
========================================================== */

let simulator = null;

/* Generación */
let generationSteps = [];
let generationIndex = -1;
let generating = false;

/* Explicación de accesos */
let accessSteps = [];
let accessStepIndex = -1;
let explainedOperation = null;

/* Secuencias */
let sequenceAddresses = [];
let sequenceIndex = 0;
let sequenceRunning = false;

/* Historial */
let historyReviewIndex = null;

/* Visualización */
let selectedOperation = null;
let activeHighlight = null;
let explanationSnapshotIndex = null;


/* ==========================================================
   3. REFERENCIAS AL HTML
========================================================== */

const $ = id => document.getElementById(id);

const el = {

    /* Configuración */

    addressWidth: $("addressWidth"),
    cacheSize: $("cacheSize"),
    blockSize: $("blockSize"),
    associativity: $("associativity"),

    replacementPolicy: $("replacementPolicy"),
    writeHitPolicy: $("writeHitPolicy"),
    writeMissPolicy: $("writeMissPolicy"),

    btnDirectMapping: $("btnDirectMapping"),
    btnFullMapping: $("btnFullMapping"),
    mappingDescription: $("mappingDescription"),


    /* Generación */

    btnGenerate: $("btnGenerate"),
    btnReset: $("btnReset"),

    generationStepByStep: $("generationStepByStep"),
    generationControls: $("generationControls"),

    generationStepLabel: $("generationStepLabel"),
    generationProgress: $("generationProgress"),

    btnGenerationPrevious: $("btnGenerationPrevious"),
    btnGenerationNext: $("btnGenerationNext"),


    /* Resumen */

    systemStatus: $("systemStatus"),

    summaryMemory: $("summaryMemory"),
    summaryCache: $("summaryCache"),
    summaryBlock: $("summaryBlock"),

    summaryLines: $("summaryLines"),
    summarySets: $("summarySets"),
    summaryWays: $("summaryWays"),


    /* Lectura */

    readAddress: $("readAddress"),
    btnRead: $("btnRead"),


    /* Escritura */

    writeAddress: $("writeAddress"),
    writeValue: $("writeValue"),
    btnWrite: $("btnWrite"),

    btnFlush: $("btnFlush"),


    /* Dirección */

    stepByStep: $("stepByStep"),

    addressTotalBits: $("addressTotalBits"),
    fullBinaryAddress: $("fullBinaryAddress"),

    tagValue: $("tagValue"),
    indexValue: $("indexValue"),
    offsetValue: $("offsetValue"),

    tagBitsLabel: $("tagBitsLabel"),
    indexBitsLabel: $("indexBitsLabel"),
    offsetBitsLabel: $("offsetBitsLabel"),

    tagBox: $("tagBox"),
    indexBox: $("indexBox"),
    offsetBox: $("offsetBox"),

    addressExplanation: $("addressExplanation"),

    btnExplainAddress: $("btnExplainAddress"),

    accessStepControls: $("accessStepControls"),
    accessStepLabel: $("accessStepLabel"),
    accessProgress: $("accessProgress"),

    btnAccessPrevious: $("btnAccessPrevious"),
    btnAccessNext: $("btnAccessNext"),


    /* Secuencias */

    accessSequence: $("accessSequence"),

    sequenceStepByStep: $("sequenceStepByStep"),
    sequenceExplain: $("sequenceExplain"),

    sequenceControls: $("sequenceControls"),

    sequenceStepLabel: $("sequenceStepLabel"),
    sequenceProgress: $("sequenceProgress"),
    sequenceCurrentAddress: $("sequenceCurrentAddress"),

    btnExecuteSequence: $("btnExecuteSequence"),
    btnSequenceNext: $("btnSequenceNext"),
    btnSequenceFinish: $("btnSequenceFinish"),
    btnSequenceCancel: $("btnSequenceCancel"),

    btnLoadReadTest: $("btnLoadReadTest"),
    btnLoadReplacementTest: $("btnLoadReplacementTest"),


    /* Mensajes */

    simulationMessages: $("simulationMessages"),
    btnClearMessages: $("btnClearMessages"),


    /* Historial */

    historyTableBody: $("historyTableBody"),

    btnHistoryFirst: $("btnHistoryFirst"),
    btnHistoryPrevious: $("btnHistoryPrevious"),
    btnHistoryNext: $("btnHistoryNext"),
    btnHistoryLast: $("btnHistoryLast"),

    historyPosition: $("historyPosition"),

    historyReviewInfo: $("historyReviewInfo"),
    historyReviewDescription: $("historyReviewDescription"),

    btnReturnCurrent: $("btnReturnCurrent"),

    btnClearHistory: $("btnClearHistory"),
    btnExportHistory: $("btnExportHistory"),


    /* Caché */

    cacheDescription: $("cacheDescription"),
    cacheTableBody: $("cacheTableBody"),

    cacheBuildStatus: $("cacheBuildStatus"),
    cacheBuildStep: $("cacheBuildStep"),
    cacheBuildDescription: $("cacheBuildDescription"),


    /* RAM */

    memoryDescription: $("memoryDescription"),
    physicalMemory: $("physicalMemory"),

    memoryBuildStatus: $("memoryBuildStatus"),
    memoryBuildStep: $("memoryBuildStep"),
    memoryBuildDescription: $("memoryBuildDescription"),


    /* Estadísticas */

    totalAccesses: $("totalAccesses"),
    cacheHits: $("cacheHits"),
    cacheMisses: $("cacheMisses"),
    replacementCount: $("replacementCount"),

    hitRate: $("hitRate"),
    missRate: $("missRate"),
    amatValue: $("amatValue"),

    cacheAccessTime: $("cacheAccessTime"),
    memoryAccessTime: $("memoryAccessTime"),

    amatExplanation: $("amatExplanation"),


    /* Ayuda */

    btnHelp: $("btnHelp"),
    btnCloseHelp: $("btnCloseHelp"),
    helpModal: $("helpModal")

};


/* ==========================================================
   4. FUNCIONES AUXILIARES
========================================================== */

function setText(element, value) {

    if (element) {
        element.textContent = String(value);
    }
}


function show(element) {

    if (element) {
        element.hidden = false;
    }
}


function hide(element) {

    if (element) {
        element.hidden = true;
    }
}


function hex(value, digits = 2) {

    if (value === null || value === undefined) {
        return "--";
    }

    return Number(value)
        .toString(16)
        .toUpperCase()
        .padStart(digits, "0");
}


function binary(value, bits) {

    if (bits === 0) {
        return "—";
    }

    return Number(value)
        .toString(2)
        .padStart(bits, "0");
}


function escapeHTML(value) {

    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}


function percentage(current, total) {

    if (total <= 0) {
        return 0;
    }

    return Math.max(
        0,
        Math.min(100, current / total * 100)
    );
}


function showError(error) {

    const message = error instanceof Error
        ? error.message
        : String(error);

    console.error(error);

    addMessage(`ERROR: ${message}`, "error");
}


/* ==========================================================
   5. MENSAJES
========================================================== */

function addMessage(text, type = "info") {

    const validTypes = [
        "info",
        "success",
        "warning",
        "error"
    ];

    if (!validTypes.includes(type)) {
        type = "info";
    }

    const message = document.createElement("div");

    message.className = `message message-${type}`;

    const time = new Date().toLocaleTimeString("es-CO");

    const timestamp = document.createElement("strong");

    timestamp.textContent = `[${time}] `;

    const content = document.createElement("span");

    content.textContent = text;

    message.append(timestamp, content);

    el.simulationMessages.appendChild(message);

    el.simulationMessages.scrollTop =
        el.simulationMessages.scrollHeight;

    return message;
}


function addStepMessage(step, current, total) {

    document
        .querySelectorAll(".message-step-active")
        .forEach(message => {
            message.classList.remove("message-step-active");
        });

    const message = addMessage(
        `Paso ${current}/${total}: ` +
        `${step.title}. ${step.description}`,
        "info"
    );

    message.classList.add("message-step");

    const targets = [
        "tag",
        "index",
        "offset",
        "cache",
        "hit",
        "miss",
        "memory",
        "write"
    ];

    if (targets.includes(step.target)) {

        message.classList.add(
            `message-step-${step.target}`
        );
    }

    message.classList.add("message-step-active");

    return message;
}


function clearMessages() {

    el.simulationMessages.innerHTML = "";

    addMessage(
        "Panel de mensajes limpiado.",
        "info"
    );
}


/* ==========================================================
   6. VALIDAR ELEMENTOS HTML
========================================================== */

/*
   Esta función ayuda a detectar problemas
   de compatibilidad entre HTML y JavaScript.

   Si falta un elemento, se informa
   claramente en la consola.
*/

function validateHTML() {

    const missing = [];

    for (const [name, element] of Object.entries(el)) {

        if (!element) {
            missing.push(name);
        }
    }

    if (missing.length > 0) {

        throw new Error(
            "Faltan elementos HTML: " +
            missing.join(", ")
        );
    }

    return true;
}


/* ==========================================================
   7. ASOCIATIVIDAD E
========================================================== */

function updateAssociativityOptions() {

    const C = Number(el.cacheSize.value);
    const K = Number(el.blockSize.value);

    const previousE = Number(
        el.associativity.value
    );

    const B = C / K;

    el.associativity.innerHTML = "";

    if (
        !Number.isInteger(B) ||
        B < 1
    ) {

        el.associativity.add(
            new Option("Configuración inválida", "")
        );

        updateMappingDescription();

        return;
    }

    /*
       E puede ser cualquier potencia de 2
       que divida el número de líneas.
    */

    for (let E = 1; E <= B; E *= 2) {

        el.associativity.add(
            new Option(
                `${E} ${E === 1 ? "vía" : "vías"}`,
                String(E)
            )
        );
    }

    const available = Array.from(
        el.associativity.options
    ).map(option => Number(option.value));

    if (available.includes(previousE)) {

        el.associativity.value =
            String(previousE);

    } else {

        el.associativity.value = "1";
    }

    updateMappingDescription();
}


function updateMappingDescription() {

    const C = Number(el.cacheSize.value);
    const K = Number(el.blockSize.value);
    const E = Number(el.associativity.value);

    const B = C / K;

    let description = "Configuración inválida";

    if (
        Number.isInteger(B) &&
        B >= 1 &&
        E >= 1 &&
        E <= B
    ) {

        if (E === 1) {

            description = "Mapeo directo";

        } else if (E === B) {

            description = "Totalmente asociativo";

        } else {

            description =
                `Asociativo por conjuntos de ${E} vías`;
        }
    }

    setText(
        el.mappingDescription,
        `Organización: ${description}`
    );

    el.btnDirectMapping.classList.toggle(
        "active",
        E === 1
    );

    el.btnFullMapping.classList.toggle(
        "active",
        E === B && B > 1
    );
}


function selectDirectMapping() {

    el.associativity.value = "1";

    updateMappingDescription();

    configurationChanged();
}


function selectFullMapping() {

    const B =
        Number(el.cacheSize.value) /
        Number(el.blockSize.value);

    const option = Array.from(
        el.associativity.options
    ).find(item => Number(item.value) === B);

    if (!option) {

        addMessage(
            "No existe una configuración totalmente " +
            "asociativa válida con estos parámetros.",
            "warning"
        );

        return;
    }

    el.associativity.value = String(B);

    updateMappingDescription();

    configurationChanged();
}


function configurationChanged() {

    if (simulator) {

        addMessage(
            "Has cambiado los parámetros. " +
            "Presiona Generar sistema para aplicarlos.",
            "warning"
        );
    }
}


function getFormConfiguration() {

    const E = Number(el.associativity.value);

    if (!Number.isInteger(E) || E < 1) {

        throw new Error(
            "Selecciona una asociatividad válida."
        );
    }

    return {

        addressWidth:
            Number(el.addressWidth.value),

        cacheSize:
            Number(el.cacheSize.value),

        blockSize:
            Number(el.blockSize.value),

        associativity: E,

        replacementPolicy:
            el.replacementPolicy.value,

        writeHitPolicy:
            el.writeHitPolicy.value,

        writeMissPolicy:
            el.writeMissPolicy.value

    };
}


/* ==========================================================
   8. RESUMEN DE CONFIGURACIÓN
========================================================== */

function renderConfiguration() {

    if (!simulator) {
        return;
    }

    const c = simulator.getConfiguration();

    setText(
        el.summaryMemory,
        `${c.memorySize} B`
    );

    setText(
        el.summaryCache,
        `${c.cacheSize} B`
    );

    setText(
        el.summaryBlock,
        `${c.blockSize} B`
    );

    setText(
        el.summaryLines,
        c.lineCount
    );

    setText(
        el.summarySets,
        c.setCount
    );

    setText(
        el.summaryWays,
        c.associativity
    );

    setText(
        el.addressTotalBits,
        `${c.addressWidth} bits`
    );

    setText(
        el.tagBitsLabel,
        `${c.tagBits} bits`
    );

    setText(
        el.indexBitsLabel,
        `${c.indexBits} bits`
    );

    setText(
        el.offsetBitsLabel,
        `${c.offsetBits} bits`
    );

    el.systemStatus.classList.remove(
        "ready",
        "building"
    );

    if (generating) {

        setText(
            el.systemStatus,
            "Construyendo"
        );

        el.systemStatus.classList.add("building");

    } else {

        setText(
            el.systemStatus,
            "Listo"
        );

        el.systemStatus.classList.add("ready");
    }
}


/* ==========================================================
   9. HABILITAR OPERACIONES
========================================================== */

function updateButtons() {

    const ready =
        simulator !== null &&
        !generating;

    const manualReady =
        ready &&
        !sequenceRunning;

    el.btnRead.disabled = !manualReady;
    el.btnWrite.disabled = !manualReady;
    el.btnFlush.disabled = !manualReady;

    el.btnExecuteSequence.disabled =
        !manualReady;

    el.btnGenerate.disabled =
        sequenceRunning;

    el.btnReset.disabled =
        sequenceRunning;

    el.btnExplainAddress.disabled =
        !ready ||
        explainedOperation === null;

    el.btnSequenceNext.disabled =
        !sequenceRunning ||
        sequenceIndex >= sequenceAddresses.length;

    el.btnSequenceFinish.disabled =
        !sequenceRunning ||
        sequenceIndex >= sequenceAddresses.length;

    el.btnSequenceCancel.disabled =
        !sequenceRunning;
}


/* ==========================================================
   10. LIMPIAR ESTADOS VISUALES
========================================================== */

function clearHighlights() {

    activeHighlight = null;

    [
        el.tagBox,
        el.indexBox,
        el.offsetBox
    ].forEach(element => {

        element.classList.remove("active-step");
    });
}


function clearExplanation() {

    accessSteps = [];

    accessStepIndex = -1;

    explanationSnapshotIndex = null;

    hide(el.accessStepControls);

    clearHighlights();
}


function clearHistoryReview() {

    historyReviewIndex = null;

    hide(el.historyReviewInfo);

    $("panelCache").classList.remove(
        "history-review-mode"
    );

    $("panelMemoria").classList.remove(
        "history-review-mode"
    );
}


/* ==========================================================
   11. OBTENER ESTADO VISIBLE
========================================================== */

/*
   Prioridades:

   1. Vista de explicación de un acceso.
   2. Vista histórica.
   3. Estado actual.

   Ninguna vista altera la memoria real.
*/

function getVisibleSnapshot() {

    if (!simulator) {
        return null;
    }

    if (explanationSnapshotIndex !== null) {

        return simulator.getStateSnapshot(
            explanationSnapshotIndex
        );
    }

    if (historyReviewIndex !== null) {

        return simulator.getStateSnapshot(
            historyReviewIndex
        );
    }

    return simulator.getLatestStateSnapshot();
}


/* ==========================================================
   12. GENERAR SISTEMA
========================================================== */

function generateSystem() {

    try {

        if (sequenceRunning) {

            throw new Error(
                "Primero termina la secuencia activa."
            );
        }

        const config = getFormConfiguration();

        /*
           Crear motor.
        */

        const newSimulator = new CacheSimulator(
            config
        );

        simulator = newSimulator;

        /*
           Reiniciar navegación.
        */

        generationSteps = simulator.getGenerationSteps();

        generationIndex = -1;

        generating = el.generationStepByStep.checked;

        sequenceAddresses = [];
        sequenceIndex = 0;
        sequenceRunning = false;

        selectedOperation = null;
        explainedOperation = null;

        clearExplanation();
        clearHistoryReview();

        hide(el.sequenceControls);

        el.simulationMessages.innerHTML = "";

        el.memoryBuildStatus.classList.remove(
            "building",
            "completed"
        );

        el.cacheBuildStatus.classList.remove(
            "building",
            "completed"
        );

        resetAddressDisplay();

        renderConfiguration();

        /*
           Generación explicada.
        */

        if (generating) {

            show(el.generationControls);

            show(el.memoryBuildStatus);
            show(el.cacheBuildStatus);

            showGenerationStep(0);

            addMessage(
                "Generación paso a paso activada. " +
                "Utiliza Anterior y Siguiente.",
                "info"
            );

        } else {

            hide(el.generationControls);

            show(el.memoryBuildStatus);
            show(el.cacheBuildStatus);

            el.memoryBuildStatus.classList.add(
                "completed"
            );

            el.cacheBuildStatus.classList.add(
                "completed"
            );

            setText(
                el.memoryBuildStep,
                "Completado"
            );

            setText(
                el.cacheBuildStep,
                "Completado"
            );

            setText(
                el.memoryBuildDescription,
                "RAM inicializada con valores " +
                "pseudoaleatorios reproducibles."
            );

            setText(
                el.cacheBuildDescription,
                "Conjuntos y vías inicializados. " +
                "Todas las líneas comienzan con V=0."
            );

            renderAll();

            addMessage(
                "Sistema generado correctamente.",
                "success"
            );

            addMessage(
                `Semilla de RAM: ` +
                simulator.getConfiguration().memorySeed,
                "info"
            );
        }

        updateButtons();

    } catch (error) {

        showError(error);
    }
}


/* ==========================================================
   13. GENERACIÓN PASO A PASO
========================================================== */

function showGenerationStep(index) {

    if (!simulator || !generating) {
        return;
    }

    if (
        index < 0 ||
        index >= generationSteps.length
    ) {
        return;
    }

    generationIndex = index;

    const step = generationSteps[index];

    const total = generationSteps.length;

    setText(
        el.generationStepLabel,
        `Paso ${index + 1} de ${total}: ${step.title}`
    );

    el.generationProgress.style.width =
        `${percentage(index + 1, total)}%`;

    el.btnGenerationPrevious.disabled =
        index === 0;

    setText(
        el.btnGenerationNext,
        index === total - 1
            ? "Finalizar ✓"
            : "Siguiente →"
    );

    /*
       Preparar indicadores.
    */

    el.memoryBuildStatus.classList.remove(
        "building",
        "completed"
    );

    el.cacheBuildStatus.classList.remove(
        "building",
        "completed"
    );

    /*
       PASO 1:
       Calcular la capacidad de RAM.
    */

    if (index === 0) {

        el.physicalMemory.innerHTML = "";

        el.cacheTableBody.innerHTML = "";

        setText(
            el.memoryBuildStep,
            "Calculando"
        );

        setText(
            el.memoryBuildDescription,
            step.description
        );

        setText(
            el.cacheBuildStep,
            "Pendiente"
        );

        setText(
            el.cacheBuildDescription,
            "Esperando cálculo de caché."
        );

        el.memoryBuildStatus.classList.add(
            "building"
        );
    }

    /*
       PASO 2:
       Mostrar RAM.
    */

    if (index === 1) {

        renderMemory();

        el.cacheTableBody.innerHTML = "";

        setText(
            el.memoryBuildStep,
            "Bloques creados"
        );

        setText(
            el.memoryBuildDescription,
            step.description
        );

        el.memoryBuildStatus.classList.add(
            "completed"
        );
    }

    /*
       PASOS 3, 4 Y 5:
       Construcción de caché.
    */

    if (index >= 2 && index <= 4) {

        renderMemory();
        renderCache();

        setText(
            el.memoryBuildStep,
            "Completado"
        );

        setText(
            el.cacheBuildStep,
            `Etapa ${index + 1}`
        );

        setText(
            el.cacheBuildDescription,
            step.description
        );

        el.memoryBuildStatus.classList.add(
            "completed"
        );

        el.cacheBuildStatus.classList.add(
            index === 4
                ? "completed"
                : "building"
        );
    }

    /*
       PASOS 6 Y 7:
       Campos TIO y sistema listo.
    */

    if (index >= 5) {

        renderMemory();
        renderCache();

        el.memoryBuildStatus.classList.add(
            "completed"
        );

        el.cacheBuildStatus.classList.add(
            "completed"
        );

        setText(
            el.cacheBuildStep,
            "Completado"
        );

        setText(
            el.cacheBuildDescription,
            "Memoria caché preparada."
        );

        if (index === 5) {

            setText(
                el.addressExplanation,
                step.description
            );
        }
    }

    renderConfiguration();

    addStepMessage(
        {
            title: step.title,
            description:
                `${step.description} ${step.formula}`,
            target: step.target
        },
        index + 1,
        total
    );

    updateButtons();
}


function previousGenerationStep() {

    showGenerationStep(
        generationIndex - 1
    );
}


function nextGenerationStep() {

    if (!generating) {
        return;
    }

    if (
        generationIndex ===
        generationSteps.length - 1
    ) {

        generating = false;

        hide(el.generationControls);

        renderAll();
        updateButtons();

        addMessage(
            "Construcción finalizada. " +
            "El sistema ya puede realizar accesos.",
            "success"
        );

        return;
    }

    showGenerationStep(
        generationIndex + 1
    );
}


/* ==========================================================
   14. REPRESENTAR MEMORIA CACHÉ
========================================================== */

function renderCache() {

    if (!simulator) {
        return;
    }

    const snapshot = getVisibleSnapshot();

    if (!snapshot) {
        return;
    }

    const c = simulator.getConfiguration();

    const tbody = el.cacheTableBody;

    tbody.innerHTML = "";

    el.cacheDescription.innerHTML = `

        <p>
            <strong>Organización:</strong>
            ${escapeHTML(c.mappingType)}
        </p>

        <p>
            <strong>Conjuntos:</strong>
            ${c.setCount}
            |
            <strong>Vías:</strong>
            ${c.associativity}
        </p>

        <p>
            <strong>Capacidad:</strong>
            ${c.cacheSize} bytes
            |
            <strong>Bloque:</strong>
            ${c.blockSize} bytes
        </p>

    `;

    snapshot.cache.forEach((set, setIndex) => {

        set.forEach((line, way) => {

            const row = tbody.insertRow();

            row.dataset.set = setIndex;
            row.dataset.way = way;

            if (line.valid) {

                row.classList.add("cache-valid");

            } else {

                row.classList.add("cache-invalid");
            }

            if (line.dirty) {

                row.classList.add("cache-dirty");
            }

            /*
               Resaltado de búsqueda.
            */

            if (
                activeHighlight &&
                activeHighlight.setIndex === setIndex
            ) {

                if (
                    activeHighlight.type === "cache"
                ) {

                    row.classList.add(
                        "cache-inspecting"
                    );
                }

                if (activeHighlight.way === way) {

                    if (
                        activeHighlight.type === "hit"
                    ) {

                        row.classList.add(
                            "cache-hit-highlight"
                        );
                    }

                    if (
                        activeHighlight.type === "miss"
                    ) {

                        row.classList.add(
                            "cache-miss-highlight"
                        );
                    }

                    if (
                        activeHighlight.type === "replacement"
                    ) {

                        row.classList.add(
                            "cache-replacement-highlight"
                        );
                    }
                }
            }

            /*
               Conjunto y vía.
            */

            row.insertCell().textContent = setIndex;

            row.insertCell().textContent = way;

            /*
               Bit V.
            */

            const validCell = row.insertCell();

            const validBit = document.createElement(
                "span"
            );

            validBit.className = line.valid
                ? "bit bit-valid"
                : "bit bit-invalid";

            validBit.textContent =
                line.valid ? "1" : "0";

            validCell.appendChild(validBit);

            /*
               Bit D.
            */

            const dirtyCell = row.insertCell();

            const dirtyBit = document.createElement(
                "span"
            );

            dirtyBit.className = line.dirty
                ? "bit bit-dirty"
                : "bit bit-invalid";

            dirtyBit.textContent =
                line.dirty ? "1" : "0";

            dirtyCell.appendChild(dirtyBit);

            /*
               Tag.
            */

            row.insertCell().textContent =
                line.valid
                    ? binary(line.tag, c.tagBits)
                    : "—";

            /*
               Datos.
            */

            const dataCell = row.insertCell();

            if (line.valid) {

                line.data.forEach((value, offset) => {

                    const byte =
                        document.createElement("span");

                    byte.className = "cache-byte";

                    byte.textContent = hex(value);

                    if (
                        activeHighlight &&
                        activeHighlight.setIndex === setIndex &&
                        activeHighlight.way === way &&
                        activeHighlight.offset === offset
                    ) {

                        byte.classList.add(
                            "active-byte"
                        );
                    }

                    dataCell.appendChild(byte);
                });

            } else {

                dataCell.textContent = "—";
            }

            /*
               Estado.
            */

            row.insertCell().textContent =
                !line.valid
                    ? "Vacía"
                    : line.dirty
                        ? "Modificada"
                        : "Válida";

            /*
               Metadatos.
            */

            if (line.valid) {

                row.title =
                    `Bloque ${line.blockNumber}\n` +
                    `Frecuencia: ${line.frequency}\n` +
                    `Último uso: ${line.lastUsed}\n` +
                    `Inserción: ${line.insertedAt}`;
            }
        });
    });
}


/* ==========================================================
   15. REPRESENTAR RAM
========================================================== */

function renderMemory() {

    if (!simulator) {
        return;
    }

    const snapshot = getVisibleSnapshot();

    if (!snapshot) {
        return;
    }

    const memory = snapshot.memory;

    const c = simulator.getConfiguration();

    const container = el.physicalMemory;

    container.innerHTML = "";

    el.memoryDescription.innerHTML = `

        <p>
            <strong>Capacidad:</strong>
            ${c.memorySize} bytes
        </p>

        <p>
            <strong>Bloques:</strong>
            ${c.memorySize / c.blockSize}
        </p>

        <p>
            <strong>Semilla inicial:</strong>
            ${c.memorySeed}
        </p>

    `;

    const fragment = document.createDocumentFragment();

    for (
        let start = 0;
        start < memory.length;
        start += c.blockSize
    ) {

        const row = document.createElement("div");

        row.className = "memory-row";

        row.dataset.block =
            Math.floor(start / c.blockSize);

        const label = document.createElement("span");

        label.className = "memory-address";

        label.textContent =
            simulator.formatAddress(start);

        row.appendChild(label);

        const bytes = document.createElement("div");

        bytes.className = "memory-bytes";

        for (
            let offset = 0;
            offset < c.blockSize;
            offset++
        ) {

            const address = start + offset;

            if (address >= memory.length) {
                break;
            }

            const byte = document.createElement("span");

            byte.className = "memory-byte";

            byte.dataset.address = address;

            byte.textContent = hex(memory[address]);

            byte.title =
                `${simulator.formatAddress(address)} = ` +
                `0x${hex(memory[address])}`;

            /*
               Resaltados.
            */

            if (activeHighlight) {

                const blockNumber = Math.floor(
                    address / c.blockSize
                );

                if (
                    blockNumber ===
                    activeHighlight.blockNumber
                ) {

                    if (
                        activeHighlight.type === "memory"
                    ) {

                        byte.classList.add(
                            "memory-inspecting"
                        );
                    }

                    if (
                        activeHighlight.type === "transfer"
                    ) {

                        byte.classList.add(
                            "memory-transfer"
                        );
                    }
                }

                if (
                    address === activeHighlight.address
                ) {

                    if (
                        activeHighlight.type === "read"
                    ) {

                        byte.classList.add(
                            "memory-read-active"
                        );
                    }

                    if (
                        activeHighlight.type === "write"
                    ) {

                        byte.classList.add(
                            "memory-write-active"
                        );
                    }
                }
            }

            bytes.appendChild(byte);
        }

        row.appendChild(bytes);

        fragment.appendChild(row);
    }

    container.appendChild(fragment);
}


/* ==========================================================
   16. DESCOMPOSICIÓN DE DIRECCIÓN
========================================================== */

function resetAddressDisplay() {

    const m = simulator
        ? simulator.getConfiguration().addressWidth
        : Number(el.addressWidth.value);

    setText(
        el.addressTotalBits,
        `${m} bits`
    );

    setText(
        el.fullBinaryAddress,
        "Dirección todavía no seleccionada"
    );

    if (simulator) {

        const c = simulator.getConfiguration();

        setText(
            el.tagValue,
            `${c.tagBits} bits`
        );

        setText(
            el.indexValue,
            `${c.indexBits} bits`
        );

        setText(
            el.offsetValue,
            `${c.offsetBits} bits`
        );

        setText(
            el.tagBitsLabel,
            `${c.tagBits} bits`
        );

        setText(
            el.indexBitsLabel,
            `${c.indexBits} bits`
        );

        setText(
            el.offsetBitsLabel,
            `${c.offsetBits} bits`
        );

    } else {

        setText(el.tagValue, "Pendiente");
        setText(el.indexValue, "Pendiente");
        setText(el.offsetValue, "Pendiente");
    }

    setText(
        el.addressExplanation,
        "Introduce una dirección para analizar " +
        "sus campos Tag, Index y Offset."
    );

    updateButtons();
}


function renderAddress(decoded) {

    if (!decoded) {

        resetAddressDisplay();

        return;
    }

    setText(
        el.fullBinaryAddress,
        decoded.binary
    );

    setText(
        el.addressTotalBits,
        `${decoded.binary.length} bits`
    );

    setText(
        el.tagValue,
        decoded.tagBinary || "—"
    );

    setText(
        el.indexValue,
        decoded.indexBinary || "—"
    );

    setText(
        el.offsetValue,
        decoded.offsetBinary || "—"
    );

    setText(
        el.tagBitsLabel,
        `${decoded.tagBits} bits`
    );

    setText(
        el.indexBitsLabel,
        `${decoded.indexBits} bits`
    );

    setText(
        el.offsetBitsLabel,
        `${decoded.offsetBits} bits`
    );

    el.addressExplanation.innerHTML = `

        <p>
            <strong>Dirección:</strong>
            ${escapeHTML(decoded.hexadecimal)}
        </p>

        <p>
            <strong>Binario:</strong>
            ${decoded.binary}
        </p>

        <p>
            <strong>Bloque:</strong>
            ${decoded.blockNumber}
        </p>

        <p>
            <strong>Conjunto:</strong>
            ${decoded.setIndex}
        </p>

        <p>
            <strong>Offset:</strong>
            ${decoded.offset}
        </p>

        <p>
            <strong>Inicio del bloque:</strong>
            ${simulator.formatAddress(decoded.blockStart)}
        </p>

    `;

    updateButtons();
}


/* ==========================================================
   17. PROCESAR LECTURAS Y ESCRITURAS
========================================================== */

function processOperation(result, options = {}) {

    selectedOperation = result;
    explainedOperation = result;

    /*
       Mostrar siempre el estado actual
       después de una operación nueva.
    */

    clearHistoryReview();
    clearExplanation();

    renderAddress(result.decoded);

    /*
       Resaltar el byte consultado.
    */

    activeHighlight = {

        type:
            result.operation === "WRITE"
                ? "write"
                : "read",

        address: result.address,
        blockNumber: result.blockNumber,
        setIndex: result.setIndex,
        way: result.way,
        offset: result.offset
    };

    renderAll();

    const operationName =
        result.operation === "READ"
            ? "LECTURA"
            : "ESCRITURA";

    addMessage(
        `${operationName} ${result.addressHex}: ` +
        `${result.hit ? "HIT" : "MISS"}. ` +
        `Valor: ${result.valueHex}.`,
        result.hit ? "success" : "warning"
    );

    if (result.missType) {

        addMessage(
            `Tipo de fallo: ${result.missType}.`,
            "info"
        );
    }

    if (result.replacement) {

        addMessage(
            `Se reemplazó el bloque ${result.evictedBlock}.`,
            "warning"
        );
    }

    if (result.writeBack) {

        addMessage(
            "El bloque reemplazado estaba sucio " +
            "y fue escrito en RAM.",
            "warning"
        );
    }

    /*
       Explicación breve opcional.
    */

    if (
        options.showReason !== false &&
        el.stepByStep.checked
    ) {

        addMessage(
            result.reason,
            "info"
        );
    }

    updateButtons();
}


/* ==========================================================
   18. LECTURA MANUAL
========================================================== */

function handleRead() {

    try {

        if (!simulator || generating || sequenceRunning) {

            throw new Error(
                "El sistema no está preparado para leer."
            );
        }

        const address =
            el.readAddress.value.trim();

        if (!address) {

            throw new Error(
                "Introduce una dirección."
            );
        }

        const result = simulator.read(address);

        processOperation(result);

    } catch (error) {

        showError(error);
    }
}


/* ==========================================================
   19. ESCRITURA MANUAL
========================================================== */

function handleWrite() {

    try {

        if (!simulator || generating || sequenceRunning) {

            throw new Error(
                "El sistema no está preparado para escribir."
            );
        }

        const address =
            el.writeAddress.value.trim();

        const value =
            el.writeValue.value.trim();

        if (!address || !value) {

            throw new Error(
                "Introduce una dirección y un valor."
            );
        }

        const result = simulator.write(
            address,
            value
        );

        processOperation(result);

    } catch (error) {

        showError(error);
    }
}


/* ==========================================================
   20. FLUSH
========================================================== */

function handleFlush() {

    try {

        if (!simulator || generating || sequenceRunning) {

            throw new Error(
                "No puedes ejecutar Flush en este momento."
            );
        }

        const result = simulator.flush();

        selectedOperation = null;
        explainedOperation = null;

        clearExplanation();
        clearHistoryReview();

        resetAddressDisplay();

        renderAll();

        addMessage(
            result.message,
            "success"
        );

    } catch (error) {

        showError(error);
    }
}


/* ==========================================================
   21. CREAR PASOS DE EXPLICACIÓN
========================================================== */

function createAccessSteps(operation) {

    if (!operation?.decoded) {
        return [];
    }

    const d = operation.decoded;

    const steps = [

        {
            title: "Identificar dirección",

            description:
                `La dirección ${d.hexadecimal} se representa ` +
                `con ${d.binary.length} bits: ${d.binary}.`,

            target: "address",

            stage: "before"
        },

        {
            title: "Calcular número de bloque",

            description:
                `Bloque = floor(${d.address} / ` +
                `${simulator.config.blockSize}) = ` +
                `${d.blockNumber}.`,

            target: "memory",

            stage: "before"
        },

        {
            title: "Obtener Tag",

            description:
                `Tag = ${d.tagBinary || "—"}. ` +
                `Se utilizan ${d.tagBits} bits.`,

            target: "tag",

            stage: "before"
        },

        {
            title: "Obtener Index",

            description:
                `Index = ${d.indexBinary || "—"}. ` +
                `El conjunto correspondiente es ${d.setIndex}.`,

            target: "index",

            stage: "before"
        },

        {
            title: "Obtener Offset",

            description:
                `Offset = ${d.offsetBinary || "—"}. ` +
                `El byte solicitado ocupa la posición ` +
                `${d.offset} del bloque.`,

            target: "offset",

            stage: "before"
        },

        {
            title: "Consultar memoria caché",

            description:
                `Se revisan las vías del conjunto ` +
                `${d.setIndex} para buscar el Tag ` +
                `${d.tagBinary || "—"}.`,

            target: "cache",

            stage: "before"
        },

        {
            title: operation.hit
                ? "Se encontró el bloque"
                : "No se encontró el bloque",

            description: operation.hit
                ? `CACHE HIT. El bloque estaba ` +
                  `en la vía ${operation.way}.`
                : `CACHE MISS (${operation.missType}). ` +
                  `El bloque solicitado no estaba en caché.`,

            target: operation.hit
                ? "hit"
                : "miss",

            stage: "before"
        }

    ];

    /*
       Transferencia de RAM en un Miss
       con asignación de línea.
    */

    if (
        !operation.hit &&
        (
            operation.operation === "READ" ||
            operation.allocated
        )
    ) {

        if (operation.writeBack) {

            steps.push({

                title: "Escribir bloque sucio",

                description:
                    `El bloque ${operation.evictedBlock} ` +
                    `estaba modificado. Se escribió en RAM ` +
                    `antes de reemplazarlo.`,

                target: "write",

                stage: "before"
            });
        }

        steps.push({

            title: "Cargar bloque desde RAM",

            description:
                `Se transfiere el bloque ${d.blockNumber} ` +
                `desde ${simulator.formatAddress(d.blockStart)} ` +
                `hasta la vía ${operation.way} de caché.`,

            target: "memory",

            stage: "after"
        });
    }

    /*
       Resultado final.
    */

    steps.push({

        title: "Resultado del acceso",

        description:
            `${operation.operation === "READ"
                ? "Lectura"
                : "Escritura"} en ${operation.addressHex}. ` +
            `${operation.hit ? "HIT" : "MISS"}. ` +
            `Valor: ${operation.valueHex}. ` +
            operation.reason,

        target: operation.operation === "WRITE"
            ? "write"
            : operation.hit
                ? "hit"
                : "memory",

        stage: "after"
    });

    return steps;
}


/* ==========================================================
   22. INICIAR EXPLICACIÓN
========================================================== */

function startAccessExplanation() {

    if (!simulator || !explainedOperation) {

        addMessage(
            "Primero realiza o selecciona un acceso.",
            "warning"
        );

        return;
    }

    accessSteps = createAccessSteps(
        explainedOperation
    );

    if (accessSteps.length === 0) {
        return;
    }

    accessStepIndex = -1;

    show(el.accessStepControls);

    showAccessStep(0);
}


/* ==========================================================
   23. MOSTRAR PASO DE EXPLICACIÓN
========================================================== */

function showAccessStep(index) {

    if (
        index < 0 ||
        index >= accessSteps.length
    ) {
        return;
    }

    accessStepIndex = index;

    const step = accessSteps[index];

    const operation = explainedOperation;

    const d = operation.decoded;

    const total = accessSteps.length;

    setText(
        el.accessStepLabel,
        `Paso ${index + 1} de ${total}: ${step.title}`
    );

    el.accessProgress.style.width =
        `${percentage(index + 1, total)}%`;

    el.btnAccessPrevious.disabled =
        index === 0;

    el.btnAccessNext.disabled =
        index === total - 1;

    clearHighlights();

    /*
       Visualizar estado previo o posterior.

       Las fotografías pertenecen a una operación
       ya ejecutada. No se repite el acceso.
    */

    const afterIndex = operation.snapshotIndex;

    const beforeIndex = Math.max(
        0,
        afterIndex - 1
    );

    explanationSnapshotIndex =
        step.stage === "before"
            ? beforeIndex
            : afterIndex;

    /*
       Resaltar campo TIO.
    */

    if (step.target === "tag") {

        el.tagBox.classList.add("active-step");
    }

    if (step.target === "index") {

        el.indexBox.classList.add("active-step");
    }

    if (step.target === "offset") {

        el.offsetBox.classList.add("active-step");
    }

    /*
       Resaltar memorias.
    */

    activeHighlight = {

        type: step.target,

        address: d.address,

        blockNumber: d.blockNumber,

        setIndex: d.setIndex,

        way: operation.way,

        offset: d.offset
    };

    /*
       Mostrar estado y descomposición.
    */

    renderCache();

    renderMemory();

    renderAddress(d);

    /*
       Mostrar texto del paso activo.
    */

    setText(
        el.addressExplanation,
        step.description
    );

    addStepMessage(
        step,
        index + 1,
        total
    );
}


function previousAccessStep() {

    showAccessStep(
        accessStepIndex - 1
    );
}


function nextAccessStep() {

    showAccessStep(
        accessStepIndex + 1
    );
}


/* ==========================================================
   24. SECUENCIAS DE PRUEBA
========================================================== */

function loadReadTest() {

    el.accessSequence.value =
        READ_TEST.join(", ");

    addMessage(
        "Secuencia de lecturas cargada.",
        "info"
    );
}


function loadReplacementTest() {

    el.accessSequence.value =
        REPLACEMENT_TEST.join(", ");

    addMessage(
        "Secuencia de reemplazo cargada.",
        "info"
    );
}


/* ==========================================================
   25. VALIDAR SECUENCIA
========================================================== */

function parseSequence() {

    if (!simulator) {

        throw new Error(
            "Primero genera el sistema."
        );
    }

    const tokens = el.accessSequence.value
        .split(/[,;\s]+/)
        .map(value => value.trim())
        .filter(Boolean);

    if (tokens.length === 0) {

        throw new Error(
            "Introduce al menos una dirección."
        );
    }

    /*
       Se validan todas las direcciones
       antes de ejecutar la secuencia.
    */

    return tokens.map(
        token => simulator.parseAddress(token)
    );
}


/* ==========================================================
   26. INICIAR SECUENCIA
========================================================== */

function startSequence() {

    try {

        if (!simulator || generating) {

            throw new Error(
                "Primero finaliza la generación."
            );
        }

        if (sequenceRunning) {

            throw new Error(
                "Ya existe una secuencia activa."
            );
        }

        sequenceAddresses = parseSequence();

        sequenceIndex = 0;

        clearExplanation();
        clearHistoryReview();

        /*
           MODO AUTOMÁTICO.
        */

        if (!el.sequenceStepByStep.checked) {

            let hits = 0;
            let misses = 0;
            let replacements = 0;

            let lastResult = null;

            for (const address of sequenceAddresses) {

                const result = simulator.read(address);

                lastResult = result;

                if (result.hit) {
                    hits++;
                } else {
                    misses++;
                }

                if (result.replacement) {
                    replacements++;
                }

                if (el.sequenceExplain.checked) {

                    addMessage(
                        `${result.addressHex}: ` +
                        `${result.hit ? "HIT" : "MISS"}` +
                        `${result.missType
                            ? ` (${result.missType})`
                            : ""}.`,
                        result.hit ? "success" : "warning"
                    );
                }
            }

            if (lastResult) {

                selectedOperation = lastResult;
                explainedOperation = lastResult;

                activeHighlight = {

                    type: lastResult.hit
                        ? "hit"
                        : "miss",

                    address: lastResult.address,

                    blockNumber: lastResult.blockNumber,

                    setIndex: lastResult.setIndex,

                    way: lastResult.way,

                    offset: lastResult.offset
                };

                renderAddress(lastResult.decoded);
            }

            renderAll();

            addMessage(
                `Secuencia completada: ` +
                `${sequenceAddresses.length} accesos, ` +
                `${hits} hits, ${misses} misses y ` +
                `${replacements} reemplazos.`,
                "success"
            );

            return;
        }

        /*
           MODO ACCESO POR ACCESO.
        */

        sequenceRunning = true;

        show(el.sequenceControls);

        updateSequenceProgress();

        updateButtons();

        addMessage(
            "Secuencia preparada. " +
            "Pulsa Ejecutar siguiente para procesar " +
            "una dirección.",
            "info"
        );

    } catch (error) {

        showError(error);
    }
}


/* ==========================================================
   27. ACTUALIZAR PROGRESO DE SECUENCIA
========================================================== */

function updateSequenceProgress() {

    const total = sequenceAddresses.length;

    setText(
        el.sequenceStepLabel,
        `Acceso ${sequenceIndex} de ${total}`
    );

    el.sequenceProgress.style.width =
        `${percentage(sequenceIndex, total)}%`;

    if (sequenceIndex < total) {

        setText(
            el.sequenceCurrentAddress,
            simulator.formatAddress(
                sequenceAddresses[sequenceIndex]
            )
        );

    } else {

        setText(
            el.sequenceCurrentAddress,
            "Terminada"
        );
    }

    updateButtons();
}


/* ==========================================================
   28. EJECUTAR SIGUIENTE ACCESO
========================================================== */

function executeNextSequenceAccess() {

    if (!sequenceRunning) {
        return;
    }

    if (
        sequenceIndex >= sequenceAddresses.length
    ) {

        finishSequence();

        return;
    }

    try {

        const address =
            sequenceAddresses[sequenceIndex];

        const result = simulator.read(address);

        sequenceIndex++;

        selectedOperation = result;
        explainedOperation = result;

        clearExplanation();
        clearHistoryReview();

        activeHighlight = {

            type: result.hit ? "hit" : "miss",

            address: result.address,

            blockNumber: result.blockNumber,

            setIndex: result.setIndex,

            way: result.way,

            offset: result.offset
        };

        renderAddress(result.decoded);

        renderAll();

        addMessage(
            `Acceso ${sequenceIndex}: ` +
            `${result.addressHex} → ` +
            `${result.hit ? "HIT" : "MISS"}` +
            `${result.missType
                ? ` (${result.missType})`
                : ""}.`,
            result.hit ? "success" : "warning"
        );

        /*
           Mostrar los cálculos del acceso.
        */

        if (el.sequenceExplain.checked) {

            const steps = createAccessSteps(result);

            steps.forEach((step, index) => {

                addStepMessage(
                    step,
                    index + 1,
                    steps.length
                );
            });
        }

        updateSequenceProgress();

        if (
            sequenceIndex >= sequenceAddresses.length
        ) {

            finishSequence();
        }

    } catch (error) {

        showError(error);
    }
}


/* ==========================================================
   29. EJECUTAR RESTANTES
========================================================== */

function executeRemainingSequence() {

    if (!sequenceRunning) {
        return;
    }

    while (
        sequenceRunning &&
        sequenceIndex < sequenceAddresses.length
    ) {

        executeNextSequenceAccess();
    }
}


/* ==========================================================
   30. FINALIZAR SECUENCIA
========================================================== */

function finishSequence() {

    sequenceRunning = false;

    hide(el.sequenceControls);

    updateButtons();

    addMessage(
        "Secuencia finalizada correctamente.",
        "success"
    );

    renderAll();
}


/* ==========================================================
   31. CANCELAR SECUENCIA
========================================================== */

function cancelSequence() {

    sequenceRunning = false;

    sequenceAddresses = [];

    sequenceIndex = 0;

    hide(el.sequenceControls);

    updateButtons();

    addMessage(
        "Secuencia cancelada. Los accesos ya " +
        "ejecutados se conservaron.",
        "warning"
    );
}


/* ==========================================================
   32. HISTORIAL DE OPERACIONES
========================================================== */

function renderHistory() {

    if (!simulator) {
        return;
    }

    const tbody = el.historyTableBody;

    tbody.innerHTML = "";

    const history = simulator.getHistory();

    if (history.length === 0) {

        const row = tbody.insertRow();

        const cell = row.insertCell();

        cell.colSpan = 7;

        cell.className = "empty-row";

        cell.textContent =
            "No hay operaciones registradas.";

        updateHistoryControls();

        return;
    }

    history.forEach(entry => {

        const row = tbody.insertRow();

        row.dataset.snapshot = entry.snapshotIndex;

        if (
            historyReviewIndex === entry.snapshotIndex
        ) {

            row.classList.add(
                "history-selected"
            );
        }

        row.style.cursor = "pointer";

        /*
           Evento.
        */

        row.insertCell().textContent =
            entry.number;

        /*
           Operación.
        */

        row.insertCell().textContent =
            entry.operation === "READ"
                ? "Lectura"
                : entry.operation === "WRITE"
                    ? "Escritura"
                    : "Flush";

        /*
           Dirección.
        */

        row.insertCell().textContent =
            entry.addressHex ?? "—";

        /*
           Resultado.
        */

        const resultCell = row.insertCell();

        if (entry.operation === "FLUSH") {

            resultCell.textContent = "—";

        } else {

            const badge =
                document.createElement("span");

            badge.className = entry.hit
                ? "badge badge-hit"
                : "badge badge-miss";

            badge.textContent =
                entry.hit ? "HIT" : "MISS";

            resultCell.appendChild(badge);
        }

        /*
           Tipo de fallo.
        */

        row.insertCell().textContent =
            entry.missType ?? "—";

        /*
           Conjunto.
        */

        row.insertCell().textContent =
            entry.setIndex ?? "—";

        /*
           Reemplazo.
        */

        row.insertCell().textContent =
            entry.replacement
                ? `Sí (${entry.evictedBlock})`
                : "No";

        /*
           Seleccionar estado histórico.
        */

        row.addEventListener("click", () => {

            reviewHistoryState(
                entry.snapshotIndex
            );
        });
    });

    updateHistoryControls();
}


/* ==========================================================
   33. REVISAR ESTADO HISTÓRICO
========================================================== */

function reviewHistoryState(index) {

    if (!simulator) {
        return;
    }

    try {

        const snapshot =
            simulator.getStateSnapshot(index);

        /*
           Detener únicamente la vista explicativa.
        */

        clearExplanation();

        historyReviewIndex = index;

        const history = simulator.getHistory();

        selectedOperation = history.find(
            entry => entry.snapshotIndex === index
        ) ?? null;

        explainedOperation =
            selectedOperation?.decoded
                ? selectedOperation
                : null;

        if (explainedOperation) {

            renderAddress(
                explainedOperation.decoded
            );

        } else {

            resetAddressDisplay();
        }

        show(el.historyReviewInfo);

        setText(
            el.historyReviewDescription,
            `Estado ${index}: ` +
            `${snapshot.operation.description ||
              snapshot.operation.operation}.`
        );

        $("panelCache").classList.add(
            "history-review-mode"
        );

        $("panelMemoria").classList.add(
            "history-review-mode"
        );

        renderAll();

    } catch (error) {

        showError(error);
    }
}


/* ==========================================================
   34. BOTONES DEL HISTORIAL
========================================================== */

function historyFirst() {

    if (!simulator) {
        return;
    }

    reviewHistoryState(0);
}


function historyPrevious() {

    if (!simulator) {
        return;
    }

    const current = historyReviewIndex === null
        ? simulator.getStateCount() - 1
        : historyReviewIndex;

    reviewHistoryState(
        Math.max(0, current - 1)
    );
}


function historyNext() {

    if (!simulator) {
        return;
    }

    const current = historyReviewIndex === null
        ? simulator.getStateCount() - 1
        : historyReviewIndex;

    reviewHistoryState(
        Math.min(
            simulator.getStateCount() - 1,
            current + 1
        )
    );
}


function historyLast() {

    if (!simulator) {
        return;
    }

    reviewHistoryState(
        simulator.getStateCount() - 1
    );
}


/* ==========================================================
   35. VOLVER AL ESTADO ACTUAL
========================================================== */

function returnToCurrentState() {

    if (!simulator) {
        return;
    }

    clearExplanation();

    clearHistoryReview();

    const history = simulator.getHistory();

    selectedOperation = history.at(-1) ?? null;

    explainedOperation =
        selectedOperation?.decoded
            ? selectedOperation
            : null;

    if (explainedOperation) {

        renderAddress(
            explainedOperation.decoded
        );

    } else {

        resetAddressDisplay();
    }

    renderAll();
}


/* ==========================================================
   36. CONTROLES DEL HISTORIAL
========================================================== */

function updateHistoryControls() {

    if (!simulator) {
        return;
    }

    const total = simulator.getStateCount();

    const current = historyReviewIndex === null
        ? total - 1
        : historyReviewIndex;

    setText(
        el.historyPosition,
        `Estado ${current} de ${total - 1}`
    );

    el.btnHistoryFirst.disabled =
        current <= 0;

    el.btnHistoryPrevious.disabled =
        current <= 0;

    el.btnHistoryNext.disabled =
        current >= total - 1;

    el.btnHistoryLast.disabled =
        current >= total - 1;
}


/* ==========================================================
   37. ESTADÍSTICAS
========================================================== */

function renderStatistics() {

    if (!simulator) {
        return;
    }

    const snapshot = getVisibleSnapshot();

    if (!snapshot) {
        return;
    }

    const s = snapshot.statistics;

    const accesses = s.accesses;

    const hits = s.hits;

    const misses = s.misses;

    const hitRate = accesses > 0
        ? hits / accesses
        : 0;

    const missRate = accesses > 0
        ? misses / accesses
        : 0;

    const cacheTime = Number(
        el.cacheAccessTime.value
    );

    const memoryTime = Number(
        el.memoryAccessTime.value
    );

    const validTimes =
        Number.isFinite(cacheTime) &&
        Number.isFinite(memoryTime) &&
        cacheTime >= 0 &&
        memoryTime >= 0 &&
        el.cacheAccessTime.value !== "" &&
        el.memoryAccessTime.value !== "";

    const amat = validTimes
        ? cacheTime + missRate * memoryTime
        : null;

    setText(
        el.totalAccesses,
        accesses
    );

    setText(
        el.cacheHits,
        hits
    );

    setText(
        el.cacheMisses,
        misses
    );

    setText(
        el.replacementCount,
        s.replacements
    );

    setText(
        el.hitRate,
        `${(hitRate * 100).toFixed(2)}%`
    );

    setText(
        el.missRate,
        `${(missRate * 100).toFixed(2)}%`
    );

    setText(
        el.amatValue,
        amat === null
            ? "—"
            : `${amat.toFixed(2)} ns`
    );

    if (amat === null) {

        setText(
            el.amatExplanation,
            "Introduce tiempos válidos y no negativos."
        );

        return;
    }

    el.amatExplanation.innerHTML = `

        <p>
            <strong>
                AMAT = T_HIT + MissRate × Penalización
            </strong>
        </p>

        <p>
            AMAT = ${cacheTime} +
            (${missRate.toFixed(4)} × ${memoryTime})
        </p>

        <p>
            <strong>
                AMAT = ${amat.toFixed(2)} ns
            </strong>
        </p>

        <hr style="margin: 10px 0;">

        <p>Hits: ${hits}</p>

        <p>Misses: ${misses}</p>

        <p>
            Compulsory: ${s.compulsoryMisses}
        </p>

        <p>
            Conflict: ${s.conflictMisses}
        </p>

        <p>
            Capacity: ${s.capacityMisses}
        </p>

        <p>
            Reemplazos: ${s.replacements}
        </p>

        <p>
            Write-backs: ${s.writeBacks}
        </p>

    `;
}


/* ==========================================================
   38. ACTUALIZAR INTERFAZ
========================================================== */

function renderAll() {

    if (!simulator) {
        return;
    }

    renderConfiguration();

    renderCache();

    renderMemory();

    renderHistory();

    renderStatistics();

    updateHistoryControls();

    updateButtons();
}


/* ==========================================================
   39. REINICIAR SISTEMA
========================================================== */

function resetSystem() {

    if (!simulator || sequenceRunning) {
        return;
    }

    try {

        simulator.reset();

        generating = false;

        sequenceAddresses = [];
        sequenceIndex = 0;
        sequenceRunning = false;

        selectedOperation = null;
        explainedOperation = null;

        clearExplanation();
        clearHistoryReview();

        hide(el.generationControls);
        hide(el.sequenceControls);

        el.memoryBuildStatus.classList.remove(
            "building"
        );

        el.cacheBuildStatus.classList.remove(
            "building"
        );

        el.memoryBuildStatus.classList.add(
            "completed"
        );

        el.cacheBuildStatus.classList.add(
            "completed"
        );

        resetAddressDisplay();

        renderAll();

        el.simulationMessages.innerHTML = "";

        addMessage(
            "Sistema reiniciado. RAM, caché y " +
            "estadísticas recuperaron sus valores iniciales.",
            "success"
        );

    } catch (error) {

        showError(error);
    }
}


/* ==========================================================
   40. LIMPIAR HISTORIAL
========================================================== */

function clearHistory() {

    if (!simulator || sequenceRunning) {
        return;
    }

    try {

        simulator.clearHistory();

        selectedOperation = null;
        explainedOperation = null;

        clearExplanation();
        clearHistoryReview();

        resetAddressDisplay();

        renderAll();

        addMessage(
            "Historial eliminado. " +
            "RAM, caché y estadísticas conservadas.",
            "info"
        );

    } catch (error) {

        showError(error);
    }
}


/* ==========================================================
   41. EXPORTAR HISTORIAL CSV
========================================================== */

function exportHistory() {

    if (!simulator) {
        return;
    }

    const history = simulator.getHistory();

    if (history.length === 0) {

        addMessage(
            "No hay operaciones para exportar.",
            "warning"
        );

        return;
    }

    const headers = [
        "Evento",
        "Operacion",
        "Direccion",
        "Valor",
        "HIT",
        "Tipo Miss",
        "Conjunto",
        "Via",
        "Reemplazo",
        "Bloque Reemplazado",
        "Estado Historico"
    ];

    const rows = history.map(entry => [

        entry.number,

        entry.operation,

        entry.addressHex ?? "",

        entry.valueHex ?? "",

        entry.hit === null
            ? ""
            : entry.hit ? "Si" : "No",

        entry.missType ?? "",

        entry.setIndex ?? "",

        entry.way ?? "",

        entry.replacement ? "Si" : "No",

        entry.evictedBlock ?? "",

        entry.snapshotIndex

    ]);

    const escapeCSV = value => {

        return `"${String(value ?? "")
            .replaceAll('"', '""')}"`;
    };

    const csv = [
        headers,
        ...rows
    ]
        .map(row => row.map(escapeCSV).join(","))
        .join("\r\n");

    const blob = new Blob(
        ["\uFEFF" + csv],
        {
            type: "text/csv;charset=utf-8;"
        }
    );

    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");

    link.href = url;

    link.download = "historial_cache_351.csv";

    document.body.appendChild(link);

    link.click();

    link.remove();

    /*
       Liberar la URL después del clic.
    */

    setTimeout(() => {
        URL.revokeObjectURL(url);
    }, 1000);

    addMessage(
        "Historial exportado correctamente.",
        "success"
    );
}


/* ==========================================================
   42. AYUDA
========================================================== */

function openHelp() {

    el.helpModal.classList.add("show");
}


function closeHelp() {

    el.helpModal.classList.remove("show");
}


/* ==========================================================
   43. REGISTRAR EVENTOS
========================================================== */

function registerEvents() {

    /* Generación */

    el.btnGenerate.addEventListener(
        "click",
        generateSystem
    );

    el.btnGenerationPrevious.addEventListener(
        "click",
        previousGenerationStep
    );

    el.btnGenerationNext.addEventListener(
        "click",
        nextGenerationStep
    );


    /* Organización */

    el.btnDirectMapping.addEventListener(
        "click",
        selectDirectMapping
    );

    el.btnFullMapping.addEventListener(
        "click",
        selectFullMapping
    );

    [
        el.cacheSize,
        el.blockSize
    ].forEach(input => {

        input.addEventListener("change", () => {

            updateAssociativityOptions();

            configurationChanged();
        });
    });

    el.associativity.addEventListener(
        "change",
        () => {

            updateMappingDescription();

            configurationChanged();
        }
    );

    [
        el.addressWidth,
        el.replacementPolicy,
        el.writeHitPolicy,
        el.writeMissPolicy
    ].forEach(input => {

        input.addEventListener(
            "change",
            configurationChanged
        );
    });


    /* Lectura y escritura */

    el.btnRead.addEventListener(
        "click",
        handleRead
    );

    el.btnWrite.addEventListener(
        "click",
        handleWrite
    );

    el.btnFlush.addEventListener(
        "click",
        handleFlush
    );

    el.btnReset.addEventListener(
        "click",
        resetSystem
    );


    /* Explicación de acceso */

    el.btnExplainAddress.addEventListener(
        "click",
        startAccessExplanation
    );

    el.btnAccessPrevious.addEventListener(
        "click",
        previousAccessStep
    );

    el.btnAccessNext.addEventListener(
        "click",
        nextAccessStep
    );


    /* Secuencias */

    el.btnLoadReadTest.addEventListener(
        "click",
        loadReadTest
    );

    el.btnLoadReplacementTest.addEventListener(
        "click",
        loadReplacementTest
    );

    el.btnExecuteSequence.addEventListener(
        "click",
        startSequence
    );

    el.btnSequenceNext.addEventListener(
        "click",
        executeNextSequenceAccess
    );

    el.btnSequenceFinish.addEventListener(
        "click",
        executeRemainingSequence
    );

    el.btnSequenceCancel.addEventListener(
        "click",
        cancelSequence
    );


    /* Historial */

    el.btnHistoryFirst.addEventListener(
        "click",
        historyFirst
    );

    el.btnHistoryPrevious.addEventListener(
        "click",
        historyPrevious
    );

    el.btnHistoryNext.addEventListener(
        "click",
        historyNext
    );

    el.btnHistoryLast.addEventListener(
        "click",
        historyLast
    );

    el.btnReturnCurrent.addEventListener(
        "click",
        returnToCurrentState
    );

    el.btnClearHistory.addEventListener(
        "click",
        clearHistory
    );

    el.btnExportHistory.addEventListener(
        "click",
        exportHistory
    );


    /* Mensajes */

    el.btnClearMessages.addEventListener(
        "click",
        clearMessages
    );


    /* Estadísticas */

    el.cacheAccessTime.addEventListener(
        "input",
        renderStatistics
    );

    el.memoryAccessTime.addEventListener(
        "input",
        renderStatistics
    );


    /* Ayuda */

    el.btnHelp.addEventListener(
        "click",
        openHelp
    );

    el.btnCloseHelp.addEventListener(
        "click",
        closeHelp
    );

    el.helpModal.addEventListener(
        "click",
        event => {

            if (event.target === el.helpModal) {

                closeHelp();
            }
        }
    );


    /* Enter en lectura */

    el.readAddress.addEventListener(
        "keydown",
        event => {

            if (
                event.key === "Enter" &&
                !el.btnRead.disabled
            ) {

                event.preventDefault();

                handleRead();
            }
        }
    );


    /* Enter en escritura */

    [
        el.writeAddress,
        el.writeValue
    ].forEach(input => {

        input.addEventListener(
            "keydown",
            event => {

                if (
                    event.key === "Enter" &&
                    !el.btnWrite.disabled
                ) {

                    event.preventDefault();

                    handleWrite();
                }
            }
        );
    });


    /* Escape para ayuda */

    document.addEventListener(
        "keydown",
        event => {

            if (event.key === "Escape") {

                closeHelp();
            }
        }
    );
}


/* ==========================================================
   44. INICIALIZACIÓN
========================================================== */

function initializeApplication() {

    try {

        /*
           Detectar referencias faltantes.
        */

        validateHTML();

        /*
           Preparar asociatividad.
        */

        updateAssociativityOptions();

        /*
           Registrar eventos.
        */

        registerEvents();

        /*
           Ocultar controles no utilizados.
        */

        hide(el.generationControls);
        hide(el.accessStepControls);
        hide(el.sequenceControls);
        hide(el.historyReviewInfo);

        hide(el.memoryBuildStatus);
        hide(el.cacheBuildStatus);

        /*
           Estado inicial.
        */

        resetAddressDisplay();

        updateButtons();

        addMessage(
            "Simulador preparado. " +
            "Configura los parámetros y presiona " +
            "Generar sistema.",
            "success"
        );

        console.log(
            "Simulador de Memoria Caché 351 — Versión 3"
        );

    } catch (error) {

        console.error(
            "Error al inicializar el simulador:",
            error
        );

        /*
           Mostrar el error en la interfaz
           siempre que exista el panel.
        */

        if (el.simulationMessages) {

            addMessage(
                `Error de inicialización: ${error.message}`,
                "error"
            );
        }
    }
}


/* ==========================================================
   45. INICIAR AL CARGAR EL DOCUMENTO
========================================================== */

if (document.readyState === "loading") {

    document.addEventListener(
        "DOMContentLoaded",
        initializeApplication
    );

} else {

    initializeApplication();
}

