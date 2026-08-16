/* =======================================================================
   GameHub — app.js
   >>> TROQUE APENAS AS CREDENCIAIS ABAIXO PELAS DO SEU PROJETO FIREBASE <<<
   Ative no Firebase Console: Authentication > Sign-in method > E-mail/senha
   e crie MANUALMENTE o usuário admin@admin.com (não há cadastro público).
   ======================================================================= */
const firebaseConfig = {
  apiKey: "SUA_API_KEY",
  authDomain: "SEU_PROJETO.firebaseapp.com",
  databaseURL: "https://SEU_PROJETO-default-rtdb.firebaseio.com",
  projectId: "SEU_PROJETO",
  storageBucket: "SEU_PROJETO.appspot.com",
  messagingSenderId: "000000000000",
  appId: "1:000000000000:web:xxxxxxxxxxxx"
};

const ADMIN_EMAIL = "admin@admin.com";

/* Regras sugeridas do Realtime Database (cole no console):
{
  "rules": {
    ".read": true,
    ".write": "auth != null && auth.token.email === 'admin@admin.com'"
  }
}
*/

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getDatabase, ref, onValue, push, set, update, remove
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);

const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];

/* ================= BLINDAGEM (clique direito / atalhos) ================= */
document.addEventListener("contextmenu", (e) => e.preventDefault());
document.addEventListener("dragstart", (e) => e.preventDefault());
document.addEventListener("keydown", (e) => {
  const k = (e.key || "").toLowerCase();
  const block =
    k === "f12" ||
    (e.ctrlKey && e.shiftKey && ["i", "j", "c", "k"].includes(k)) ||
    (e.ctrlKey && ["u", "s", "p"].includes(k)) ||
    (e.metaKey && e.altKey && ["i", "j", "c"].includes(k));
  if (block) { e.preventDefault(); e.stopPropagation(); }
});

/* ================= ESTADO ================= */
let games = [];
let settings = {};
let menuItems = [];
let footerLinks = [];
let page = 1;
let view = localStorage.getItem("view") || "mosaic";
const PER_PAGE = 15;
const MAX_PAGES_SHOWN = 10;

/* ================= TEMA ================= */
function applyTheme(t) {
  document.documentElement.dataset.theme = t;
  localStorage.setItem("theme", t);
  $("#themeBtn").textContent = t === "dark" ? "🌙" : "☀️";
}
applyTheme(localStorage.getItem("theme") || "dark");
$("#themeBtn").onclick = () =>
  applyTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark");

/* ================= MODAIS ================= */
function open(id) { $(id).hidden = false; document.body.style.overflow = "hidden"; }
function close(id) { $(id).hidden = true; document.body.style.overflow = ""; }
$$(".overlay").forEach((ov) => {
  ov.addEventListener("click", (e) => {
    if (e.target === ov || e.target.hasAttribute("data-close")) close("#" + ov.id);
  });
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") $$(".overlay").forEach((o) => { if (!o.hidden) close("#" + o.id); });
});

/* ================= HELPERS ================= */
const toMB = (g) => (String(g.unit).toUpperCase() === "GB" ? Number(g.size) * 1024 : Number(g.size));
const sizeLabel = (g) => `${g.size} ${g.unit}`;
const fileToBase64 = (file) =>
  new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.onerror = rej;
    r.readAsDataURL(file);
  });
