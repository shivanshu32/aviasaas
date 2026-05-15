import { ObjectId } from 'mongodb';

/** Common pack / size suffixes at end of catalog or Excel names. */
const SIZE_TOKENS = new Set(['xs', 's', 'm', 'l', 'xl', 'xxl', 'll', 'mm', 'u', 'uni']);

export function normName(s) {
  if (s == null) return '';
  return String(s)
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/\./g, '');
}

/** Strip form prefixes (TAB., SYP., …) and normalize for matching. */
export function normalizeMedicineLabel(raw) {
  let s = String(raw ?? '').trim();
  s = s.replace(/^(tab\.?|syp\.?|cap\.?|caps?\.?|inj\.?|syr\.?|syrup\.?|drop\.?|drops\.?)\s+/i, '');
  s = s.replace(/\s*&\s*/g, ' and ');
  s = s.replace(/\s+/g, ' ').trim();
  return normName(s);
}

export function alnumCore(normOrRaw) {
  return normalizeMedicineLabel(normOrRaw).replace(/[^a-z0-9]/g, '');
}

export function escapeRegex(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function extractDbNameFromMongoUri(uri) {
  if (!uri || typeof uri !== 'string') return null;
  const noQuery = uri.split('?')[0];
  const pos = noQuery.indexOf('//');
  if (pos === -1) return null;
  const after = noQuery.slice(pos + 2);
  const slash = after.indexOf('/');
  if (slash === -1 || slash >= after.length - 1) return null;
  const name = after.slice(slash + 1).trim();
  return name || null;
}

/** @returns {{ base: string, size: string|null, packNum: string|null }} */
export function splitNameSizePack(normalized) {
  let norm = normalized;
  let size = null;
  let packNum = null;

  const withPack = norm.match(
    /^(.+?)\s+(xs|s|m|l|xl|xxl|ll|mm|u)\s+(\d+)\s*$/i,
  );
  if (withPack) {
    return {
      base: withPack[1].trim(),
      size: withPack[2].toLowerCase(),
      packNum: withPack[3],
    };
  }

  const sizeOnly = norm.match(/^(.+?)\s+(xs|s|m|l|xl|xxl|ll|mm|u)\s*$/i);
  if (sizeOnly) {
    return { base: sizeOnly[1].trim(), size: sizeOnly[2].toLowerCase(), packNum: null };
  }

  const packOnly = norm.match(/^(.+?)\s+(\d+)\s*$/);
  if (packOnly && !/\d+\s*mg|\d+\s*ml|\d+\s*gm/i.test(norm)) {
    return { base: packOnly[1].trim(), size: null, packNum: packOnly[2] };
  }

  return { base: norm, size: null, packNum: null };
}

function tokenize(normalized) {
  return normalized
    .split(/\s+/)
    .filter((w) => w.length > 0 && !['and', 'the', 'plus'].includes(w));
}

function jaccard(tokensA, tokensB) {
  if (!tokensA.length || !tokensB.length) return 0;
  const setA = new Set(tokensA);
  const setB = new Set(tokensB);
  let inter = 0;
  for (const t of setA) {
    if (setB.has(t)) inter += 1;
  }
  const union = new Set([...setA, ...setB]).size;
  return union ? inter / union : 0;
}

function levenshteinRatio(a, b) {
  if (!a || !b) return 0;
  if (a === b) return 1;
  const rows = a.length + 1;
  const cols = b.length + 1;
  const matrix = Array.from({ length: rows }, () => new Array(cols).fill(0));
  for (let i = 0; i < rows; i += 1) matrix[i][0] = i;
  for (let j = 0; j < cols; j += 1) matrix[0][j] = j;
  for (let i = 1; i < rows; i += 1) {
    for (let j = 1; j < cols; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost,
      );
    }
  }
  const dist = matrix[rows - 1][cols - 1];
  return 1 - dist / Math.max(a.length, b.length);
}

/**
 * Score 0–1 how well an Excel label matches a catalog medicine name.
 */
