const xlsx = require("xlsx");
const fs = require("fs");

const projectPath = "c:\\Users\\ssanz\\OneDrive\\Documentos\\ChainPointAI\\SERVING\\SMA\\backend\\documents\\1111.xlsx";
const budgetPath = "c:\\Users\\ssanz\\OneDrive\\Documentos\\ChainPointAI\\SERVING\\SMA\\backend\\documents\\20260303 Presupuesto Bosque de Agua V5.xlsx";

// Let's run a quick replication of the cost split logic in memory and look for tasks with value between 50M and 60M COP
const budgetWorkbook = xlsx.readFile(budgetPath);
const budgetSheetName = budgetWorkbook.SheetNames.find(n => n.includes("V5")) || budgetWorkbook.SheetNames[0];
const budgetWorksheet = budgetWorkbook.Sheets[budgetSheetName];
const budgetRows = xlsx.utils.sheet_to_json(budgetWorksheet, { header: 1 });

const isCode = (s) => {
  const clean = String(s).replace(/\.0$/, "").replace(/\./g, "").trim();
  return /^\d+$/.test(clean) && clean.length >= 4;
};

const budgetItems = [];
let currentChapter = "Otros";

for (let i = 10; i < Math.min(304, budgetRows.length); i++) {
  const row = budgetRows[i];
  if (!row || row.length === 0) continue;

  const col2 = row[2] !== undefined && row[2] !== null ? String(row[2]).trim() : "";
  const col1 = row[1] !== undefined && row[1] !== null ? String(row[1]).trim() : "";
  const col4 = row[4] !== undefined && row[4] !== null ? String(row[4]).trim() : "";

  if (col4.includes("COSTO DIRECTO") || col2.includes("COSTO DIRECTO") || col1.includes("COSTO DIRECTO")) {
    break;
  }

  let code = "";
  let desc = "";
  let unit = "";
  let totalVal = 0;

  const c0 = row[0] !== undefined && row[0] !== null ? String(row[0]).trim() : "";
  const c1 = row[1] !== undefined && row[1] !== null ? String(row[1]).trim() : "";
  let totalColIdx = 8;

  if (isCode(c0)) {
    code = c0.replace(/\.0$/, "").replace(/\./g, "").trim();
    desc = row[1] !== undefined && row[1] !== null ? String(row[1]).trim() : "";
    unit = row[2] !== undefined && row[2] !== null ? String(row[2]).trim() : "";
    totalColIdx = 7;
  } else if (isCode(c1)) {
    code = c1.replace(/\.0$/, "").replace(/\./g, "").trim();
    desc = row[2] !== undefined && row[2] !== null ? String(row[2]).trim() : "";
    unit = row[3] !== undefined && row[3] !== null ? String(row[3]).trim() : "";
    totalColIdx = 8;
  } else {
    desc = row[2] !== undefined && row[2] !== null ? String(row[2]).trim() : "";
    unit = row[3] !== undefined && row[3] !== null ? String(row[3]).trim() : "";
    code = `R-${i + 1}`;
    totalColIdx = 8;
  }

  if (totalColIdx < row.length && row[totalColIdx] !== undefined && row[totalColIdx] !== null) {
    const num = parseFloat(String(row[totalColIdx]).replace(/[$,]/g, ""));
    if (!isNaN(num)) {
      totalVal = num;
    }
  }

  if (desc) {
    const hasUnit = unit && unit.length > 0 && unit !== "null" && isNaN(Number(unit));
    const looksLikeChapter = !hasUnit && totalVal > 0 && !row[4];

    if (looksLikeChapter || (code && (code.endsWith("0000") || code.endsWith("00")) && !hasUnit)) {
      currentChapter = desc;
    } else if (desc !== "NOMBRE" && desc !== "TOTAL" && !desc.includes("PRESUPUESTO") && hasUnit) {
      budgetItems.push({
        code: code,
        desc: desc,
        val: totalVal || 0,
        chapter: currentChapter,
      });
    }
  }
}

const projectWorkbook = xlsx.readFile(projectPath);
const projectSheetName = projectWorkbook.SheetNames[0];
const projectWorksheet = projectWorkbook.Sheets[projectSheetName];
const projectRows = xlsx.utils.sheet_to_json(projectWorksheet, { defval: "" });