const PLACEHOLDER =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="400"><rect width="100%" height="100%" fill="#1b2430"/><text x="50%" y="50%" fill="#8fa0b3" font-family="sans-serif" font-size="20" text-anchor="middle">Sem capa</text></svg>`
  );

/* ================= LEITURA DO DATABASE ================= */
onValue(ref(db, "games"), (snap) => {
  const val = snap.val() || {};
  games = Object.entries(val).map(([id, g]) => ({ id, ...g }));
  buildFilterOptions();
  render();
  renderAdminGames();
});

onValue(ref(db, "menu"), (snap) => {
  const val = snap.val() || {};
  menuItems = Object.entries(val).map(([id, m]) => ({ id, ...m }));
  renderMenu();
  renderAdminMenu();
});

onValue(ref(db, "footer/links"), (snap) => {
  const val = snap.val() || {};
  footerLinks = Object.entries(val).map(([id, l]) => ({ id, ...l }));
  renderFooterLinks();
  renderAdminLinks();
});

onValue(ref(db, "footer/attribution"), (snap) => {
  const t = snap.val() || "";
  $("#footerAttribution").textContent = t;
  $("#attrText").value = t;
});

onValue(ref(db, "help"), (snap) => {
  const t = snap.val() || "Clique em um jogo para ver detalhes e baixar.";
  $("#helpText").value = t;
  $("#helpContent").innerHTML = String(t)
    .split("\n")
    .filter(Boolean)
    .map((p) => `<p>${escapeHtml(p)}</p>`)
    .join("");
});

onValue(ref(db, "settings"), (snap) => {
  settings = snap.val() || {};
  applySettings();
});

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );
}

/* ================= APARÊNCIA ================= */
function applySettings() {
  const r = document.documentElement.style;
  if (settings.accent) r.setProperty("--accent", settings.accent);
  if (settings.bgDark) r.setProperty("--bg-dark", settings.bgDark);
  if (settings.bgLight) r.setProperty("--bg-light", settings.bgLight);
  if (settings.radius) r.setProperty("--radius", settings.radius + "px");

  const name = settings.siteName || "GameHub";
  document.title = name + " — Central de Jogos";
  $("#brandFallback").textContent = name;

  const sq = $("#logoSquare"), wd = $("#logoWord");
  sq.hidden = !settings.logoSquare;
  if (settings.logoSquare) sq.src = settings.logoSquare;
  wd.hidden = !settings.logoWord;
  if (settings.logoWord) wd.src = settings.logoWord;
  $("#brandFallback").hidden = !!settings.logoWord;

  $("#tSiteName").value = settings.siteName || "";
  $("#tAccent").value = settings.accent || "#00e5a0";
  $("#tBgDark").value = settings.bgDark || "#0b0f14";
  $("#tBgLight").value = settings.bgLight || "#f4f6f8";
  $("#tRadius").value = settings.radius ?? 14;
  $("#tLogoSquare").value = settings.logoSquare?.startsWith("data:") ? "" : settings.logoSquare || "";
  $("#tLogoWord").value = settings.logoWord?.startsWith("data:") ? "" : settings.logoWord || "";
}

/* ================= MENU / RODAPÉ ================= */
function renderMenu() {
  const html = menuItems
    .map((m) => `<a href="${escapeHtml(m.url)}">${escapeHtml(m.label)}</a>`)
    .join("");
  $("#menuBar").innerHTML = html;
  $("#menuMobile").innerHTML = html;
}
$("#burger").onclick = () => $("#menuMobile").classList.toggle("open");
$("#helpBtn").onclick = () => open("#helpModal");

function renderFooterLinks() {
  $("#footerLinks").innerHTML = footerLinks
    .map((l) => `<li><a href="${escapeHtml(l.url)}">${escapeHtml(l.label)}</a></li>`)
    .join("");
}

/* ================= FILTROS ================= */
function buildFilterOptions() {
  const cats = [...new Set(games.map((g) => g.category).filter(Boolean))].sort();
  const plats = [...new Set(games.map((g) => g.platform).filter(Boolean))].sort();
  const fill = (sel, arr, all) => {
    const cur = sel.value;
    sel.innerHTML = `<option value="">${all}</option>` +
      arr.map((v) => `<option>${escapeHtml(v)}</option>`).join("");
    sel.value = arr.includes(cur) ? cur : "";
  };
  fill($("#filterCategory"), cats, "Todas as categorias");
  fill($("#filterPlatform"), plats, "Todas as plataformas");
}

function filtered() {
  const q = $("#search").value.trim().toLowerCase();
  const cat = $("#filterCategory").value;
  const plat = $("#filterPlatform").value;
  let list = games.filter((g) => {
    const hay = [g.title, g.platform, g.category, g.code].join(" ").toLowerCase();
    return (!q || hay.includes(q)) && (!cat || g.category === cat) && (!plat || g.platform === plat);
  });
  const s = $("#sort").value;
  list.sort((a, b) => {
    if (s === "az") return (a.title || "").localeCompare(b.title || "", "pt-BR");
    if (s === "za") return (b.title || "").localeCompare(a.title || "", "pt-BR");
    if (s === "sizeAsc") return toMB(a) - toMB(b);
    return toMB(b) - toMB(a);
  });
  return list;
}

["#search", "#filterCategory", "#filterPlatform", "#sort"].forEach((s) =>
  $(s).addEventListener("input", () => { page = 1; render(); })
);

$("#viewBtn").onclick = () => {
  view = view === "mosaic" ? "list" : "mosaic";
  localStorage.setItem("view", view);
  render();
};

/* ================= RENDER GRID ================= */
function render() {
  const list = filtered();
  const grid = $("#grid");
  grid.className = "grid " + view;
  $("#viewBtn").textContent = view === "mosaic" ? "▦ Mosaico" : "☰ Lista";

  const pages = Math.max(1, Math.ceil(list.length / PER_PAGE));
  if (page > pages) page = pages;
  const slice = list.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  $("#empty").hidden = list.length !== 0;
  grid.innerHTML = slice
    .map(
      (g) => `<article class="card" data-id="${g.id}">
        <img src="${g.cover || PLACEHOLDER}" alt="${escapeHtml(g.title || "")}" loading="lazy" />
        <div class="card-body">
          <div class="card-title">${escapeHtml(g.title || "")}</div>
          <div class="card-sub">${escapeHtml(g.platform || "")} • ${escapeHtml(sizeLabel(g))}</div>
        </div>
      </article>`
    )
    .join("");

  grid.querySelectorAll(".card").forEach((c) =>
    (c.onclick = () => openGame(c.dataset.id))
  );

  renderPagination(list.length, pages);
}

function renderPagination(total, pages) {
  const el = $("#pagination");
  if (total <= PER_PAGE) { el.innerHTML = ""; return; }

  let start = 1, end = pages;
  if (pages > MAX_PAGES_SHOWN) {
    start = Math.min(Math.max(1, page - Math.floor(MAX_PAGES_SHOWN / 2)), pages - MAX_PAGES_SHOWN + 1);
    end = start + MAX_PAGES_SHOWN - 1;
  }

  let html = "";
  if (pages > MAX_PAGES_SHOWN)
    html += `<button data-p="${page - 1}" ${page === 1 ? "disabled" : ""}>&lt;</button>`;
  for (let i = start; i <= end; i++)
    html += `<button data-p="${i}" class="${i === page ? "active" : ""}">${i}</button>`;
  if (pages > MAX_PAGES_SHOWN)
    html += `<button data-p="${page + 1}" ${page === pages ? "disabled" : ""}>&gt;</button>`;

  el.innerHTML = html;
  el.querySelectorAll("button[data-p]").forEach((b) =>
    (b.onclick = () => {
      const p = Number(b.dataset.p);
      if (p >= 1 && p <= pages) { page = p; render(); window.scrollTo({ top: 0, behavior: "smooth" }); }
    })
  );
}

/* ================= MODAL DO JOGO ================= */
function openGame(id) {
  const g = games.find((x) => x.id === id);
  if (!g) return;
  $("#gmCover").src = g.cover || PLACEHOLDER;
  $("#gmTitle").textContent = g.title || "";
  $("#gmTags").innerHTML = [g.platform, g.category, g.code]
    .filter(Boolean)
    .map((t) => `<span>${escapeHtml(t)}</span>`)
    .join("");
  $("#gmDesc").textContent = g.description || "";
  $("#gmPlatform").textContent = g.platform || "-";
  $("#gmCategory").textContent = g.category || "-";
  $("#gmCode").textContent = g.code || "-";
  $("#gmSize").textContent = sizeLabel(g);
  const dl = $("#gmDownload");
  dl.href = g.download || "#";
  dl.removeAttribute("target"); // download direto, mesma aba (archive.org)
  open("#gameModal");
}

/* ================= AUTENTICAÇÃO ================= */
let isAdmin = false;
$("#adminDot").onclick = () => open(isAdmin ? "#adminModal" : "#loginModal");

$("#loginForm").onsubmit = async (e) => {
  e.preventDefault();
  $("#loginError").textContent = "";
  const email = $("#loginEmail").value.trim().toLowerCase();
  if (email !== ADMIN_EMAIL) { $("#loginError").textContent = "Acesso negado."; return; }
  try {
    await signInWithEmailAndPassword(auth, email, $("#loginPass").value);
    $("#loginForm").reset();
    close("#loginModal");
    open("#adminModal");
  } catch {
    $("#loginError").textContent = "E-mail ou senha inválidos.";
  }
};

$("#logoutBtn").onclick = async () => { await signOut(auth); close("#adminModal"); };

onAuthStateChanged(auth, (user) => {
  isAdmin = !!user && (user.email || "").toLowerCase() === ADMIN_EMAIL;
  if (!isAdmin && user) signOut(auth);
  if (!isAdmin) close("#adminModal");
});

/* ================= TABS ADMIN ================= */
$$(".tab").forEach((t) =>
  (t.onclick = () => {
    $$(".tab").forEach((x) => x.classList.remove("active"));
    $$(".panel").forEach((x) => x.classList.remove("active"));
    t.classList.add("active");
    $(`.panel[data-panel="${t.dataset.tab}"]`).classList.add("active");
  })
);

const guard = () => {
  if (!isAdmin) { alert("Apenas o administrador pode alterar dados."); return false; }
  return true;
};

/* ================= CRUD JOGOS ================= */
$("#gameForm").onsubmit = async (e) => {
  e.preventDefault();
  if (!guard()) return;
  let cover = $("#gCoverUrl").value.trim();
  const file = $("#gCoverFile").files[0];
  if (file) {
    if (file.size > 900 * 1024) { alert("Imagem muito grande. Use até ~900 KB."); return; }
    cover = await fileToBase64(file);
  }
  const id = $("#gameId").value;
  const data = {
    title: $("#gTitle").value.trim(),
    platform: $("#gPlatform").value.trim(),
    category: $("#gCategory").value.trim(),
    code: $("#gCode").value.trim(),
    description: $("#gDesc").value.trim(),
    size: Number($("#gSize").value),
    unit: $("#gUnit").value,
    download: $("#gDownload").value.trim(),
    updatedAt: Date.now()
  };
  const existing = games.find((g) => g.id === id);
  data.cover = cover || existing?.cover || "";
  if (id) await update(ref(db, "games/" + id), data);
  else await push(ref(db, "games"), { ...data, createdAt: Date.now() });
  resetGameForm();
};

function resetGameForm() {
  $("#gameForm").reset();
  $("#gameId").value = "";
}
$("#gameReset").onclick = resetGameForm;

function renderAdminGames() {
  $("#adminGames").innerHTML = games
    .slice()
    .sort((a, b) => (a.title || "").localeCompare(b.title || ""))
    .map(
      (g) => `<div class="admin-item">
        <img src="${g.cover || PLACEHOLDER}" alt="" />
        <div class="info"><b>${escapeHtml(g.title || "")}</b>
          <span>${escapeHtml(g.platform || "")} • ${escapeHtml(g.category || "")} • ${escapeHtml(g.code || "")} • ${escapeHtml(sizeLabel(g))}</span></div>
        <button class="mini" data-edit="${g.id}">Editar</button>
        <button class="mini" data-del="${g.id}">Excluir</button>
      </div>`
    )
    .join("");

  $("#adminGames").querySelectorAll("[data-edit]").forEach((b) =>
    (b.onclick = () => {
      const g = games.find((x) => x.id === b.dataset.edit);
      $("#gameId").value = g.id;
      $("#gTitle").value = g.title || "";
      $("#gPlatform").value = g.platform || "";
      $("#gCategory").value = g.category || "";
      $("#gCode").value = g.code || "";
      $("#gDesc").value = g.description || "";
      $("#gSize").value = g.size || "";
      $("#gUnit").value = g.unit || "MB";
      $("#gDownload").value = g.download || "";
      $("#gCoverUrl").value = (g.cover || "").startsWith("data:") ? "" : g.cover || "";
    })
  );
  $("#adminGames").querySelectorAll("[data-del]").forEach((b) =>
    (b.onclick = () => {
      if (guard() && confirm("Excluir este jogo?")) remove(ref(db, "games/" + b.dataset.del));
    })
  );
}

/* ================= CRUD MENU ================= */
$("#menuForm").onsubmit = async (e) => {
  e.preventDefault();
  if (!guard()) return;
  await push(ref(db, "menu"), { label: $("#mLabel").value.trim(), url: $("#mUrl").value.trim() });
  $("#menuForm").reset();
};
function renderAdminMenu() {
  $("#adminMenu").innerHTML = menuItems
    .map(
      (m) => `<div class="admin-item"><div class="info"><b>${escapeHtml(m.label)}</b><span>${escapeHtml(m.url)}</span></div>
      <button class="mini" data-del="${m.id}">Excluir</button></div>`
    )
    .join("");
  $("#adminMenu").querySelectorAll("[data-del]").forEach((b) =>
    (b.onclick = () => guard() && remove(ref(db, "menu/" + b.dataset.del)))
  );
}

/* ================= CRUD RODAPÉ ================= */
$("#linkForm").onsubmit = async (e) => {
  e.preventDefault();
  if (!guard()) return;
  await push(ref(db, "footer/links"), { label: $("#lLabel").value.trim(), url: $("#lUrl").value.trim() });
  $("#linkForm").reset();
};
function renderAdminLinks() {
  $("#adminLinks").innerHTML = footerLinks
    .map(
      (l) => `<div class="admin-item"><div class="info"><b>${escapeHtml(l.label)}</b><span>${escapeHtml(l.url)}</span></div>
      <button class="mini" data-del="${l.id}">Excluir</button></div>`
    )
    .join("");
  $("#adminLinks").querySelectorAll("[data-del]").forEach((b) =>
    (b.onclick = () => guard() && remove(ref(db, "footer/links/" + b.dataset.del)))
  );
}
$("#attrForm").onsubmit = async (e) => {
  e.preventDefault();
  if (!guard()) return;
  await set(ref(db, "footer/attribution"), $("#attrText").value);
  alert("Atribuição salva.");
};

/* ================= AJUDA ================= */
$("#helpForm").onsubmit = async (e) => {
  e.preventDefault();
  if (!guard()) return;
  await set(ref(db, "help"), $("#helpText").value);
  alert("Conteúdo de ajuda salvo.");
};

/* ================= APARÊNCIA ================= */
$("#themeForm").onsubmit = async (e) => {
  e.preventDefault();
  if (!guard()) return;
  const data = {
    siteName: $("#tSiteName").value.trim(),
    accent: $("#tAccent").value,
    bgDark: $("#tBgDark").value,
    bgLight: $("#tBgLight").value,
    radius: Number($("#tRadius").value) || 14
  };
  const sqFile = $("#tLogoSquareFile").files[0];
  const wdFile = $("#tLogoWordFile").files[0];
  data.logoSquare = sqFile ? await fileToBase64(sqFile) : ($("#tLogoSquare").value.trim() || settings.logoSquare || "");
  data.logoWord = wdFile ? await fileToBase64(wdFile) : ($("#tLogoWord").value.trim() || settings.logoWord || "");
  await update(ref(db, "settings"), data);
  alert("Aparência salva.");
};
