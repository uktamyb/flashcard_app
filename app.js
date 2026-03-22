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

/* ─── SRS TIMER ─── */
let cardTimer = null;
let cardStartTime = null;

function startCardTimer() {
  cardStartTime = Date.now();
  clearInterval(cardTimer);

  const timerEl = document.getElementById("cardTimer");
  if (!timerEl) return;

  timerEl.textContent = "0s";
  timerEl.style.color = "var(--timer-color, #10b981)";

  cardTimer = setInterval(() => {
    const elapsed = Math.floor((Date.now() - cardStartTime) / 1000);
    timerEl.textContent = elapsed + "s";
    if (elapsed >= 3) {
      timerEl.style.color = "#ef4444";
    } else {
      timerEl.style.color = "#10b981";
    }
  }, 500);
}

function stopCardTimer() {
  clearInterval(cardTimer);
  const elapsed = cardStartTime ? Math.floor((Date.now() - cardStartTime) / 1000) : 0;
  return elapsed;
}

/* ─── STATUS BADGE ─── */
function getStatusBadge(status) {
  const map = {
    new:      { icon: "🔵", label: "New" },
    learning: { icon: "🟡", label: "Learning" },
    known:    { icon: "🟢", label: "Known" },
    mastered: { icon: "✅", label: "Mastered" },
  };
  return map[status] || map.new;
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

  // review kerak bo'lgan suzlarni avval ko'rsat
  const now = new Date();
  const due = words.filter((w, i) => {
    const next = w.next_review ? new Date(w.next_review) : now;
    return next <= now && i !== currentIndex;
  });

  let newIndex;
  if (due.length > 0) {
    const pick = due[Math.floor(Math.random() * due.length)];
    newIndex = words.indexOf(pick);
  } else {
    do { newIndex = Math.floor(Math.random() * words.length); }
    while (newIndex === currentIndex && words.length > 1);
  }

  currentIndex = newIndex;
  const word = words[currentIndex];

  document.getElementById("card").classList.remove("flip");
  document.getElementById("front").innerText = word.front;
  document.getElementById("back").innerText = word.back;

  // Status badge
  const badge = getStatusBadge(word.status || "new");
  const statusEl = document.getElementById("cardStatus");
  if (statusEl) statusEl.textContent = badge.icon + " " + badge.label;

  // Word count + stats
  const countEl = document.getElementById("wordCount");
  if (countEl) {
    const mastered = words.filter(w => w.status === "mastered").length;
    const known    = words.filter(w => w.status === "known").length;
    const learning = words.filter(w => w.status === "learning").length;
    countEl.innerHTML = `📚 ${words.length} | ✅ ${mastered} &nbsp; 🟢 ${known} &nbsp; 🟡 ${learning}`;
  }

  startCardTimer();
}

/* ─── FLIP ─── */
function flip() { document.getElementById("card").classList.toggle("flip"); }
document.getElementById("card").onclick = flip;
document.addEventListener("keydown", (e) => { if (e.code === "Space") flip(); });

/* ─── SRS HISOBLASH ─── */
function calcSRS(word, rating, timeSpent) {
  let { ease_factor = 2.5, interval_days = 1, correct_streak = 0,
        total_reviews = 0, correct_reviews = 0 } = word;

  total_reviews += 1;

  // 3 soniyadan oshsa yoki Again bossa — bilmagan
  const failed = rating === 0 || timeSpent > 3;

  let status = word.status || "new";

  if (failed) {
    correct_streak = 0;
    interval_days  = 1;
    ease_factor    = Math.max(1.3, ease_factor - 0.2);
    status = correct_streak === 0 ? "new" : "learning";
  } else {
    correct_reviews += 1;
    correct_streak  += 1;

    if (rating === 1) { // Hard
      interval_days = Math.max(1, Math.round(interval_days * 1.2));
      ease_factor   = Math.max(1.3, ease_factor - 0.15);
    } else if (rating === 2) { // Good
      interval_days = Math.round(interval_days * ease_factor);
    } else if (rating === 3) { // Easy
      interval_days = Math.round(interval_days * ease_factor * 1.3);
      ease_factor   = ease_factor + 0.1;
    }

    if (correct_streak >= 5) status = "mastered";
    else if (correct_streak >= 3) status = "known";
    else status = "learning";
  }

  const next_review = new Date(Date.now() + interval_days * 86400000).toISOString();

  return { ease_factor, interval_days, correct_streak, total_reviews, correct_reviews, status, next_review };
}

/* ─── MARK ─── */
async function mark(rating) {
  if (words.length === 0) return;

  const timeSpent = stopCardTimer();
  const word = words[currentIndex];
  const updates = calcSRS(word, rating, timeSpent);

  await supabase.from("words")
    .update({ ...updates, last_seen: new Date().toISOString() })
    .eq("id", word.id);

  Object.assign(words[currentIndex], updates);
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