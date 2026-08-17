/* =====================================================================
   GameVault — app.js
   ---------------------------------------------------------------------
   1) TROQUE AS CREDENCIAIS ABAIXO pelas do seu projeto Firebase.
   2) No Firebase Console > Authentication > ative "E-mail/senha" e crie
      MANUALMENTE o usuário admin@admin.com (não há cadastro público).
   3) Realtime Database > Regras sugeridas:

   {
     "rules": {
       "games":    { ".read": true,
                     ".write": "auth != null && auth.token.email === 'admin@admin.com'" },
       "settings": { ".read": true,
                     ".write": "auth != null && auth.token.email === 'admin@admin.com'" }
     }
   }
   ===================================================================== */

const firebaseConfig = {
  apiKey: "SUA_API_KEY",
  authDomain: "SEU_PROJETO.firebaseapp.com",
  databaseURL: "https://SEU_PROJETO-default-rtdb.firebaseio.com",
  projectId: "SEU_PROJETO",
  storageBucket: "SEU_PROJETO.appspot.com",
  messagingSenderId: "000000000000",
  appId: "1:000000000000:web:xxxxxxxxxxxxxxxx",
};

const ADMIN_EMAIL = "admin@admin.com";
const PUBLIC_PER_PAGE = 12;

/* ================= ESTADO ================= */
const state = {
  games: [],          // [{id, ...}]
  settings: {},
  isAdmin: false,
  pubPage: 1,
  admPage: 1,
  admPerPage: 10,
  admQuery: "",
  step: 1,
};

/* ================= HELPERS ================= */
const $ = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));
const esc = (v) =>
  String(v ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );

let toastTimer;
function toast(msg) {
  const t = $("#toast");
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (t.hidden = true), 2600);
}

function openModal(id) { $(id).hidden = false; document.body.style.overflow = "hidden"; }
function closeModal(el) { el.hidden = true; document.body.style.overflow = ""; }

$$(".modal-backdrop").forEach((bd) => {
  bd.addEventListener("click", (e) => { if (e.target === bd) closeModal(bd); });
  bd.querySelectorAll("[data-close]").forEach((b) =>
    b.addEventListener("click", () => closeModal(bd))
  );
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") $$(".modal-backdrop").forEach((b) => { if (!b.hidden) closeModal(b); });
});

/* ================= TEMA ================= */
const savedTheme = localStorage.getItem("gv-theme") || "dark";
document.documentElement.dataset.theme = savedTheme;
$("#themeBtn").addEventListener("click", () => {
  const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  document.documentElement.dataset.theme = next;
  localStorage.setItem("gv-theme", next);
});

$("#year").textContent = new Date().getFullYear();

/* ================= FIREBASE ================= */
let db = null, auth = null, firebaseReady = false;
try {
  firebase.initializeApp(firebaseConfig);
  db = firebase.database();
  auth = firebase.auth();
  firebaseReady = true;
} catch (err) {
  console.warn("Firebase não inicializado — verifique as credenciais no topo de app.js.", err);
}

/* =====================================================================
   RENDER PÚBLICO — sempre renderiza o corpo do site, mesmo sem login
   e mesmo sem jogos cadastrados.
   ===================================================================== */
function visibleGames() {
  const q = ($("#searchInput").value || "").trim().toLowerCase();
  const cat = $("#categoryFilter").value;
  return state.games
    .filter((g) => g.published !== false)
    .filter((g) => (cat ? (g.category || "") === cat : true))
    .filter((g) =>
      !q ||
      (g.title || "").toLowerCase().includes(q) ||
      (g.category || "").toLowerCase().includes(q) ||
      (g.tags || []).join(" ").toLowerCase().includes(q)
    )
    .sort((a, b) => (a.title || "").localeCompare(b.title || ""));
}

function renderCategories() {
  const cats = [...new Set(state.games.map((g) => g.category).filter(Boolean))].sort();
  const sel = $("#categoryFilter");
  const cur = sel.value;
  sel.innerHTML =
    '<option value="">Todas as categorias</option>' +
    cats.map((c) => `<option value="${esc(c)}">${esc(c)}</option>`).join("");
  if (cats.includes(cur)) sel.value = cur;
  $("#catList").innerHTML = cats.map((c) => `<option value="${esc(c)}">`).join("");
}

