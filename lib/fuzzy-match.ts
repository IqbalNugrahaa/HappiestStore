// @/lib/fuzzy-match.ts

export type ProductMatch = {
  id: string;
  name: string; // nama produk di katalog, mis. "CAPCUT PRIVATE 1 BULAN"
  price: number; // harga jual (opsional tapi dipakai di UI)
  similarity?: number; // 0..1
};

// ====== Utilities ======

const DURATIONS = [
  "bulan",
  "minggu",
  "hari",
  "bln",
  "hr",
  // variasi populer
  "mo",
  "month",
  "mth",
  "day",
  "week",
];

const NOISE_TOKENS = [
  ...DURATIONS,
  // penanda kuantitas/unit yang sering nongol
  "1",
  "2",
  "3",
  "4",
  "6",
  "12",
  "24",
  "4u",
  "8u",
  "4user",
  "8user",
  "antilimit",
  "sharing",
  "private",
  // platform/teks generik yang kurang membedakan (opsional, kita tidak buang "private"/"sharing" jika di katalog dipakai — lihat logic di bawah)
];

function normalizeASCII(s: string): string {
  // lowercase, ganti separator non-alnum jadi spasi, rapikan spasi
  return s
    .toLowerCase()
    .replace(/[“”„‟]/g, '"')
    .replace(/[\uFF0C\u060C\u3001\u066B\u201A]/g, ",") // koma unicode -> ,
    .replace(/[\u00A0\u200B-\u200D\u2060]/g, "") // invisible spaces
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function unifySynonyms(s: string): string {
  // contoh: "cap cut" -> "capcut"
  return s
    .replace(/\bcap\s*cut\b/g, "capcut")
    .replace(/\bnet\s*flix\b/g, "netflix")
    .replace(/\bgo\s*pay\b/g, "gopay");
}

function tokenize(s: string): string[] {
  if (!s) return [];
  return s.split(" ").filter(Boolean);
}

function removeNoiseTokens(tokens: string[], keepSet?: Set<string>): string[] {
  // buang token yang tidak relevan KECUALI kalau token itu muncul di nama produk (keepSet)
  const noise = new Set(NOISE_TOKENS);
  return tokens.filter((t) => {
    if (keepSet?.has(t)) return true;
    return !noise.has(t);
  });
}

function jaccard(a: Set<string>, b: Set<string>): number {
  const inter = new Set([...a].filter((x) => b.has(x))).size;
  const uni = new Set([...a, ...b]).size || 1;
  return inter / uni;
}

// bonus kecil jika token-set produk adalah subset query
function subsetBonus(prod: Set<string>, query: Set<string>): number {
  let ok = true;
  for (const t of prod) {
    if (!query.has(t)) {
      ok = false;
      break;
    }
  }
  return ok ? 0.1 : 0; // +0.1
}

// bonus kecil untuk kecocokan substring langsung
function containsBonus(prodName: string, query: string): number {
  return query.includes(prodName) ? 0.05 : 0;
}

// ====== Core ======

/**
 * Skor kemiripan antar string dengan:
 * - normalisasi
 * - token-set jaccard
 * - bonus subset & substring
 */
function scoreStrings(queryRaw: string, productRaw: string): number {
  let q = unifySynonyms(normalizeASCII(queryRaw));
  let p = unifySynonyms(normalizeASCII(productRaw));

  const pTokens0 = tokenize(p);
  const qTokens0 = tokenize(q);

  // token penting yang ADA di produk — jangan dibuang meskipun ada di NOISE_TOKENS
  const keep = new Set(pTokens0);

  const pTokens = removeNoiseTokens(pTokens0, keep);
  const qTokens = removeNoiseTokens(qTokens0, keep);

  const pSet = new Set(pTokens);
  const qSet = new Set(qTokens);

  let s = jaccard(pSet, qSet);
  s += subsetBonus(pSet, qSet);
  s += containsBonus(pTokens.join(" "), qTokens.join(" "));

  // clamp
  if (s > 1) s = 1;
  if (s < 0) s = 0;
  return s;
}

export function findBestMatch(
  query: string,
  products: Array<{ id: string; name: string; price?: number }>
): ProductMatch | undefined {
  if (!query || !products?.length) return undefined;

  // Heuristik: jika query punya nama orang di ujung setelah durasi, potong di belakangnya
  // (mis. "capcut private 1 bulan andika" -> "capcut private 1 bulan")
  // Ambil segmen sampai token DURASI (termasuk), buang sisanya.
  const norm = tokenize(unifySynonyms(normalizeASCII(query)));
  let cutIdx = -1;
  for (let i = 0; i < norm.length - 1; i++) {
    if (DURATIONS.includes(norm[i])) {
      cutIdx = i;
      break;
    }
  }
  const queryCore =
    cutIdx >= 0 ? norm.slice(0, cutIdx + 1).join(" ") : norm.join(" ");

  let best: ProductMatch | undefined;
  let bestScore = 0;

  for (const p of products) {
    const score = scoreStrings(queryCore, p.name);
    if (score > bestScore) {
      bestScore = score;
      best = {
        id: p.id,
        name: p.name,
        price: p.price ?? 0,
        similarity: score,
      };
    }
  }

  // Threshold yang toleran untuk kasus real-world
  const THRESHOLD = 0.68;
  return bestScore >= THRESHOLD ? best : undefined;
}
