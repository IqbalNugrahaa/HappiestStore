// @/lib/csv-parser.ts

// ===================== Types =====================

export interface CSVRow {
  date: string; // yyyy-mm-dd
  itemPurchase: string;
  customerName: string; // boleh kosong
  storeName: string;
  paymentMethod: string;
  purchasePrice: number; // angka bulat
  notes: string;
}

export type ParsedCSVData = { data: CSVRow[]; errors: string[] };

// ===================== Helpers: Normalisasi dasar =====================

function normalizeCsv(raw: string): string {
  return raw.replace(/\uFEFF/g, "").replace(/\r\n?/g, "\n");
}

const normHeader = (h: string) =>
  h
    .trim()
    .toLowerCase()
    .replace(/[_\s]+/g, "");

// ===================== Helpers: Delimiter & Split =====================

/** Split CSV line yang paham kutip & escape ("") */
function splitCsvLine(line: string, delimiter = ","): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++; // escape ""
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === delimiter && !inQuotes) {
      out.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out.map((c) => c.trim());
}

/** Deteksi delimiter dari beberapa baris awal */
function detectDelimiter(lines: string[], expectedMinCols = 2): string {
  const candidates = [",", ";", "\t", "|"];
  let best = ",";
  let bestScore = -1;

  for (const d of candidates) {
    let ok = 0;
    let cols = -1;

    for (let i = 0; i < Math.min(lines.length, 10); i++) {
      const parts = splitCsvLine(lines[i], d);
      if (cols === -1) cols = parts.length;
      if (parts.length === cols && parts.length >= expectedMinCols) ok++;
    }

    const score = ok * (cols ?? 1);
    if (score > bestScore) {
      bestScore = score;
      best = d;
    }
  }
  return best;
}

// ===================== Helpers: Angka & Koma Aneh =====================

/** Bersihkan angka: hilangkan Rp, spasi, pemisah ribuan (.,), jaga minus & titik desimal */
function toNumberSafe(v: string): number {
  if (!v) return 0;
  let s = v.replace(/Rp\.?\s*/gi, "").replace(/\s+/g, "");

  // gabungkan pemisah ribuan berulang: 1.234.567 -> 1234567, 13,319 -> 13319
  let prev: string;
  do {
    prev = s;
    s = s.replace(/(\d)[.,](\d{3})(?!\d)/g, "$1$2");
  } while (s !== prev);

  // jika tersisa koma sebagai desimal, ubah ke titik (kasus tertentu)
  if (/,/.test(s) && !/\.\d{1,2}\b/.test(s)) {
    s = s.replace(/,/g, ".");
  }

  const num = Number.parseFloat(s.replace(/[^\d.-]/g, ""));
  return Number.isFinite(num) ? num : 0;
}

// ===================== Sanitizer =====================

const COMMA_VARIANTS = /[\uFF0C\u060C\u3001\u066B\u201A]/g;
const INVISIBLE_WS = /[\u00A0\u200B\u200C\u200D\u2060]/g;
const SMART_QUOTES = /[“”„‟]/g;

function sanitizeForDelimiter(s: string): string {
  return s
    .replace(SMART_QUOTES, '"')
    .replace(COMMA_VARIANTS, ",")
    .replace(INVISIBLE_WS, "");
}

// ===================== Coalescer: Gabungkan record multi-line =====================

