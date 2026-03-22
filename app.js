import { supabase, getUser, signUp, signIn, signOut, onAuthChange } from "./auth.js";
import { t, setLang, applyTranslations, currentLang } from "./i18n.js";

/* ─── THEME ─── */
(function () {
  const saved = localStorage.getItem("theme");
  if (saved) document.body.className = saved;
})();

/* ─── TIL ─── */
window.changeLanguage = function(lang) {
  setLang(lang);
};

document.addEventListener("DOMContentLoaded", () => {
  const sel = document.getElementById("langSelect");
  if (sel) sel.value = currentLang;
  applyTranslations();

  const wordInput = document.getElementById("word");
  if (wordInput) {
    wordInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); translateWord(); }
    });
  }

  const meaningInput = document.getElementById("meaning");
  if (meaningInput) {
    meaningInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); addWord(); }
    });
  }

  updateTranslatePlaceholders();
});

let words = [];
let currentIndex = 0;
let currentDeckId = null;
let currentUser = null;

/* ─── AUTH HOLATI ─── */
onAuthChange(async (user) => {
  currentUser = user;
  if (user) {
    document.getElementById("landing").style.display = "none";
    hideAuth();
    await showHome();
  } else {
    document.getElementById("landing").style.display = "block";
    document.getElementById("home").style.display = "none";
    document.getElementById("app").style.display = "none";
  }
});

/* ─── AUTH UI ─── */
function showAuth(type) {
  document.getElementById("authModal").classList.remove("hidden");
  document.getElementById("authSignup").classList.toggle("hidden", type !== "signup");
  document.getElementById("authSignin").classList.toggle("hidden", type !== "signin");
  document.getElementById("authError").classList.add("hidden");
}

function hideAuth() {
  document.getElementById("authModal").classList.add("hidden");
}

async function handleSignUp() {
  const email = document.getElementById("signupEmail").value.trim();
  const password = document.getElementById("signupPassword").value;
  const errEl = document.getElementById("authError");
  if (!email || !password) return;
  try {
    await signUp(email, password);
    errEl.classList.add("hidden");
    showSuccess(t("emailSent"));
  } catch (e) {
    errEl.textContent = e.message;
    errEl.classList.remove("hidden");
  }
}

async function handleSignIn() {
  const email = document.getElementById("signinEmail").value.trim();
  const password = document.getElementById("signinPassword").value;
  const errEl = document.getElementById("authError");
  if (!email || !password) return;
  try {
    await signIn(email, password);
    errEl.classList.add("hidden");
  } catch (e) {
    errEl.textContent = t("wrongCredentials");
    errEl.classList.remove("hidden");
  }
}

async function handleSignOut() {
  await signOut();
}

/* ─── HOME ─── */
async function showHome() {
  document.getElementById("home").style.display = "flex";
  document.getElementById("app").style.display = "none";
  document.getElementById("landing").style.display = "none";
  const user = await getUser();
  if (user) document.getElementById("userEmail").textContent = user.email;
  applyTranslations();
  await renderDecks();
  await loadAIInsight();
}

function goHome() {
  document.getElementById("home").style.display = "flex";
  document.getElementById("app").style.display = "none";
  renderDecks();
}

/* ─── AI INSIGHT ─── */
async function loadAIInsight() {
  if (!currentUser) return;
  const { data: allWords } = await supabase
    .from("words").select("level").eq("user_id", currentUser.id).limit(100);

  if (!allWords || allWords.length < 3) return;

  const hard = allWords.filter(w => w.level <= 1).length;
  const total = allWords.length;
  let insight = "";

  if (hard > total * 0.5) insight = t("aiHard", hard);
  else if (total > 20) insight = t("aiGood", total);
  else insight = t("aiStart");

  document.getElementById("aiInsightText").textContent = insight;
  document.getElementById("aiInsight").classList.remove("hidden");
}