function renderGames() {
  const list = visibleGames();
  const pages = Math.max(1, Math.ceil(list.length / PUBLIC_PER_PAGE));
  if (state.pubPage > pages) state.pubPage = pages;
  const slice = list.slice((state.pubPage - 1) * PUBLIC_PER_PAGE, state.pubPage * PUBLIC_PER_PAGE);

  $("#gamesGrid").innerHTML = slice
    .map(
      (g) => `
    <button class="card" data-id="${esc(g.id)}">
      <div class="card-cover">
        ${g.cover ? `<img src="${esc(g.cover)}" alt="${esc(g.title)}" loading="lazy" />` : ""}
        ${g.category ? `<span class="card-badge">${esc(g.category)}</span>` : ""}
        ${g.rating ? `<span class="card-rating">${esc(g.rating)}</span>` : ""}
      </div>
      <div class="card-info">
        <p class="card-title">${esc(g.title)}</p>
        <span class="card-sub">${[g.year, g.platform, g.size].filter(Boolean).map(esc).join(" · ") || "Detalhes"}</span>
      </div>
    </button>`
    )
    .join("");

  $$("#gamesGrid .card").forEach((c) =>
    c.addEventListener("click", () => openGame(c.dataset.id))
  );

  $("#emptyState").classList.toggle("hidden", list.length > 0);
  $("#publicPager").classList.toggle("hidden", pages <= 1);
  $("[data-pub-info]").textContent = `Página ${state.pubPage} de ${pages}`;
  $("[data-pub-prev]").disabled = state.pubPage <= 1;
  $("[data-pub-next]").disabled = state.pubPage >= pages;
}

$("[data-pub-prev]").addEventListener("click", () => { state.pubPage--; renderGames(); window.scrollTo({ top: 0, behavior: "smooth" }); });
$("[data-pub-next]").addEventListener("click", () => { state.pubPage++; renderGames(); window.scrollTo({ top: 0, behavior: "smooth" }); });
$("#searchInput").addEventListener("input", () => { state.pubPage = 1; renderGames(); });
$("#categoryFilter").addEventListener("change", () => { state.pubPage = 1; renderGames(); });

/* ================= MODAL DO JOGO ================= */
function openGame(id) {
  const g = state.games.find((x) => x.id === id);
  if (!g) return;
  const cover = $("#gmCover");
  if (g.cover) { cover.src = g.cover; cover.alt = g.title || ""; cover.parentElement.hidden = false; }
  else cover.parentElement.hidden = true;

  $("#gmTitle").textContent = g.title || "Sem título";
  $("#gmMeta").textContent = [g.category, g.year, g.platform].filter(Boolean).join(" · ");
  $("#gmTags").innerHTML = (g.tags || []).map((t) => `<span class="tag">${esc(t)}</span>`).join("");
  $("#gmDesc").textContent = g.description || "";

  const specs = [
    ["Tamanho", g.size],
    ["Nota", g.rating],
    ["Requisitos", g.requirements],
  ].filter(([, v]) => v);
  $("#gmSpecs").innerHTML = specs.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join("");

  const dl = $("#gmDownload");
  if (g.download) { dl.href = g.download; dl.classList.remove("hidden"); }
  else dl.classList.add("hidden");

  openModal("#gameModal");
}

/* ================= IDENTIDADE + AJUDA ================= */
function renderSettings() {
  const s = state.settings || {};
  const sq = $("#logoSquare"), wd = $("#logoWord"), fb = $("#brandFallback");
  if (s.logoSquare) { sq.src = s.logoSquare; sq.hidden = false; } else sq.hidden = true;
  if (s.logoWord) { wd.src = s.logoWord; wd.hidden = false; } else wd.hidden = true;
  fb.textContent = s.siteName || "GameVault";
  fb.hidden = !!s.logoWord;

  $("#heroTitle").textContent = s.heroTitle || "Sua biblioteca de jogos";
  $("#heroSubtitle").textContent = s.heroSubtitle || "Clique em um jogo para ver detalhes e baixar.";
  $("#footerText").innerHTML = `© ${new Date().getFullYear()} ${esc(s.siteName || "GameVault")}`;
  document.title = (s.siteName || "GameVault") + " — Biblioteca de Jogos";

  const help = s.help || "Navegue pelos jogos na página inicial.\nClique em um card para ver as informações completas.\nUse o botão de download dentro da janela do jogo.";
  $("#helpContent").innerHTML = help.split("\n").filter(Boolean).map((p) => `<p>${esc(p)}</p>`).join("");

  // preencher formulários do admin
  $("#bLogoSquare").value = s.logoSquare || "";
  $("#bLogoWord").value = s.logoWord || "";
  $("#bSiteName").value = s.siteName || "";
  $("#bHeroTitle").value = s.heroTitle || "";
  $("#bHeroSubtitle").value = s.heroSubtitle || "";
  $("#hContent").value = s.help || "";
}