/** Gabungkan baris-baris hingga kutip seimbang (mendukung escape "") */
function coalesceQuotedRecords(txt: string): string[] {
  const rawLines = normalizeCsv(txt).split("\n");
  const out: string[] = [];
  let buf = "";
  let inQuotes = false;

  for (const raw of rawLines) {
    const line = sanitizeForDelimiter(raw);

    buf = buf ? `${buf}\n${line}` : line;

    for (let i = 0; i < line.length; i++) {
      if (line[i] === '"') {
        if (line[i + 1] === '"') {
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      }
    }

    if (!inQuotes) {
      if (buf.trim().length > 0) out.push(buf);
      buf = "";
    }
  }

  if (buf.trim().length > 0) out.push(buf);
  return out.filter((l) => l.trim().length > 0);
}

// ===================== Helpers: per-baris fallback =====================

function trySplitWithDelims(
  line: string,
  headerLen: number,
  delims: string[]
): string[] | null {
  for (const d of delims) {
    const cells = splitCsvLine(line, d);
    if (cells.length === headerLen) return cells;
  }
  return null;
}

// …,"12", "500",… -> …,"12,500",…
function mergeThousandGroupsOnce(cells: string[]): string[] {
  const out: string[] = [];
  let i = 0;
  while (i < cells.length) {
    const cur = cells[i];
    const nxt = cells[i + 1];
    if (
      i < cells.length - 1 &&
      /\d$/.test((cur ?? "").trim()) &&
      /^\d{3}$/.test((nxt ?? "").trim())
    ) {
      out.push(`${(cur ?? "").trim()},${(nxt ?? "").trim()}`);
      i += 2;
    } else {
      out.push(cur ?? "");
      i += 1;
    }
  }
  return out;
}

/** Paksa jumlah kolom = headerLen (coerce):
 *  - Jika > headerLen → gabungkan kelebihan kolom ke kolom terakhir (Notes).
 *  - Jika < headerLen → pad dengan kolom kosong.
 */
function forceFitToHeader(
  cells: string[],
  headerLen: number,
  delimiter = ","
): string[] {
  if (cells.length === headerLen) return cells.slice();

  if (cells.length > headerLen) {
    const head = cells.slice(0, headerLen - 1);
    const tailJoined = cells.slice(headerLen - 1).join(delimiter);
    return [...head, tailJoined];
  }

  // cells.length < headerLen
  const padded = cells.slice();
  while (padded.length < headerLen) padded.push("");
  return padded;
}

/** Periksa & perbaiki satu baris agar jumlah kolom == headerLen */
function inspectAndFixRow(
  rawLine: string,
  primaryDelimiter: string,
  headerLen: number
): { cells: string[]; note?: string } {
  const line = rawLine;

  // 1) coba pakai delimiter utama (aware quotes)
  let cells = splitCsvLine(line, primaryDelimiter);

  // 2) kalau tidak cocok, coba delimiter lain (aware quotes)
  if (cells.length !== headerLen) {
    const alt = [",", ";", "\t", "|"].filter((d) => d !== primaryDelimiter);
    const fallback = trySplitWithDelims(line, headerLen, alt);
    if (fallback) {
      return { cells: fallback, note: "used-alt-delimiter" };
    }
  }

  // 3) jika kelebihan kolom, merge angka ribuan bertahap
  if (cells.length > headerLen) {
    let prevLen = cells.length;
    let guard = 0;
    while (cells.length > headerLen && guard < 8) {
      const merged = mergeThousandGroupsOnce(cells);
      cells = merged;
      guard++;
      if (cells.length === prevLen) break;
      prevLen = cells.length;
    }
  }

  // 4) LAST-RESORT: naive split + merge ribuan + force fit
  if (cells.length !== headerLen) {
    let naive = line.split(primaryDelimiter).map((c) => c.trim());

    // gabungkan ribuan
    let guard = 0;
    while (naive.length > headerLen && guard < 12) {
      naive = mergeThousandGroupsOnce(naive);
      guard++;
    }

    // paksa pas (gabungkan tail → Notes / pad kosong)
    const fitted = forceFitToHeader(naive, headerLen, primaryDelimiter);
    return { cells: fitted, note: "naive-split-force-fit" };
  }

  return { cells };
}

// ===================== Parser Utama =====================

export function parseCSV(csvContent: string): ParsedCSVData {
  // 1) Gabungkan dulu record multi-line yang dikutip
  const lines = coalesceQuotedRecords(csvContent);

  const data: CSVRow[] = [];
  const errors: string[] = [];

  if (lines.length < 2) {
    errors.push("CSV file must contain at least a header row and one data row");
    return { data, errors };
  }

  // ==== DETECT DELIMITER ====
  const sample = lines.slice(0, Math.min(lines.length, 10));
  const delimiter = detectDelimiter(sample, 2);

  // Header
  const headerLine = lines[0];
  const headerCells = splitCsvLine(headerLine, delimiter);
  const headersNorm = headerCells.map(normHeader);

  // Alias header fleksibel
  const want = {
    date: ["date"],
    itemPurchase: ["itempurchase", "item purchase", "item_purchase"],
    customerName: ["customername", "customer name", "customer_name"],
    storeName: ["storename", "store name", "store_name"],
    paymentMethod: ["paymentmethod", "payment method", "payment_method"],
    purchase: ["purchase", "purchaseprice", "purchase_price"],
    notes: ["notes", "note"],
  } as const;

  const findIndex = (aliases: readonly string[]) => {
    const set = new Set(aliases.map((a) => a.toLowerCase()));
    return headersNorm.findIndex((h) => set.has(h));
  };

  const idx = {
    date: findIndex(want.date),
    itemPurchase: findIndex(want.itemPurchase),
    customerName: findIndex(want.customerName),
    storeName: findIndex(want.storeName),
    paymentMethod: findIndex(want.paymentMethod),
    purchase: findIndex(want.purchase),
    notes: findIndex(want.notes),
  };

  const missing: string[] = [];
  if (idx.date < 0) missing.push("date");
  if (idx.itemPurchase < 0) missing.push("item purchase");
  if (idx.storeName < 0) missing.push("store name");
  if (idx.paymentMethod < 0) missing.push("payment method");
  if (idx.purchase < 0) missing.push("purchase");
  if (missing.length) {
    errors.push(`Missing required columns: ${missing.join(", ")}`);
    return { data, errors };
  }

  // ==== DATA ROWS ====
  for (let r = 1; r < lines.length; r++) {
    const rawLine = lines[r];
    if (!rawLine.trim()) continue;

    // Selalu kembalikan cells dengan panjang = headerCells.length
    const { cells } = inspectAndFixRow(rawLine, delimiter, headerCells.length);

    const get = (i: number) => (i >= 0 && i < cells.length ? cells[i] : "");

    const rawDate = get(idx.date);
    const itemPurchase = get(idx.itemPurchase);
    const customerName = get(idx.customerName); // boleh kosong
    const storeName = get(idx.storeName);
    const paymentMethod = get(idx.paymentMethod);
    const purchaseStr = get(idx.purchase);
    const notes = get(idx.notes) || "";

    // --- PARSE PURCHASE DULU (agar validasi longgar) ---
    const purchasePrice = toNumberSafe(purchaseStr);

    // Tanggal -> yyyy-mm-dd (UTC-normalized)
    const d = new Date(rawDate);
    if (Number.isNaN(d.getTime())) {
      errors.push(`Row ${r + 1}: Invalid date "${rawDate}"`);
      continue;
    }
    const isoDate = new Date(
      Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())
    )
      .toISOString()
      .slice(0, 10);

    // ====== VALIDASI LONGGAR ======
    // (DILEPASKAN) Tidak ada lagi error untuk itemPurchase kosong.
    // if (!itemPurchase && !(purchasePrice === 0)) { ... }  ← dihapus

    if (!storeName) {
      errors.push(`Row ${r + 1}: Store name is required`);
      continue;
    }
    if (!paymentMethod) {
      errors.push(`Row ${r + 1}: Payment method is required`);
      continue;
    }

    data.push({
      date: isoDate,
      itemPurchase, // boleh kosong
      customerName,
      storeName,
      paymentMethod,
      purchasePrice, // 0 jika kosong/""/0
      notes,
    });
  }

  return { data, errors };
}

// (opsional) default export
export default parseCSV;
