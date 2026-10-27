/* ==========================================================
   SIMULADOR DE MEMORIA CACHÉ 351
   Universidad Industrial de Santander

   Archivo: js/cache.js
   Versión 2 - Motor completo

   Compatible con:
   - policies.js V2
   - index.html V2
   - main.js V2
========================================================== */

import {
    selectVictim,
    updateLineAccess,
    initializeLineMetadata
} from "./policies.js";


/* ==========================================================
   1. GENERADOR PSEUDOALEATORIO DE RAM
========================================================== */

const MEMORY_SEED = 3512026;

/*
   Generador determinista de bytes.

   Siempre que se utilice la misma semilla,
   producirá la misma secuencia.

   Cada llamada devuelve un byte de 0 a 255.
*/

function createMemoryGenerator(seed) {

    let state = seed >>> 0;

    return function nextByte() {

        state = (
            Math.imul(1664525, state) + 1013904223
        ) >>> 0;

        return (state >>> 24) & 0xFF;
    };
}


/* ==========================================================
   2. CLASE PRINCIPAL
========================================================== */

export class CacheSimulator {

    constructor(config = {}) {

        this.config = {

            addressWidth:
                Number(config.addressWidth ?? 8),

            cacheSize:
                Number(config.cacheSize ?? 16),

            blockSize:
                Number(config.blockSize ?? 4),

            associativity:
                Number(config.associativity ?? 1),

            replacementPolicy:
                String(config.replacementPolicy ?? "LRU")
                    .toUpperCase(),

            writeHitPolicy:
                config.writeHitPolicy ?? "write-back",

            writeMissPolicy:
                config.writeMissPolicy ?? "write-allocate",

            randomSeed:
                config.randomSeed ?? null

        };

        this.memorySeed = MEMORY_SEED;

        this.validateConfiguration();

        this.initializeSystem();
    }


    /* ======================================================
       3. VALIDAR POTENCIAS DE DOS
    ====================================================== */

    isPowerOfTwo(value) {

        return Number.isSafeInteger(value) &&
               value > 0 &&
               Number.isInteger(Math.log2(value));
    }


    /* ======================================================
       4. VALIDAR CONFIGURACIÓN
    ====================================================== */

    validateConfiguration() {

        const c = this.config;

        if (
            !Number.isInteger(c.addressWidth) ||
            c.addressWidth < 1 ||
            c.addressWidth > 16
        ) {

            throw new Error(
                "El bus de direcciones debe tener entre 1 y 16 bits."
            );
        }

        this.memorySize = 2 ** c.addressWidth;

        for (const [name, value] of [

            ["Tamaño de caché", c.cacheSize],

            ["Tamaño de bloque", c.blockSize],

            ["Asociatividad", c.associativity]

        ]) {

            if (!this.isPowerOfTwo(value)) {

                throw new Error(
                    `${name} debe ser una potencia de 2.`
                );
            }
        }

        if (c.blockSize > c.cacheSize) {

            throw new Error(
                "El bloque no puede superar la caché."
            );
        }

        if (c.blockSize > this.memorySize) {

            throw new Error(
                "El bloque no puede superar la memoria principal."
            );
        }

        if (c.cacheSize > this.memorySize) {

            throw new Error(
                "La caché no puede superar la memoria principal."
            );
        }

        /*
           B = C / K

           Número de líneas de caché.
        */

        this.lineCount = c.cacheSize / c.blockSize;

        if (c.associativity > this.lineCount) {

            throw new Error(
                "E no puede superar el número de líneas de caché."
            );
        }

        /*
           S = B / E

           Número de conjuntos.
        */

        this.setCount =
            this.lineCount / c.associativity;

        if (!this.isPowerOfTwo(this.setCount)) {

            throw new Error(
                "El número de conjuntos debe ser potencia de 2."
            );
        }

        /*
           Bits de dirección.
        */

        this.offsetBits = Math.log2(c.blockSize);

        this.indexBits = Math.log2(this.setCount);

        this.tagBits =
            c.addressWidth -
            this.indexBits -
            this.offsetBits;

        if (this.tagBits < 0) {

            throw new Error(
                "La configuración produce un Tag inválido."
            );
        }

        if (![
            "LRU",
            "FIFO",
            "LFU",
            "RANDOM"
        ].includes(c.replacementPolicy)) {

            throw new Error(
                "Política de reemplazo inválida."
            );
        }

        if (![
            "write-back",
            "write-through"
        ].includes(c.writeHitPolicy)) {

            throw new Error(
                "Política Write Hit inválida."
            );
        }

        if (![
            "write-allocate",
            "no-write-allocate"
        ].includes(c.writeMissPolicy)) {

            throw new Error(
                "Política Write Miss inválida."
            );
        }

        if (
            c.randomSeed !== null &&
            c.randomSeed !== "" &&
            !Number.isFinite(Number(c.randomSeed))
        ) {

            throw new Error(
                "La semilla aleatoria debe ser numérica."
            );
        }
    }