$("#helpBtn").addEventListener("click", () => openModal("#helpModal"));

/* ================= AUTH ================= */
$("#discreetLoginBtn").addEventListener("click", () => {
  if (state.isAdmin) openModal("#adminModal");
  else openModal("#loginModal");
});
$("#adminPanelBtn").addEventListener("click", () => openModal("#adminModal"));

$("#loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const err = $("#loginError");
  err.classList.add("hidden");
  if (!firebaseReady) { err.textContent = "Firebase não configurado. Preencha as credenciais em app.js."; err.classList.remove("hidden"); return; }
  const email = $("#loginEmail").value.trim().toLowerCase();
  if (email !== ADMIN_EMAIL) { err.textContent = "Acesso permitido somente ao administrador."; err.classList.remove("hidden"); return; }
  try {
    await auth.signInWithEmailAndPassword(email, $("#loginPass").value);
    closeModal($("#loginModal"));
    $("#loginForm").reset();
    toast("Bem-vindo, admin!");
    openModal("#adminModal");
  } catch (ex) {
    err.textContent = "E-mail ou senha inválidos.";
    err.classList.remove("hidden");
  }
});

$("#logoutBtn").addEventListener("click", async () => {
  if (auth) await auth.signOut();
  toast("Sessão encerrada.");
});

function applyAdminUI() {
  $("#adminPanelBtn").classList.toggle("hidden", !state.isAdmin);
  $("#logoutBtn").classList.toggle("hidden", !state.isAdmin);
  if (!state.isAdmin) closeModal($("#adminModal"));
}

if (firebaseReady) {
  auth.onAuthStateChanged((user) => {
    state.isAdmin = !!user && (user.email || "").toLowerCase() === ADMIN_EMAIL;
    applyAdminUI();
    renderAdminList();
  });
}

/* ================= TABS DO PAINEL ================= */
$$(".tab").forEach((t) =>
  t.addEventListener("click", () => {
    $$(".tab").forEach((x) => x.classList.remove("active"));
    $$(".tabpanel").forEach((x) => x.classList.remove("active"));
    t.classList.add("active");
    $("#" + t.dataset.tab).classList.add("active");
  })
);

/* ================= CADASTRO PAGINADO (3 ETAPAS) ================= */
const TOTAL_STEPS = 3;
function showStep(n) {
  state.step = Math.min(TOTAL_STEPS, Math.max(1, n));
  $$(".form-step").forEach((f) => f.classList.toggle("active", +f.dataset.step === state.step));
  $$("#formSteps .step").forEach((s) => s.classList.toggle("active", +s.dataset.step === state.step));
  $("#stepPrev").disabled = state.step === 1;
  $("#stepNext").classList.toggle("hidden", state.step === TOTAL_STEPS);
  $("#formSave").classList.toggle("hidden", state.step !== TOTAL_STEPS);
}
$("#stepPrev").addEventListener("click", () => showStep(state.step - 1));
$("#stepNext").addEventListener("click", () => {
  if (state.step === 1 && !$("#fTitle").value.trim()) { formError("Informe o título do jogo."); return; }
  formError("");
  showStep(state.step + 1);
});
$$("#formSteps .step").forEach((s) => s.addEventListener("click", () => showStep(+s.dataset.step)));

function formError(msg) {
  const el = $("#formError");
  el.textContent = msg;
  el.classList.toggle("hidden", !msg);
}

