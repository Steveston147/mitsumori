const HISTORY_KEY = "mitsumori.projectHistory";
const MAX_PROJECTS = 6;

function readJson(value, fallback) {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

export function readProjectHistory() {
  const history = readJson(window.localStorage.getItem(HISTORY_KEY), []);
  return Array.isArray(history) ? history : [];
}

function projectName(payload) {
  return payload?.programBasicInfo?.programName
    || payload?.storage?.["mitsumori.programBasicInfo"]?.programName
    || "名称未設定の見積";
}

export function rememberProject(payload, source = "save") {
  if (!payload?.storage || typeof payload.storage !== "object") return;
  const name = projectName(payload);
  const now = new Date().toISOString();
  const entry = {
    id: `${name}::${now}`,
    name,
    source,
    updatedAt: now,
    exportedAt: payload.exportedAt || now,
    storage: payload.storage,
  };
  const next = [entry, ...readProjectHistory().filter((item) => item.name !== name)].slice(0, MAX_PROJECTS);
  window.localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
  window.dispatchEvent(new CustomEvent("mitsumori-project-history-change"));
}

export function rememberCurrentProject(source = "save") {
  const storage = {};
  for (let index = 0; index < window.localStorage.length; index += 1) {
    const key = window.localStorage.key(index);
    if (!key?.startsWith("mitsumori.") || key === HISTORY_KEY) continue;
    const raw = window.localStorage.getItem(key);
    storage[key] = readJson(raw, raw);
  }
  rememberProject({
    exportedAt: new Date().toISOString(),
    programBasicInfo: storage["mitsumori.programBasicInfo"] || {},
    storage,
  }, source);
}

export function restoreProject(entry) {
  Object.entries(entry?.storage || {}).forEach(([key, value]) => {
    if (!key.startsWith("mitsumori.") || key === HISTORY_KEY) return;
    window.localStorage.setItem(key, typeof value === "string" ? value : JSON.stringify(value));
  });
}

export function clearCurrentEstimate() {
  const remove = [];
  for (let index = 0; index < window.localStorage.length; index += 1) {
    const key = window.localStorage.key(index);
    if (key?.startsWith("mitsumori.") && key !== HISTORY_KEY) remove.push(key);
  }
  remove.forEach((key) => window.localStorage.removeItem(key));
}

export function removeProject(id) {
  const next = readProjectHistory().filter((item) => item.id !== id);
  window.localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
  window.dispatchEvent(new CustomEvent("mitsumori-project-history-change"));
}

export const PROJECT_HISTORY_KEY = HISTORY_KEY;