    /* ======================================================
       5. CREAR UNA LÍNEA VACÍA
    ====================================================== */

    createEmptyLine() {

        return {

            valid: false,

            dirty: false,

            tag: null,

            blockNumber: null,

            data: new Array(
                this.config.blockSize
            ).fill(null),

            insertedAt: 0,

            lastUsed: 0,

            frequency: 0

        };
    }


    /* ======================================================
       6. INICIALIZAR SISTEMA
    ====================================================== */

    initializeSystem() {

        /*
           Reloj lógico.
        */

        this.clock = 0;

        /*
           Estadísticas.
        */

        this.stats = {

            accesses: 0,

            reads: 0,

            writes: 0,

            hits: 0,

            misses: 0,

            compulsoryMisses: 0,

            conflictMisses: 0,

            capacityMisses: 0,

            replacements: 0,

            writeBacks: 0,

            memoryReads: 0,

            memoryWrites: 0

        };

        /*
           Historial.
        */

        this.history = [];

        this.stateHistory = [];

        this.eventCounter = 0;

        this.lastOperation = null;

        /*
           Bloques que ya han sido referenciados.
        */

        this.seenBlocks = new Set();

        /*
           Caché auxiliar para clasificación 3C.
        */

        this.shadowCache = [];


        /* --------------------------------------------------
           CREAR MEMORIA PRINCIPAL
        -------------------------------------------------- */

        this.memory = new Uint8Array(
            this.memorySize
        );

        const nextByte = createMemoryGenerator(
            this.memorySeed
        );

        for (
            let address = 0;
            address < this.memorySize;
            address++
        ) {

            this.memory[address] = nextByte();
        }


        /* --------------------------------------------------
           CREAR MEMORIA CACHÉ
        -------------------------------------------------- */

        this.cache = [];

        for (
            let setIndex = 0;
            setIndex < this.setCount;
            setIndex++
        ) {

            const set = [];

            for (
                let way = 0;
                way < this.config.associativity;
                way++
            ) {

                set.push(
                    this.createEmptyLine()
                );
            }

            this.cache.push(set);
        }


        /* --------------------------------------------------
           GENERADOR RANDOM DE REEMPLAZO
        -------------------------------------------------- */

        this.randomState = null;

        if (
            this.config.randomSeed !== null &&
            this.config.randomSeed !== ""
        ) {

            this.randomState =
                Number(this.config.randomSeed) >>> 0;
        }


        /* --------------------------------------------------
           FOTOGRAFÍA INICIAL
        -------------------------------------------------- */

        this.saveStateSnapshot({

            number: 0,

            operation: "INITIAL",

            description:
                "Sistema inicializado. Caché vacía y RAM preparada."

        });
    }


    /* ======================================================
       7. GENERADOR RANDOM DE REEMPLAZO
    ====================================================== */

    random() {

        if (this.randomState === null) {

            return Math.random();
        }

        this.randomState = (
            Math.imul(1664525, this.randomState) +
            1013904223
        ) >>> 0;

        return this.randomState / 4294967296;
    }


    /* ======================================================
       8. CONVERSIÓN DE DIRECCIONES
    ====================================================== */

    parseAddress(address) {

        let value;

        if (typeof address === "number") {

            value = address;

        } else if (typeof address === "string") {

            const text = address.trim();

            if (/^0x[0-9a-f]+$/i.test(text)) {

                value = Number.parseInt(
                    text.slice(2),
                    16
                );

            } else if (/^\d+$/.test(text)) {

                value = Number.parseInt(
                    text,
                    10
                );

            } else {

                throw new Error(
                    "Dirección inválida. Utiliza decimal o hexadecimal con 0x."
                );
            }

        } else {

            throw new Error(
                "La dirección debe ser un número o texto."
            );
        }

        if (
            !Number.isSafeInteger(value) ||
            value < 0 ||
            value >= this.memorySize
        ) {

            throw new Error(
                `Dirección fuera de rango. ` +
                `Valores permitidos: 0 a ${this.memorySize - 1}.`
            );
        }

        return value;
    }


    /* ======================================================
       9. VALIDAR BYTE
    ====================================================== */