function resetForm() {
  $("#gameForm").reset();
  $("#gameId").value = "";
  $("#fPublished").checked = true;
  formError("");
  showStep(1);
}
$("#formReset").addEventListener("click", resetForm);

function collectForm() {
  return {
    title: $("#fTitle").value.trim(),
    category: $("#fCategory").value.trim(),
    cover: $("#fCover").value.trim(),
    description: $("#fDesc").value.trim(),
    year: $("#fYear").value ? Number($("#fYear").value) : null,
    size: $("#fSize").value.trim(),
    platform: $("#fPlatform").value.trim(),
    rating: $("#fRating").value ? Number($("#fRating").value) : null,
    tags: $("#fTags").value.split(",").map((t) => t.trim()).filter(Boolean),
    download: $("#fDownload").value.trim(),
    requirements: $("#fReq").value.trim(),
    published: $("#fPublished").checked,
    updatedAt: Date.now(),
  };
}

function fillForm(g) {
  $("#gameId").value = g.id;
  $("#fTitle").value = g.title || "";
  $("#fCategory").value = g.category || "";
  $("#fCover").value = g.cover || "";
  $("#fDesc").value = g.description || "";
  $("#fYear").value = g.year || "";
  $("#fSize").value = g.size || "";
  $("#fPlatform").value = g.platform || "";
  $("#fRating").value = g.rating ?? "";
  $("#fTags").value = (g.tags || []).join(", ");
  $("#fDownload").value = g.download || "";
  $("#fReq").value = g.requirements || "";
  $("#fPublished").checked = g.published !== false;
  formError("");
  showStep(1);
  $$(".tab").forEach((x) => x.classList.remove("active"));
  $$(".tabpanel").forEach((x) => x.classList.remove("active"));
  $('.tab[data-tab="tab-new"]').classList.add("active");
  $("#tab-new").classList.add("active");
}

$("#gameForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!state.isAdmin) { formError("Somente o administrador pode salvar."); return; }
  const data = collectForm();
  if (!data.title) { formError("Título é obrigatório."); showStep(1); return; }
  if (!data.download) { formError("Link de download é obrigatório."); showStep(3); return; }
  try {
    const id = $("#gameId").value;
    if (id) await db.ref("games/" + id).update(data);
    else await db.ref("games").push({ ...data, createdAt: Date.now() });
    toast(id ? "Jogo atualizado!" : "Jogo cadastrado!");
    resetForm();
  } catch (ex) {
    formError("Erro ao salvar: " + ex.message);
  }
});

/* ================= LISTA ADMIN COM PAGINAÇÃO ================= */
$("#adminSearch").addEventListener("input", (e) => { state.admQuery = e.target.value.toLowerCase(); state.admPage = 1; renderAdminList(); });
$("#adminPerPage").addEventListener("change", (e) => { state.admPerPage = +e.target.value; state.admPage = 1; renderAdminList(); });
$("[data-adm-prev]").addEventListener("click", () => { state.admPage--; renderAdminList(); });
$("[data-adm-next]").addEventListener("click", () => { state.admPage++; renderAdminList(); });

function renderAdminList() {
  const list = state.games
    .filter((g) => !state.admQuery || (g.title || "").toLowerCase().includes(state.admQuery))
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  const per = state.admPerPage;
  const pages = Math.max(1, Math.ceil(list.length / per));
  if (state.admPage > pages) state.admPage = pages;
  const slice = list.slice((state.admPage - 1) * per, state.admPage * per);

  $("#adminList").innerHTML = slice.length
    ? slice
        .map(
          (g) => `
      <div class="admin-item">
        <img src="${esc(g.cover || "")}" alt="" />
        <div class="ai-main">
          <div class="ai-title">${esc(g.title || "Sem título")}</div>
          <div class="ai-sub"><span class="dot ${g.published !== false ? "on" : ""}"></span>${esc(g.category || "sem categoria")}${g.year ? " · " + esc(g.year) : ""}</div>
        </div>
        <button class="btn btn-ghost" data-edit="${esc(g.id)}">Editar</button>
        <button class="btn btn-danger" data-del="${esc(g.id)}">Excluir</button>
      </div>`
        )
        .join("")
    : `<p class="muted small">Nenhum jogo cadastrado ainda.</p>`;

  $$("#adminList [data-edit]").forEach((b) =>
    b.addEventListener("click", () => {
      const g = state.games.find((x) => x.id === b.dataset.edit);
      if (g) fillForm(g);
    })
  );
  $$("#adminList [data-del]").forEach((b) =>
    b.addEventListener("click", async () => {
      if (!confirm("Excluir este jogo definitivamente?")) return;
      await db.ref("games/" + b.dataset.del).remove();
      toast("Jogo excluído.");
    })
  );

  $("[data-adm-info]").textContent = `Página ${state.admPage} de ${pages} · ${list.length} jogo(s)`;
  $("[data-adm-prev]").disabled = state.admPage <= 1;
  $("[data-adm-next]").disabled = state.admPage >= pages;
}