/* ─── DECK LIST ─── */
async function renderDecks() {
  const container = document.getElementById("deckList");
  container.innerHTML = "<p style='opacity:0.4;font-size:13px'>...</p>";

  const { data: decks } = await supabase
    .from("decks").select("*, words(count)")
    .eq("user_id", currentUser.id).order("created_at", { ascending: true });

  container.innerHTML = "";

  if (!decks || decks.length === 0) {
    container.innerHTML = `<p style='opacity:0.4;font-size:13px;text-align:center;padding:20px 0'>${t("createDeck")}</p>`;
    return;
  }

  decks.forEach((deck) => {
    const count = deck.words[0]?.count || 0;
    const wrapper = document.createElement("div");
    wrapper.className = "deck-wrapper";

    const btn = document.createElement("button");
    btn.className = "deck-btn";
    btn.innerHTML = `${getIcon(deck.name)} ${deck.name} <span class="count">${count}</span>`;
    btn.onclick = () => loadDeck(deck.id);

    const del = document.createElement("button");
    del.className = "delete-btn";
    del.innerText = "❌";
    del.onclick = (e) => { e.stopPropagation(); deleteDeck(deck.id); };

    wrapper.appendChild(btn);
    wrapper.appendChild(del);
    container.appendChild(wrapper);
  });
}

/* ─── DECK YUKLA ─── */
async function loadDeck(deckId) {
  currentDeckId = deckId;
  const { data } = await supabase.from("words").select("*").eq("deck_id", deckId);
  words = data || [];
  document.getElementById("home").style.display = "none";
  document.getElementById("app").style.display = "flex";
  applyTranslations();
  nextCard();
}

/* ─── NEXT CARD ─── */
function nextCard() {
  if (words.length === 0) {
    document.getElementById("front").innerText = t("noWords");
    document.getElementById("back").innerText = "";
    const countEl = document.getElementById("wordCount");
    if (countEl) countEl.innerText = t("wordsCount", 0);
    return;
  }

  let newIndex;
  do { newIndex = Math.floor(Math.random() * words.length); }
  while (newIndex === currentIndex && words.length > 1);

  currentIndex = newIndex;
  document.getElementById("card").classList.remove("flip");
  document.getElementById("front").innerText = words[currentIndex].front;
  document.getElementById("back").innerText = words[currentIndex].back;

  const countEl = document.getElementById("wordCount");
  if (countEl) countEl.innerText = t("wordsCount", words.length);
}

/* ─── FLIP ─── */
function flip() { document.getElementById("card").classList.toggle("flip"); }
document.getElementById("card").onclick = flip;
document.addEventListener("keydown", (e) => { if (e.code === "Space") flip(); });

/* ─── MARK ─── */
async function mark(level) {
  if (words.length === 0) return;
  const word = words[currentIndex];
  await supabase.from("words")
    .update({ level, last_seen: new Date().toISOString() }).eq("id", word.id);
  words[currentIndex].level = level;
  nextCard();
}


/* ─── TIL NOMLARI ─── */
const langNames = {
  en: "English", uz: "Uzbek", ru: "Russian", tr: "Turkish",
  de: "German", fr: "French", es: "Spanish", it: "Italian",
  pt: "Portuguese", ar: "Arabic", zh: "Chinese", ja: "Japanese",
  ko: "Korean", hi: "Hindi", fa: "Persian", pl: "Polish",
  nl: "Dutch", sv: "Swedish", uk: "Ukrainian", kk: "Kazakh",
  az: "Azerbaijani", id: "Indonesian", el: "Greek"
};

/* ─── TIL PLACEHOLDER ─── */
function updateTranslatePlaceholders() {
  const from = document.getElementById("fromLang")?.value || "en";
  const to   = document.getElementById("toLang")?.value   || "uz";
  const wordInput    = document.getElementById("word");
  const meaningInput = document.getElementById("meaning");
  if (wordInput)    wordInput.placeholder    = langNames[from] || from;
  if (meaningInput) meaningInput.placeholder = langNames[to]   || to;
}

function swapLangs() {
  const fromEl    = document.getElementById("fromLang");
  const toEl      = document.getElementById("toLang");
  const wordEl    = document.getElementById("word");
  const meaningEl = document.getElementById("meaning");
  if (!fromEl || !toEl) return;

  const tmp = fromEl.value;
  fromEl.value = toEl.value;
  toEl.value   = tmp;

  const tmpText    = wordEl.value;
  wordEl.value    = meaningEl.value;
  meaningEl.value = tmpText;

  updateTranslatePlaceholders();
}