    parseByte(value) {

        let byte;

        if (typeof value === "number") {

            byte = value;

        } else if (typeof value === "string") {

            const text = value.trim();

            if (/^0x[0-9a-f]+$/i.test(text)) {

                byte = Number.parseInt(
                    text.slice(2),
                    16
                );

            } else if (/^\d+$/.test(text)) {

                byte = Number.parseInt(
                    text,
                    10
                );

            } else {

                throw new Error(
                    "Byte inválido. Utiliza decimal o hexadecimal con 0x."
                );
            }

        } else {

            throw new Error(
                "Valor de byte inválido."
            );
        }

        if (
            !Number.isInteger(byte) ||
            byte < 0 ||
            byte > 255
        ) {

            throw new Error(
                "El byte debe estar entre 0 y 255."
            );
        }

        return byte;
    }


    /* ======================================================
       10. FORMATO HEXADECIMAL
    ====================================================== */

    toHex(value, digits = 2) {

        return Number(value)
            .toString(16)
            .toUpperCase()
            .padStart(digits, "0");
    }


    formatAddress(address) {

        const digits = Math.ceil(
            this.config.addressWidth / 4
        );

        return "0x" + this.toHex(
            address,
            digits
        );
    }


    formatByte(byte) {

        return "0x" + this.toHex(byte, 2);
    }


    /* ======================================================
       11. DESCOMPOSICIÓN TIO
    ====================================================== */

    decodeAddress(address) {

        const addr = this.parseAddress(address);

        /*
           Bloque de memoria principal.
        */

        const blockNumber = Math.floor(
            addr / this.config.blockSize
        );

        /*
           Desplazamiento dentro del bloque.
        */

        const offset =
            addr % this.config.blockSize;

        /*
           Conjunto de caché.
        */

        const setIndex =
            blockNumber % this.setCount;

        /*
           Etiqueta.
        */

        const tag = Math.floor(
            blockNumber / this.setCount
        );

        /*
           Primera dirección del bloque.
        */

        const blockStart =
            blockNumber * this.config.blockSize;

        /*
           Dirección binaria completa.
        */

        const binary = addr
            .toString(2)
            .padStart(this.config.addressWidth, "0");

        /*
           Campos binarios.
        */

        const tagBinary = this.tagBits > 0
            ? tag.toString(2).padStart(this.tagBits, "0")
            : "";

        const indexBinary = this.indexBits > 0
            ? setIndex.toString(2).padStart(this.indexBits, "0")
            : "";

        const offsetBinary = this.offsetBits > 0
            ? offset.toString(2).padStart(this.offsetBits, "0")
            : "";

        return {

            address: addr,

            hexadecimal:
                this.formatAddress(addr),

            binary,

            blockNumber,

            blockStart,

            offset,

            setIndex,

            tag,

            tagBinary,

            indexBinary,

            offsetBinary,

            tagBits: this.tagBits,

            indexBits: this.indexBits,

            offsetBits: this.offsetBits

        };
    }


    /* ======================================================
       12. BUSCAR UN BLOQUE EN CACHÉ
    ====================================================== */

    findLine(decoded) {

        const set = this.cache[
            decoded.setIndex
        ];

        for (let way = 0; way < set.length; way++) {

            const line = set[way];

            if (
                line.valid &&
                line.tag === decoded.tag
            ) {

                return {

                    hit: true,

                    way,

                    line

                };
            }
        }

        return {

            hit: false,

            way: -1,

            line: null

        };
    }


    /* ======================================================
       13. CLASIFICACIÓN DE MISSES
    ====================================================== */

    /*
       Se utiliza la clasificación 3C:

       Compulsory:
           Primera referencia al bloque.

       Conflict:
           Estaría en una caché totalmente
           asociativa LRU de igual capacidad.

       Capacity:
           Ya fue referenciado, pero tampoco
           está en la caché auxiliar.

       La caché auxiliar solamente se usa
       para clasificar fallos.
    */

    classifyMiss(blockNumber) {

        if (!this.seenBlocks.has(blockNumber)) {

            return "Compulsory";
        }

        if (this.shadowCache.includes(blockNumber)) {

            return "Conflict";
        }

        return "Capacity";
    }


    /* ======================================================
       14. ACTUALIZAR CACHÉ AUXILIAR
    ====================================================== */

    updateShadowCache(blockNumber) {

        const index = this.shadowCache.indexOf(
            blockNumber
        );

        if (index !== -1) {

            this.shadowCache.splice(index, 1);
        }

        this.shadowCache.push(blockNumber);

        if (
            this.shadowCache.length > this.lineCount
        ) {

            this.shadowCache.shift();
        }

        this.seenBlocks.add(blockNumber);
    }