export function scoreMedicineNameMatch(excelRaw, dbRaw) {
  const excelNorm = normalizeMedicineLabel(excelRaw);
  const dbNorm = normalizeMedicineLabel(dbRaw);
  if (!excelNorm || !dbNorm) return 0;
  if (excelNorm === dbNorm) return 1;

  const excelParts = splitNameSizePack(excelNorm);
  const dbParts = splitNameSizePack(dbNorm);

  if (excelParts.base === dbParts.base && excelParts.size && dbParts.size) {
    if (excelParts.size === dbParts.size) return 0.99;
    return 0.15;
  }

  if (excelParts.size && dbParts.size && excelParts.size !== dbParts.size) {
    const baseJac = jaccard(tokenize(excelParts.base), tokenize(dbParts.base));
    if (baseJac >= 0.85) return 0.2;
  }

  const excelCore = alnumCore(excelRaw);
  const dbCore = alnumCore(dbRaw);
  if (excelCore.length >= 4 && dbCore.length >= 4) {
    if (excelCore === dbCore) return 0.97;
    // Short Excel label embedded in longer catalog name (e.g. AQUAGEL → EKRAN AQUA GEL 50G)
    if (dbCore.includes(excelCore) && excelCore.length >= 5) {
      return 0.78 + Math.min(excelCore.length / dbCore.length, 0.18);
    }
    if (excelCore.includes(dbCore) && dbCore.length >= 6) {
      return 0.76 + Math.min(dbCore.length / excelCore.length, 0.18);
    }
    const shorter = Math.min(excelCore.length, dbCore.length);
    const longer = Math.max(excelCore.length, dbCore.length);
    if (shorter / longer >= 0.55) {
      if (excelCore.includes(dbCore) || dbCore.includes(excelCore)) {
        return 0.72 + (shorter / longer) * 0.25;
      }
    }
    const lev = levenshteinRatio(excelCore, dbCore);
    if (lev >= 0.85) return lev;
  }

  const jac = jaccard(tokenize(excelNorm), tokenize(dbNorm));
  const jacBase = jaccard(tokenize(excelParts.base), tokenize(dbParts.base));
  let score = Math.max(jac, jacBase);

  const excelTokens = tokenize(excelNorm).filter((t) => t.length >= 3);
  const dbTokenList = tokenize(dbNorm);
  if (excelTokens.length >= 2) {
    let hits = 0;
    for (const t of excelTokens) {
      if (dbTokenList.some((dt) => dt === t || dt.includes(t) || t.includes(dt))) hits += 1;
    }
    const ratio = hits / excelTokens.length;
    if (ratio >= 0.85) score = Math.max(score, 0.75 + ratio * 0.2);
  }

  if (score >= 0.5) {
    score = Math.max(score, levenshteinRatio(excelCore, dbCore) * 0.95);
  }

  if (excelParts.size && dbParts.size && excelParts.size !== dbParts.size) {
    score *= 0.25;
  }

  return score;
}

export const DEFAULT_MIN_SCORE = 0.72;

/**
 * @returns {{ medicine: object, score: number } | null}
 */
const BLOCKLIST_NAMES = new Set(['gel', 'gummies', 'xyz', 'tab', 'syp', 'cap', 'inj']);

export function findBestMedicineMatch(excelName, medicines, minScore = DEFAULT_MIN_SCORE) {
  const excelNorm = normalizeMedicineLabel(excelName);
  if (!excelNorm || excelNorm.length < 4 || BLOCKLIST_NAMES.has(excelNorm)) {
    return null;
  }

  let best = null;
  let bestScore = 0;

  for (const m of medicines) {
    const score = scoreMedicineNameMatch(excelName, m.name);
    if (score > bestScore) {
      bestScore = score;
      best = m;
    }
  }

  if (!best || bestScore < minScore) return null;
  return { medicine: best, score: bestScore };
}

/**
 * Top N candidates for unmatched rows / debugging.
 */