const scheduleItemsRaw = [];
projectRows.forEach((row) => {
  let name = "";
  let start = "";
  let end = "";
  let schemaLevel = 3;

  Object.entries(row).forEach(([k, v]) => {
    const keyUpper = String(k).toUpperCase();
    if (keyUpper.includes("NOMBRE")) {
      name = String(v).trim();
    } else if (keyUpper.includes("COMIENZO")) {
      start = String(v).trim();
    } else if (keyUpper.includes("FIN")) {
      end = String(v).trim();
    } else if (keyUpper.includes("NIVEL DE ESQUEMA") || keyUpper.includes("ESQUEMA")) {
      schemaLevel = parseInt(String(v)) || 3;
    }
  });

  if (name && start) {
    scheduleItemsRaw.push({ name, start, end, level: schemaLevel });
  }
});

let scheduleItems = scheduleItemsRaw.filter(t => t.level >= 3);
if (scheduleItems.length === 0) {
  scheduleItems = scheduleItemsRaw;
}

// Replicate mapping locally
function getWordTokens(text) {
  if (!text) return [];
  const clean = String(text).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const words = clean.replace(/[^a-z0-9\s]/g, " ").split(/\s+/);
  const stopwords = new Set(["de", "en", "para", "con", "el", "la", "los", "las", "un", "una", "y", "o", "del", "al", "a", "e", "u"]);
  return words.map(w => w.trim()).filter(w => w.length > 1 && !stopwords.has(w));
}

const SYNONYM_GROUPS = [
  ["acueducto", "alcantarillado", "hidraulico", "sanitario", "pluvial", "tuberia", "tubo", "agua", "redes", "acometida", "registro", "valvula", "caja", "bajante", "desague", "ventila", "drenaje", "sifon", "pvc", "presion", "pozo", "filtro", "canal", "canalizacion"],
  ["concreto", "cemento", "mortero", "viga", "columna", "losa", "zapata", "cimentacion", "fundacion", "acero", "hierro", "refuerzo", "estructura", "pilote", "placa", "pedestal", "muro", "formaleta", "malla", "electrosoldada", "estribo", "figurado", "fundicion"]
];

function calculateSemanticSimilarity(itemDesc, taskName) {
  const itemTokens = getWordTokens(itemDesc);
  const taskTokens = getWordTokens(taskName);
  if (itemTokens.length === 0 || taskTokens.length === 0) return 0;
  let matchScore = 0;
  itemTokens.forEach(iTok => {
    let bestTokenScore = 0;
    taskTokens.forEach(tTok => {
      let currentScore = 0;
      if (iTok === tTok) {
        currentScore = 1.0;
      } else if (iTok.length >= 4 && tTok.length >= 4 && (iTok.startsWith(tTok.substring(0, 4)) || tTok.startsWith(iTok.substring(0, 4)))) {
        currentScore = 0.8;
      } else {
        const shareGroup = SYNONYM_GROUPS.some(group => group.includes(iTok) && group.includes(tTok));
        if (shareGroup) currentScore = 0.6;
      }
      if (currentScore > bestTokenScore) bestTokenScore = currentScore;
    });
    matchScore += bestTokenScore;
  });
  return matchScore / itemTokens.length;
}

function getTopBudgetCandidates(task, budgets, count = 5) {
  const scored = budgets.map(budget => {
    const score = calculateSemanticSimilarity(budget.desc, task.name);
    return { budget, score };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, count).map(s => s.budget);
}

const enrichedTasks = scheduleItems.map((task, idx) => {
  const candidates = getTopBudgetCandidates(task, budgetItems, 5);
  const best = candidates[0] || { code: "sin_presupuesto", chapter: "Otros", val: 0, desc: "" };
  return {
    id: `t-${idx}`,
    name: task.name,
    chapter: best.chapter,
    code: best.code,
    val: best.val,
    desc: best.desc
  };
});

// Let's count how many tasks map to each code
const counts = {};
enrichedTasks.forEach(t => {
  if (t.code !== "sin_presupuesto") {
    counts[t.code] = (counts[t.code] || 0) + 1;
  }
});

console.log("=== CALCULANDO TAREAS ENTRE 45M Y 60M COP ===");
enrichedTasks.forEach(t => {
  const M = counts[t.code] || 1;
  const split = t.val / M;
  
  // Apply the same orphan calculation
  // (we can estimate it or just print the ones that have a split value that could sum to 55M)
  if (split >= 10000000 && split <= 60000000) {
    console.log(`Tarea: "${t.name}" | Capítulo: "${t.chapter}" | Código: "${t.code}" | Divisor: ${M} | Costo Split: ${(split / 1000000).toFixed(2)}M | Valor Original: ${(t.val / 1000000).toFixed(2)}M`);
  }
});