    /* ======================================================
       15. LEER BLOQUE DE RAM
    ====================================================== */

    readMemoryBlock(blockStart) {

        const data = [];

        for (
            let i = 0;
            i < this.config.blockSize;
            i++
        ) {

            data.push(
                this.memory[blockStart + i]
            );
        }

        this.stats.memoryReads++;

        return data;
    }


    /* ======================================================
       16. ESCRIBIR BYTE EN RAM
    ====================================================== */

    writeMemoryByte(address, byte) {

        this.memory[address] = byte;

        this.stats.memoryWrites++;
    }


    /* ======================================================
       17. WRITE-BACK DE UNA LÍNEA
    ====================================================== */

    writeBackLine(line) {

        if (!line.valid || !line.dirty) {

            return false;
        }

        const start =
            line.blockNumber * this.config.blockSize;

        for (
            let offset = 0;
            offset < this.config.blockSize;
            offset++
        ) {

            this.memory[start + offset] =
                line.data[offset];
        }

        line.dirty = false;

        this.stats.writeBacks++;

        this.stats.memoryWrites++;

        return true;
    }


    /* ======================================================
       18. CARGAR BLOQUE EN CACHÉ
    ====================================================== */

    loadBlock(decoded) {

        const set = this.cache[
            decoded.setIndex
        ];

        /*
           Seleccionar vía libre o víctima.
        */

        const selection = selectVictim(

            set,

            this.config.replacementPolicy,

            () => this.random()

        );

        const way = selection.index;

        const line = set[way];

        let evictedBlock = null;

        let writeBack = false;

        /*
           Si se reemplaza una línea válida,
           registrar el bloque anterior.
        */

        if (selection.replacement) {

            evictedBlock = line.blockNumber;

            /*
               Escribir bloque sucio en RAM
               antes de reemplazarlo.
            */

            if (line.dirty) {

                writeBack = this.writeBackLine(
                    line
                );
            }

            this.stats.replacements++;
        }

        /*
           Obtener el nuevo bloque de RAM.
        */

        const data = this.readMemoryBlock(
            decoded.blockStart
        );

        /*
           Actualizar línea.
        */

        line.valid = true;

        line.dirty = false;

        line.tag = decoded.tag;

        line.blockNumber = decoded.blockNumber;

        line.data = data;

        initializeLineMetadata(
            line,
            this.clock
        );

        return {

            line,

            way,

            replacement: selection.replacement,

            evictedBlock,

            writeBack,

            reason: selection.reason

        };
    }


    /* ======================================================
       19. REGISTRAR OPERACIÓN
    ====================================================== */

    registerOperation(result) {

        this.stats.accesses++;

        if (result.operation === "READ") {

            this.stats.reads++;

        } else if (result.operation === "WRITE") {

            this.stats.writes++;
        }

        if (result.hit) {

            this.stats.hits++;

        } else {

            this.stats.misses++;

            switch (result.missType) {

                case "Compulsory":

                    this.stats.compulsoryMisses++;
                    break;

                case "Conflict":

                    this.stats.conflictMisses++;
                    break;

                case "Capacity":

                    this.stats.capacityMisses++;
                    break;
            }
        }

        /*
           Numeración independiente de
           las estadísticas de acceso.
        */

        this.eventCounter++;

        const entry = {

            ...result,

            number: this.eventCounter

        };

        this.history.push(entry);

        this.lastOperation = entry;

        /*
           Guardar estado posterior al acceso.
        */

        entry.snapshotIndex = this.saveStateSnapshot({

            number: entry.number,

            operation: entry.operation,

            address: entry.address,

            addressHex: entry.addressHex,

            valueHex: entry.valueHex,

            hit: entry.hit,

            missType: entry.missType,

            setIndex: entry.setIndex,

            way: entry.way,

            replacement: entry.replacement,

            description: entry.reason

        });

        return entry;
    }


    /* ======================================================
       20. LECTURA DE MEMORIA
    ====================================================== */

