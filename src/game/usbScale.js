/**
 * Lecture d’une balance USB (FTDI / CH340) via Web Serial.
 *
 * Réglages balance (USS-DBS / clone) : C5-0 continu ou C5-2 + UNIT.
 * Liaison : 9600 8N1.
 */

const BAUD = 9600;
const OPEN_TIMEOUT_MS = 4000;

/** @type {{ usbVendorId: number, usbProductId?: number }[]} */
const PORT_FILTERS = [
  { usbVendorId: 0x0403, usbProductId: 0x6001 }, // FTDI FT232R
  { usbVendorId: 0x0403 },
  { usbVendorId: 0x1a86, usbProductId: 0x7523 }, // QinHeng CH340
  { usbVendorId: 0x1a86 },
  { usbVendorId: 0x10c4, usbProductId: 0xea60 }, // CP210x
];

const UNIT_TO_GRAMS = {
  g: 1,
  gr: 1,
  gm: 1,
  gram: 1,
  grams: 1,
  kg: 1000,
  mg: 0.001,
  oz: 28.349523125,
  lb: 453.59237,
};

/**
 * @param {string} line
 * @returns {number|null} grammes, ou null si la ligne n’est pas une pesée
 */
export function parseScaleLine(line) {
  const text = String(line).replace(/\u0000/g, "").trim();
  if (!text) return null;

  const upper = text.toUpperCase();
  if (/^(OL|OVER|ERROR|ERR|\?\?\?)/.test(upper)) return null;
  if (/^-{3,}/.test(text)) return null;
  if (/^C\d/.test(upper)) return null;
  if (/\bPCS\b/.test(upper)) return null;

  const match = text.match(/([+-]?\s*\d+[.,]?\d*)\s*(kg|grams?|gr|gm|mg|oz|lb|g)?\b/i);
  if (!match) return null;

  const value = Number.parseFloat(match[1].replace(/\s+/g, "").replace(",", "."));
  if (!Number.isFinite(value) || value < 0) return null;

  const unitKey = (match[2] || "g").toLowerCase();
  const factor = UNIT_TO_GRAMS[unitKey] ?? 1;
  const grams = value * factor;
  if (!(grams > 0) || grams > 10000) return null;
  return grams;
}

export function serialSupported() {
  return typeof navigator !== "undefined" && "serial" in navigator;
}

/**
 * @typedef {object} ScaleEvent
 * @property {'idle'|'unsupported'|'connecting'|'open'|'error'} status
 * @property {number|null} grams
 * @property {string} raw
 * @property {string} message
 */

export class UsbScale {
  constructor() {
    /** @type {SerialPort|null} */
    this.port = null;
    /** @type {ReadableStreamDefaultReader<Uint8Array>|null} */
    this.reader = null;
    /** @type {AbortController|null} */
    this.abort = null;
    /** @type {ScaleEvent['status']} */
    this.status = serialSupported() ? "idle" : "unsupported";
    this.grams = /** @type {number|null} */ (null);
    this.raw = "";
    this.message = serialSupported()
      ? "Balance USB non connectée"
      : "Balance USB : ouvrez le jeu dans Chrome sur l’ordinateur";
    /** @type {Set<(e: ScaleEvent) => void>} */
    this.listeners = new Set();
    this.readLoop = Promise.resolve();
    this.userClosed = false;

    if (serialSupported()) {
      navigator.serial.addEventListener("disconnect", (ev) => {
        if (ev.target === this.port) {
          this.handleDisconnect();
        }
      });
    }
  }

  /** @param {(e: ScaleEvent) => void} fn */
  subscribe(fn) {
    this.listeners.add(fn);
    fn(this.snapshot());
    return () => this.listeners.delete(fn);
  }

  snapshot() {
    return {
      status: this.status,
      grams: this.grams,
      raw: this.raw,
      message: this.message,
    };
  }

  emit() {
    const snap = this.snapshot();
    for (const fn of this.listeners) fn(snap);
  }

  async connect() {
    if (this.status === "open" || this.status === "connecting") return;
    this.userClosed = false;
    if (!serialSupported()) {
      this.status = "unsupported";
      this.message = "Balance USB : ouvrez le jeu dans Chrome sur l’ordinateur";
      this.emit();
      throw new Error("Web Serial indisponible");
    }
    this.status = "connecting";
    this.message = "Choisissez la balance dans la liste (FT232R / USB Serial)…";
    this.emit();

    /** @type {SerialPort} */
    let port;
    try {
      const granted = await navigator.serial.getPorts();
      port =
        granted.find((p) => isLikelyScale(p)) ||
        (await navigator.serial.requestPort({ filters: PORT_FILTERS }));
    } catch (err) {
      this.status = "idle";
      this.message =
        err && /** @type {{ name?: string }} */ (err).name === "NotFoundError"
          ? "Aucune balance choisie"
          : "Connexion annulée";
      this.emit();
      throw err;
    }

    await this.openPort(port);
  }