/* ─── TARJIMA (MyMemory API) ─── */
async function translateWord() {
  const word = document.getElementById("word").value.trim();
  if (!word) return;

  const from = document.getElementById("fromLang")?.value || "en";
  const to   = document.getElementById("toLang")?.value   || "uz";

  const meaningInput = document.getElementById("meaning");
  meaningInput.value = "...";
  meaningInput.readOnly = true;

  try {
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(word)}&langpair=${from}|${to}`;
    const res  = await fetch(url);
    const data = await res.json();
    const translated = data.responseData?.translatedText || "";

    if (translated && translated.toUpperCase() !== word.toUpperCase() && !translated.toLowerCase().includes("mymemory")) {
      meaningInput.value = translated;
    } else {
      meaningInput.value = "";
      meaningInput.placeholder = "Not found — type manually";
    }
  } catch (e) {
    meaningInput.value = "";
  }

  meaningInput.readOnly = false;
  meaningInput.focus();
}

/* ─── SO'Z QO'SH ─── */
async function addWord() {
  const front = document.getElementById("word").value.trim();
  const back  = document.getElementById("meaning").value.trim();
  if (!front || !back) { alert(t("fillBoth")); return; }

  const { data, error } = await supabase.from("words")
    .insert([{ deck_id: currentDeckId, user_id: currentUser.id, front, back, level: 1 }])
    .select().single();

  if (error) { alert(error.message); return; }

  words.push(data);
  document.getElementById("word").value    = "";
  document.getElementById("meaning").value = "";
  document.getElementById("word").focus();

  showSuccess(t("addedWord", front));

  const countEl = document.getElementById("wordCount");
  if (countEl) countEl.innerText = t("wordsCount", words.length);
}

/* ─── DECK YARAT / O'CHIR ─── */
function createDeck() { openModal(); }

async function saveDeck() {
  const name = document.getElementById("deckName").value.trim();
  if (!name) return;
  const { error } = await supabase.from("decks").insert([{ name, user_id: currentUser.id }]);
  if (error) { alert(error.message); return; }
  document.getElementById("deckName").value = "";
  closeModal();
  renderDecks();
  showSuccess(t("deckCreated", name));
}

async function deleteDeck(deckId) {
  if (!confirm(t("confirmDelete"))) return;
  await supabase.from("words").delete().eq("deck_id", deckId);
  await supabase.from("decks").delete().eq("id", deckId);
  renderDecks();
}

/* ─── MODAL ─── */
function openModal() { document.getElementById("modal").classList.remove("hidden"); }
function closeModal() { document.getElementById("modal").classList.add("hidden"); }

/* ─── TOAST ─── */
function showSuccess(msg) {
  const toast = document.getElementById("successToast");
  document.getElementById("successText").innerText = msg;
  toast.classList.remove("hidden");
  requestAnimationFrame(() => toast.classList.add("show"));
  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => toast.classList.add("hidden"), 300);
  }, 2000);
}

/* ─── ICON ─── */
function getIcon(name) {
  name = name.toLowerCase();
  if (name.includes("movie") || name.includes("kino") || name.includes("game") || name.includes("thrones") || name.includes("breaking")) return "🎬";
  if (name.includes("book") || name.includes("kitob")) return "📚";
  if (name.includes("listen") || name.includes("podcast")) return "🎧";
  const icons = ["📁", "🧠", "📖", "🔥"];
  return icons[Math.floor(Math.random() * icons.length)];
}

/* ─── THEME ─── */
function toggleTheme() {
  const body = document.body;
  const icon = document.getElementById("themeIcon");
  if (body.classList.contains("dark")) {
    body.classList.replace("dark", "light");
    icon.innerHTML = `<circle cx="12" cy="12" r="5"/>`;
  } else {
    body.classList.replace("light", "dark");
    icon.innerHTML = `<path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/>`;
  }
  localStorage.setItem("theme", body.className);
}

/* ─── GLOBAL ─── */
window.showAuth = showAuth;
window.hideAuth = hideAuth;
window.handleSignUp = handleSignUp;
window.handleSignIn = handleSignIn;
window.handleSignOut = handleSignOut;
window.toggleTheme = toggleTheme;
window.createDeck = createDeck;
window.saveDeck = saveDeck;
window.goHome = goHome;
window.addWord = addWord;
window.mark = mark;
window.openModal = openModal;
window.closeModal = closeModal;
window.swapLangs = swapLangs;
window.updateTranslatePlaceholders = updateTranslatePlaceholders;