    read(address) {

        const decoded = this.decodeAddress(
            address
        );

        this.clock++;

        const search = this.findLine(
            decoded
        );

        const hit = search.hit;

        let line;

        let way;

        let missType = null;

        let replacement = false;

        let evictedBlock = null;

        let writeBack = false;

        let reason = "";

        /*
           CACHE HIT
        */

        if (hit) {

            line = search.line;

            way = search.way;

            updateLineAccess(
                line,
                this.clock
            );

            reason =
                "El bloque solicitado ya estaba almacenado en caché.";

        } else {

            /*
               CACHE MISS
            */

            missType = this.classifyMiss(
                decoded.blockNumber
            );

            const loaded = this.loadBlock(
                decoded
            );

            line = loaded.line;

            way = loaded.way;

            replacement = loaded.replacement;

            evictedBlock = loaded.evictedBlock;

            writeBack = loaded.writeBack;

            reason = loaded.reason;
        }

        /*
           Obtener el byte.
        */

        const value = line.data[
            decoded.offset
        ];

        /*
           Actualizar referencias.
        */

        this.updateShadowCache(
            decoded.blockNumber
        );

        /*
           Registrar resultado.
        */

        return this.registerOperation({

            operation: "READ",

            address: decoded.address,

            addressHex: decoded.hexadecimal,

            value,

            valueHex: this.formatByte(value),

            hit,

            missType,

            setIndex: decoded.setIndex,

            way,

            tag: decoded.tag,

            offset: decoded.offset,

            blockNumber: decoded.blockNumber,

            blockStart: decoded.blockStart,

            replacement,

            evictedBlock,

            writeBack,

            allocated: !hit,

            reason,

            decoded

        });
    }


    /* ======================================================
       21. ESCRITURA DE MEMORIA
    ====================================================== */

    write(address, value) {

        const decoded = this.decodeAddress(
            address
        );

        const byte = this.parseByte(
            value
        );

        this.clock++;

        const search = this.findLine(
            decoded
        );

        const hit = search.hit;

        let line = null;

        let way = -1;

        let missType = null;

        let replacement = false;

        let evictedBlock = null;

        let writeBack = false;

        let allocated = false;

        let reason = "";

        /*
           WRITE HIT
        */

        if (hit) {

            line = search.line;

            way = search.way;

            updateLineAccess(
                line,
                this.clock
            );

            reason =
                "Write Hit: el bloque ya estaba en caché.";

        } else {

            /*
               WRITE MISS
            */

            missType = this.classifyMiss(
                decoded.blockNumber
            );

            if (
                this.config.writeMissPolicy ===
                "write-allocate"
            ) {

                /*
                   Cargar el bloque en caché.
                */

                const loaded = this.loadBlock(
                    decoded
                );

                line = loaded.line;

                way = loaded.way;

                replacement = loaded.replacement;

                evictedBlock = loaded.evictedBlock;

                writeBack = loaded.writeBack;

                allocated = true;

                reason =
                    "Write-allocate: se cargó el bloque " +
                    "antes de realizar la escritura. " +
                    loaded.reason;

            } else {

                /*
                   NO-WRITE-ALLOCATE

                   No se carga la línea en caché.

                   Se escribe directamente en RAM.
                */

                this.writeMemoryByte(
                    decoded.address,
                    byte
                );

                reason =
                    "No-write-allocate: escritura directa " +
                    "en memoria principal.";
            }
        }

        /*
           Si existe línea de caché,
           modificar su contenido.
        */

        if (line !== null) {

            line.data[decoded.offset] = byte;

            /*
               WRITE-THROUGH
            */

            if (
                this.config.writeHitPolicy ===
                "write-through"
            ) {

                this.writeMemoryByte(
                    decoded.address,
                    byte
                );

                line.dirty = false;

                reason +=
                    " Write-through actualizó RAM inmediatamente.";

            } else {

                /*
                   WRITE-BACK
                */

                line.dirty = true;

                reason +=
                    " Write-back marcó la línea como modificada.";
            }
        }

        /*
           Registrar referencia.
        */

        this.updateShadowCache(
            decoded.blockNumber
        );

        return this.registerOperation({

            operation: "WRITE",

            address: decoded.address,

            addressHex: decoded.hexadecimal,

            value: byte,

            valueHex: this.formatByte(byte),

            hit,

            missType,

            setIndex: decoded.setIndex,

            way,

            tag: decoded.tag,

            offset: decoded.offset,

            blockNumber: decoded.blockNumber,

            blockStart: decoded.blockStart,

            replacement,

            evictedBlock,

            writeBack,

            allocated,

            reason,

            decoded

        });
    }


    /* ======================================================
       22. FLUSH
    ====================================================== */

    /*
       Flush escribe los bloques sucios en RAM.

       Las líneas válidas permanecen en caché.

       Flush no aumenta hits, misses ni accesos
       de CPU.
    */