/* ================= IDENTIDADE / AJUDA (salvar) ================= */
$("#brandForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!state.isAdmin) return toast("Somente admin.");
  await db.ref("settings").update({
    logoSquare: $("#bLogoSquare").value.trim(),
    logoWord: $("#bLogoWord").value.trim(),
    siteName: $("#bSiteName").value.trim(),
    heroTitle: $("#bHeroTitle").value.trim(),
    heroSubtitle: $("#bHeroSubtitle").value.trim(),
  });
  toast("Identidade salva!");
});

$("#helpForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!state.isAdmin) return toast("Somente admin.");
  await db.ref("settings").update({ help: $("#hContent").value });
  toast("Ajuda salva!");
});

/* ================= BACKUP: EXPORTAR / IMPORTAR JSON ================= */
function log(msg) { $("#backupLog").textContent = msg; }

$("#exportBtn").addEventListener("click", () => {
  const payload = {
    _meta: { app: "GameVault", version: 1, exportedAt: new Date().toISOString() },
    settings: state.settings || {},
    games: state.games.reduce((acc, g) => {
      const { id, ...rest } = g;
      acc[id] = rest;
      return acc;
    }, {}),
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `gamevault-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
  log(`Exportado: ${state.games.length} jogo(s) + identidade/ajuda.`);
});

$("#importFile").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  if (!state.isAdmin) { log("Somente o administrador pode importar."); e.target.value = ""; return; }
  try {
    const data = JSON.parse(await file.text());
    const games = data.games || {};
    const gameList = Array.isArray(games)
      ? games
      : Object.entries(games).map(([id, g]) => ({ id, ...g }));
    if (!gameList.length && !data.settings) throw new Error("Arquivo sem dados reconhecíveis.");

    const mode = $("#importMode").value;
    if (mode === "replace" && !confirm("Substituir TODOS os dados atuais? Esta ação não pode ser desfeita.")) {
      e.target.value = "";
      return;
    }

    if (mode === "replace") {
      const map = {};
      gameList.forEach((g, i) => {
        const { id, ...rest } = g;
        map[id || `imp_${Date.now()}_${i}`] = rest;
      });
      await db.ref("games").set(map);
      if (data.settings) await db.ref("settings").set(data.settings);
    } else {
      for (const g of gameList) {
        const { id, ...rest } = g;
        if (id) await db.ref("games/" + id).update(rest);
        else await db.ref("games").push({ ...rest, createdAt: Date.now() });
      }
      if (data.settings) await db.ref("settings").update(data.settings);
    }
    log(`Importação concluída (${mode === "replace" ? "substituição" : "mesclagem"}): ${gameList.length} jogo(s).`);
    toast("Backup importado!");
  } catch (ex) {
    log("Erro na importação: " + ex.message);
  } finally {
    e.target.value = "";
  }
});

/* =====================================================================
   BOOT — o corpo do site é renderizado imediatamente, sem login
   ===================================================================== */
renderSettings();
renderCategories();
renderGames();
showStep(1);
renderAdminList();

if (firebaseReady) {
  db.ref("games").on("value", (snap) => {
    const val = snap.val() || {};
    state.games = Object.entries(val).map(([id, g]) => ({ id, ...g }));
    renderCategories();
    renderGames();
    renderAdminList();
  }, (err) => console.warn("Leitura de games falhou:", err.message));

  db.ref("settings").on("value", (snap) => {
    state.settings = snap.val() || {};
    renderSettings();
  }, (err) => console.warn("Leitura de settings falhou:", err.message));
}