export function rankMedicineMatches(excelName, medicines, limit = 5) {
  return medicines
    .map((m) => ({ medicine: m, score: scoreMedicineNameMatch(excelName, m.name) }))
    .filter((x) => x.score > 0.35)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

export function csvMatchCandidates(normCsv) {
  const out = [];
  const add = (s) => {
    const t = String(s || '')
      .trim()
      .replace(/\s+/g, ' ');
    if (t && !out.includes(t)) out.push(t);
  };
  if (!normCsv) return out;
  add(normCsv);
  add(normCsv.replace(/-/g, ' '));
  let s = normCsv;
  for (let pass = 0; pass < 12; pass += 1) {
    const prev = s;
    s = s.replace(/\s+\d+\*\d+$/i, '').trim();
    s = s.replace(/\s+\d+\s*ml$/i, '').trim();
    s = s.replace(/\s+\d+\s*gm$/i, '').trim();
    s = s.replace(/\s+\d+\s*mg$/i, '').trim();
    s = s
      .replace(
        /\s+(tab|cap|caps?|inj|syp|syr|gel|powder|sachet|oil|drops?|cream|lotions?|gummies|belt|brace|sling|shoe|splint|serum|unguent|oint)\.?$/i,
        '',
      )
      .trim();
    s = s.replace(/\s+\d+$/i, '').trim();
    if (s === prev) break;
    add(s);
    add(s.replace(/-/g, ' '));
  }
  const words = normCsv.split(/\s+/).filter(Boolean);
  if (words.length >= 4) add(words.slice(0, 4).join(' '));
  if (words.length >= 3) add(words.slice(0, 3).join(' '));
  if (words.length >= 2) add(words.slice(0, 2).join(' '));
  return out;
}

export function resolveMedicineForRow(
  rowItemName,
  normCsv,
  medicines,
  overrideValue,
  aliasMap = null,
) {
  if (aliasMap) {
    const aliasTarget =
      aliasMap[rowItemName] ?? aliasMap[normCsv] ?? aliasMap[normalizeMedicineLabel(rowItemName)];
    if (aliasTarget) {
      const resolved = resolveMedicineForRow(
        aliasTarget,
        normalizeMedicineLabel(aliasTarget),
        medicines,
        null,
        null,
      );
      if (resolved) return resolved;
    }
  }

  if (overrideValue) {
    if (typeof overrideValue === 'string') {
      if (ObjectId.isValid(overrideValue)) {
        const id = new ObjectId(overrideValue);
        const m = medicines.find((x) => x._id.equals(id));
        if (m) return m;
      }
      const byCode = medicines.find((x) => x.medicineId === overrideValue);
      if (byCode) return byCode;
      const byName = medicines.find(
        (x) => normalizeMedicineLabel(x.name) === normalizeMedicineLabel(overrideValue),
      );
      if (byName) return byName;
      return null;
    }
    if (overrideValue.objectId && ObjectId.isValid(overrideValue.objectId)) {
      const id = new ObjectId(overrideValue.objectId);
      const m = medicines.find((x) => x._id.equals(id));
      if (m) return m;
    }
    if (overrideValue.medicineId) {
      const m = medicines.find((x) => x.medicineId === overrideValue.medicineId);
      if (m) return m;
    }
    if (overrideValue.name) {
      const m = medicines.find(
        (x) => normalizeMedicineLabel(x.name) === normalizeMedicineLabel(overrideValue.name),
      );
      if (m) return m;
    }
    return null;
  }

  const excelNorm = normalizeMedicineLabel(rowItemName);
  const exact = medicines.find((x) => normalizeMedicineLabel(x.name) === excelNorm);
  if (exact) return exact;

  const minScore = Number(process.env.IMPORT_PRICE_MIN_SCORE) || DEFAULT_MIN_SCORE;
  const ranked = findBestMedicineMatch(rowItemName, medicines, minScore);
  return ranked?.medicine ?? null;
}