    flush() {

        let flushedLines = 0;

        const modifiedBlocks = [];

        for (
            let setIndex = 0;
            setIndex < this.cache.length;
            setIndex++
        ) {

            const set = this.cache[setIndex];

            for (
                let way = 0;
                way < set.length;
                way++
            ) {

                const line = set[way];

                if (line.valid && line.dirty) {

                    const blockNumber =
                        line.blockNumber;

                    if (this.writeBackLine(line)) {

                        flushedLines++;

                        modifiedBlocks.push({

                            setIndex,

                            way,

                            blockNumber

                        });
                    }
                }
            }
        }

        const message =
            `Flush completado: ${flushedLines} ` +
            "bloque(s) sucio(s) escritos en RAM.";

        this.eventCounter++;

        /*
           Registrar evento Flush.
        */

        const entry = {

            number: this.eventCounter,

            operation: "FLUSH",

            address: null,

            addressHex: "—",

            value: null,

            valueHex: "—",

            hit: null,

            missType: null,

            setIndex: null,

            way: null,

            tag: null,

            offset: null,

            replacement: false,

            evictedBlock: null,

            flushedLines,

            modifiedBlocks,

            reason: message,

            decoded: null

        };

        this.history.push(entry);

        this.lastOperation = entry;

        /*
           Guardar fotografía después de Flush.
        */

        entry.snapshotIndex = this.saveStateSnapshot({

            number: entry.number,

            operation: "FLUSH",

            flushedLines,

            modifiedBlocks,

            description: message

        });

        return {

            operation: "FLUSH",

            flushedLines,

            modifiedBlocks,

            snapshotIndex: entry.snapshotIndex,

            message

        };
    }


    /* ======================================================
       23. EJECUTAR SECUENCIA DE LECTURAS
    ====================================================== */

    executeSequence(sequence) {

        let addresses;

        if (typeof sequence === "string") {

            addresses = sequence
                .split(/[,;\s]+/)
                .map(item => item.trim())
                .filter(Boolean);

        } else if (Array.isArray(sequence)) {

            addresses = sequence;

        } else {

            throw new Error(
                "La secuencia debe ser texto o arreglo."
            );
        }

        /*
           Validar antes de ejecutar.
        */

        const parsed = addresses.map(
            address => this.parseAddress(address)
        );

        const results = [];

        for (const address of parsed) {

            results.push(
                this.read(address)
            );
        }

        return results;
    }


    /* ======================================================
       24. EJECUTAR SECUENCIA DE ESCRITURAS
    ====================================================== */

    executeWriteSequence(sequence) {

        if (!Array.isArray(sequence)) {

            throw new Error(
                "La secuencia de escrituras debe ser un arreglo."
            );
        }

        const operations = sequence.map(item => ({

            address: this.parseAddress(
                item.address
            ),

            value: this.parseByte(
                item.value
            )

        }));

        return operations.map(operation =>

            this.write(
                operation.address,
                operation.value
            )

        );
    }


    /* ======================================================
       25. GUARDAR FOTOGRAFÍA HISTÓRICA
    ====================================================== */

    saveStateSnapshot(operationInfo = {}) {

        /*
           Copiar RAM.
        */

        const memoryCopy =
            this.memory.slice();

        /*
           Copiar caché.
        */

        const cacheCopy = this.cache.map(set =>

            set.map(line => ({

                valid: line.valid,

                dirty: line.dirty,

                tag: line.tag,

                blockNumber: line.blockNumber,

                data: [...line.data],

                insertedAt: line.insertedAt,

                lastUsed: line.lastUsed,

                frequency: line.frequency

            }))

        );

        /*
           Crear fotografía.
        */

        const snapshot = {

            index: this.stateHistory.length,

            operation: {
                ...operationInfo
            },

            memory: memoryCopy,

            cache: cacheCopy,

            statistics: {
                ...this.stats
            },

            clock: this.clock

        };

        this.stateHistory.push(snapshot);

        return snapshot.index;
    }


    /* ======================================================
       26. CONSULTAR CANTIDAD DE ESTADOS
    ====================================================== */

    getStateCount() {

        return this.stateHistory.length;
    }


    /* ======================================================
       27. CONSULTAR FOTOGRAFÍA HISTÓRICA
    ====================================================== */