  /** @param {SerialPort} port */
  async openPort(port) {
    await this.close();
    this.port = port;
    this.status = "connecting";
    this.message = "Ouverture du port 9600 8N1…";
    this.emit();

    try {
      await withTimeout(
        port.open({
          baudRate: BAUD,
          dataBits: 8,
          stopBits: 1,
          parity: "none",
          flowControl: "none",
        }),
        OPEN_TIMEOUT_MS,
        "open-timeout",
      );
    } catch (err) {
      try {
        await port.close();
      } catch {
        /* still locked by another app */
      }
      this.port = null;
      this.status = "error";
      const busy = err && /** @type {{ message?: string }} */ (err).message === "open-timeout";
      this.message = busy
        ? "Port occupé. Fermez l’autre onglet ou Firefox, puis réessayez."
        : "Impossible d’ouvrir le port : " + (err?.message || "erreur");
      this.emit();
      throw err;
    }
    try {
      await port.setSignals({ dataTerminalReady: true, requestToSend: true });
    } catch {
      /* certains adaptateurs ignorent DTR/RTS */
    }

    this.status = "open";
    this.message = "Balance connectée — posez l’aliment (C5-0) ou appuyez sur UNIT (C5-2)";
    this.emit();

    this.abort = new AbortController();
    this.readLoop = this.pump(port).catch((err) => {
      if (this.abort?.signal.aborted) return;
      this.status = "error";
      this.message = "Lecture interrompue : " + (err?.message || "erreur série");
      this.emit();
    });
  }

  /** @param {SerialPort} port */
  async pump(port) {
    const decoder = new TextDecoder();
    let pending = "";
    this.reader = port.readable?.getReader() ?? null;
    if (!this.reader) throw new Error("Port illisible");

    try {
      while (true) {
        const { value, done } = await this.reader.read();
        if (done) break;
        if (!value) continue;
        pending += decoder.decode(value, { stream: true });
        const parts = pending.split(/\r\n|\n|\r/);
        pending = parts.pop() ?? "";
        for (const line of parts) {
          this.ingestLine(line);
        }
        if (pending.length > 80) {
          this.ingestLine(pending);
          pending = "";
        }
      }
    } finally {
      try {
        this.reader.releaseLock();
      } catch {
        /* already released */
      }
      this.reader = null;
    }
  }

  /** @param {string} line */
  ingestLine(line) {
    this.raw = line;
    const grams = parseScaleLine(line);
    if (grams == null) return;
    this.grams = grams;
    this.message = `Balance : ${formatGrams(grams)} g`;
    this.emit();
  }

  async disconnect() {
    this.userClosed = true;
    await this.close();
    this.status = "idle";
    this.grams = null;
    this.raw = "";
    this.message = "Balance USB déconnectée";
    this.emit();
  }

  async close() {
    this.abort?.abort();
    this.abort = null;
    if (this.reader) {
      try {
        await this.reader.cancel();
      } catch {
        /* ignore */
      }
      this.reader = null;
    }
    await this.readLoop.catch(() => {});
    if (this.port) {
      try {
        await this.port.close();
      } catch {
        /* already closed */
      }
      this.port = null;
    }
  }

  handleDisconnect() {
    this.port = null;
    this.reader = null;
    this.status = "idle";
    this.grams = null;
    this.message = "Balance débranchée";
    this.emit();
  }
}

/**
 * @param {Promise<T>} promise
 * @param {number} ms
 * @param {string} message
 * @returns {Promise<T>}
 * @template T
 */
function withTimeout(promise, ms, message) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}

function isLikelyScale(port) {
  const info = port.getInfo?.() || {};
  const vid = info.usbVendorId;
  if (!vid) return true;
  return PORT_FILTERS.some((f) => f.usbVendorId === vid);
}

/** @param {number} grams */
export function formatGrams(grams) {
  if (grams >= 100) return String(Math.round(grams));
  const rounded = Math.round(grams * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

export const usbScale = new UsbScale();