    getStateSnapshot(index) {

        if (
            !Number.isInteger(index) ||
            index < 0 ||
            index >= this.stateHistory.length
        ) {

            throw new Error(
                "El estado histórico solicitado no existe."
            );
        }

        const snapshot = this.stateHistory[index];

        /*
           Devolver copias independientes.
        */

        return {

            index: snapshot.index,

            operation: {
                ...snapshot.operation
            },

            memory: Array.from(
                snapshot.memory
            ),

            cache: snapshot.cache.map(set =>

                set.map(line => ({

                    ...line,

                    data: [...line.data]

                }))

            ),

            statistics: {
                ...snapshot.statistics
            },

            clock: snapshot.clock

        };
    }


    /* ======================================================
       28. OBTENER ÚLTIMO ESTADO
    ====================================================== */

    getLatestStateSnapshot() {

        if (this.stateHistory.length === 0) {

            return null;
        }

        return this.getStateSnapshot(
            this.stateHistory.length - 1
        );
    }


    /* ======================================================
       29. RESUMEN DEL HISTORIAL DE ESTADOS
    ====================================================== */

    getStateHistoryInfo() {

        return this.stateHistory.map(snapshot => ({

            index: snapshot.index,

            operation: {
                ...snapshot.operation
            },

            clock: snapshot.clock,

            accesses:
                snapshot.statistics.accesses,

            hits:
                snapshot.statistics.hits,

            misses:
                snapshot.statistics.misses

        }));
    }


    /* ======================================================
       30. OBTENER CONFIGURACIÓN
    ====================================================== */

    getConfiguration() {

        const c = this.config;

        let mappingType;

        if (c.associativity === 1) {

            mappingType = "Mapeo directo";

        } else if (
            c.associativity === this.lineCount
        ) {

            mappingType = "Totalmente asociativo";

        } else {

            mappingType =
                `Asociativo por conjuntos de ` +
                `${c.associativity} vías`;
        }

        return {

            ...c,

            memorySeed: this.memorySeed,

            memorySize: this.memorySize,

            lineCount: this.lineCount,

            setCount: this.setCount,

            tagBits: this.tagBits,

            indexBits: this.indexBits,

            offsetBits: this.offsetBits,

            mappingType

        };
    }


    /* ======================================================
       31. OBTENER ESTADO ACTUAL DE CACHÉ
    ====================================================== */

    getCacheState() {

        return this.cache.map(
            (set, setIndex) => ({

                setIndex,

                lines: set.map(
                    (line, way) => ({

                        ...line,

                        way,

                        data: [...line.data]

                    })
                )

            })
        );
    }


    /* ======================================================
       32. OBTENER RAM
    ====================================================== */

    getMemory() {

        return Array.from(this.memory);
    }


    /* ======================================================
       33. OBTENER RANGO DE RAM
    ====================================================== */

    getMemoryRange(start = 0, length = 16) {

        const address = this.parseAddress(
            start
        );

        if (
            !Number.isInteger(length) ||
            length < 0
        ) {

            throw new Error(
                "La longitud debe ser un entero no negativo."
            );
        }

        const end = Math.min(
            address + length,
            this.memorySize
        );

        return Array.from(
            this.memory.slice(address, end)
        );
    }


    /* ======================================================
       34. ESTADÍSTICAS
    ====================================================== */

    getStatistics(
        cacheAccessTime = 5,
        memoryAccessTime = 100
    ) {

        const accesses = this.stats.accesses;

        const hits = this.stats.hits;

        const misses = this.stats.misses;

        const hitRate = accesses > 0
            ? hits / accesses
            : 0;

        const missRate = accesses > 0
            ? misses / accesses
            : 0;

        const hitTime = Number(
            cacheAccessTime
        );

        const missPenalty = Number(
            memoryAccessTime
        );

        if (
            !Number.isFinite(hitTime) ||
            !Number.isFinite(missPenalty) ||
            hitTime < 0 ||
            missPenalty < 0
        ) {

            throw new Error(
                "Los tiempos deben ser números no negativos."
            );
        }

        /*
           AMAT simplificado del taller.

           AMAT = tiempo HIT +
                  miss rate × penalización MISS.
        */

        const amat =
            hitTime + missRate * missPenalty;

        return {

            ...this.stats,

            hitRate,

            missRate,

            hitRatePercent: hitRate * 100,

            missRatePercent: missRate * 100,

            amat,

            cacheAccessTime: hitTime,

            memoryAccessTime: missPenalty

        };
    }


    /* ======================================================
       35. OBTENER HISTORIAL
    ====================================================== */

    getHistory() {

        return [...this.history];
    }


    /* ======================================================
       36. LIMPIAR HISTORIAL
    ====================================================== */

    clearHistory() {

        /*
           No modifica RAM, caché ni estadísticas.
        */

        this.history = [];

        this.stateHistory = [];

        this.lastOperation = null;

        this.eventCounter = 0;

        /*
           Crear nuevo punto de partida.
        */

        this.saveStateSnapshot({

            number: 0,

            operation: "INITIAL",

            description:
                "Estado conservado después de limpiar el historial."

        });

        return {

            success: true,

            message:
                "Historial eliminado. " +
                "RAM, caché y estadísticas conservadas."

        };
    }


    /* ======================================================
       37. REINICIAR SISTEMA
    ====================================================== */

    reset() {

        this.initializeSystem();

        return {

            success: true,

            message:
                "Sistema reiniciado correctamente."

        };
    }


    /* ======================================================
       38. PASOS DE GENERACIÓN DEL SISTEMA
    ====================================================== */

    getGenerationSteps() {

        const c = this.getConfiguration();

        const memoryBlocks =
            c.memorySize / c.blockSize;

        return [

            {
                number: 1,

                title: "Calcular memoria principal",

                target: "memory",

                description:
                    `El bus tiene ${c.addressWidth} bits. ` +
                    `La memoria contiene ` +
                    `${c.memorySize} direcciones de un byte.`,

                formula:
                    `MM = 2^${c.addressWidth} = ` +
                    `${c.memorySize} bytes`
            },

            {
                number: 2,

                title: "Crear bloques de RAM",

                target: "memory",

                description:
                    `La RAM se divide en ${memoryBlocks} ` +
                    `bloques de ${c.blockSize} bytes. ` +
                    `Los valores se generan con la semilla ` +
                    `${c.memorySeed}.`,

                formula:
                    `Bloques MM = ${c.memorySize} / ` +
                    `${c.blockSize} = ${memoryBlocks}`
            },

            {
                number: 3,

                title: "Calcular líneas de caché",

                target: "cache",

                description:
                    `La caché tiene ${c.cacheSize} bytes. ` +
                    `Cada línea almacena ${c.blockSize} bytes.`,

                formula:
                    `B = C / K = ${c.cacheSize} / ` +
                    `${c.blockSize} = ${c.lineCount}`
            },

            {
                number: 4,

                title: "Calcular conjuntos",

                target: "cache",

                description:
                    `La caché utiliza ${c.associativity} ` +
                    `vía(s) por conjunto.`,

                formula:
                    `S = B / E = ${c.lineCount} / ` +
                    `${c.associativity} = ${c.setCount}`
            },

            {
                number: 5,

                title: "Organizar conjuntos y vías",

                target: "cache",

                description:
                    `Organización: ${c.mappingType}. ` +
                    `Se crean ${c.setCount} conjuntos ` +
                    `con ${c.associativity} vías. ` +
                    `Todas las líneas comienzan con V=0 y D=0.`,

                formula:
                    `${c.setCount} × ${c.associativity} = ` +
                    `${c.lineCount} líneas`
            },

            {
                number: 6,

                title: "Calcular Tag, Index y Offset",

                target: "address",

                description:
                    `La dirección de ${c.addressWidth} bits ` +
                    `se divide en ${c.tagBits} bits de Tag, ` +
                    `${c.indexBits} de Index y ` +
                    `${c.offsetBits} de Offset.`,

                formula:
                    `m = t + s + k = ` +
                    `${c.tagBits} + ${c.indexBits} + ` +
                    `${c.offsetBits} = ${c.addressWidth}`
            },

            {
                number: 7,

                title: "Sistema preparado",

                target: "system",

                description:
                    "La memoria principal está inicializada. " +
                    "La caché tiene sus conjuntos y vías preparados. " +
                    "El sistema puede ejecutar accesos.",

                formula:
                    "Sistema listo para simular."
            }

        ];
    }


    /* ======================================================
       39. DESCRIPCIÓN DEL SISTEMA
    ====================================================== */

    getDescription() {

        const c = this.getConfiguration();

        return {

            title: "Configuración de memoria caché",

            parameters: {

                m: c.addressWidth,

                C: c.cacheSize,

                K: c.blockSize,

                E: c.associativity

            },

            memory: {

                size: c.memorySize,

                seed: c.memorySeed,

                addressRange:
                    `0 a ${c.memorySize - 1}`

            },

            cache: {

                size: c.cacheSize,

                lines: c.lineCount,

                sets: c.setCount,

                ways: c.associativity,

                mapping: c.mappingType

            },

            addressFields: {

                tag: c.tagBits,

                index: c.indexBits,

                offset: c.offsetBits

            }

        };
    }

}


/* ==========================================================
   FIN DEL ARCHIVO cache.js
========================================================== */