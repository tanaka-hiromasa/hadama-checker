// 端玉チェッカー Ver1.0
const $ = id => document.getElementById(id);
const shopKey = "shops";
const sessionKey = "sessions-v030";
const rateDraftKey = "rate-drafts-v040";
let shops = (JSON.parse(localStorage.getItem(shopKey)) || []).map((shop, index) => ({
  ...shop,
  id: shop.id ?? `legacy-${index}`,
  pachiPer100: Number(shop.pachiPer100) || 100 / Number(shop.pachiValue),
  slotPer100: Number(shop.slotPer100) || 100 / Number(shop.slotValue)
}));
let sessions = JSON.parse(localStorage.getItem(sessionKey) || localStorage.getItem("sessions") || "[]");
let calcType = "pachi";
let rateType = "pachi";
let sessionType = "pachi";
const drafts = { pachi: { start: "", used: "", end: "" }, slot: { start: "", used: "", end: "" } };
const calcDrafts = { pachi: { balls: "", investment: "", desired: "" }, slot: { balls: "", investment: "", desired: "" } };
const rateDrafts = JSON.parse(localStorage.getItem(rateDraftKey) || "null") || { pachi: { total: "", cash: "", remainder: "" }, slot: { total: "", cash: "", remainder: "" } };

const unitName = type => type === "pachi" ? "玉" : "枚";
const number = id => Math.max(0, Number($(id).value.replace(/,/g, "")) || 0);
const yen = amount => `${Math.round(amount).toLocaleString()}円`;
const signedYen = amount => `${amount >= 0 ? "+" : "−"}${Math.abs(Math.round(amount)).toLocaleString()}円`;
const compactNumber = amount => Number(amount.toFixed(4)).toLocaleString("ja-JP", { maximumFractionDigits: 4 });
const round500 = amount => Math.round(amount / 500) * 500;
const escapeHtml = value => { const d = document.createElement("div"); d.textContent = value; return d.innerHTML; };
function formatNumericInput(input) {
  let raw = input.value.replace(/,/g, "").replace(/[^0-9.]/g, "");
  if (raw === "") { input.value = ""; return; }
  const decimal = input.inputMode === "decimal";
  if (!decimal) raw = raw.replace(/\./g, "");
  if (decimal) { const parts = raw.split("."); raw = `${parts.shift() || "0"}${parts.length ? `.${parts.join("")}` : ""}`; }
  const [whole, fraction] = raw.split(".");
  const formattedWhole = whole === "" ? "" : Number(whole).toLocaleString();
  input.value = fraction === undefined ? formattedWhole : `${formattedWhole}.${fraction}`;
}

function defaultShop() { return { id: "sample", name: "設定例（未保存）", pachiPer100: 27.5, pachiUnit: 200, slotPer100: 5.5, slotUnit: 200 }; }
function displayedShops() { return shops.length ? shops : [defaultShop()]; }
function selectedShop(id) { return displayedShops().find(shop => String(shop.id) === $(id).value) || displayedShops()[0]; }
function setting(shop, type) { return type === "pachi" ? { per100: Number(shop.pachiPer100), min: Number(shop.pachiUnit) } : { per100: Number(shop.slotPer100), min: Number(shop.slotUnit) }; }
function saveShops() { localStorage.setItem(shopKey, JSON.stringify(shops)); }
function saveSessions() { localStorage.setItem(sessionKey, JSON.stringify(sessions)); }

function updateShopSelects() {
  ["calcShop", "sessionShop"].forEach(id => {
    const previous = $(id).value;
    $(id).innerHTML = displayedShops().map(shop => `<option value="${shop.id}">${escapeHtml(shop.name)}</option>`).join("");
    $(id).value = displayedShops().some(shop => String(shop.id) === previous) ? previous : String(displayedShops()[0].id);
  });
}
function updateLabels() {
  $("ballTitle").textContent = `現在持${unitName(calcType)}数`;
  $("rateTotalLabel").textContent = `換金前の総${unitName(rateType)}数`;
  $("rateRemainderLabel").textContent = `あまり${unitName(rateType)}数`;
  $("sessionStartLabel").textContent = `開始持${unitName(sessionType)}数`;
  $("sessionUsedLabel").textContent = `使用後の持${unitName(sessionType)}数`;
  $("sessionEndLabel").textContent = `終了持${unitName(sessionType)}数`;
}
function getRateComputation() {
  const total = number("rateTotal"), cash = number("rateCash"), remainder = number("rateRemainder");
  const allFilled = $("rateTotal").value !== "" && $("rateCash").value !== "" && $("rateRemainder").value !== "";
  if (!allFilled || !total || !cash || remainder >= total) return { allFilled, valid: false };
  const exchanged = total - remainder;
  const per100 = exchanged / cash * 100;
  const value = total / per100 * 100;
  const candidates = [100, 200, 500, 1000].filter(min => Math.abs(Math.floor(value / min + 1e-8) * min - cash) < 0.01);
  return { allFilled, valid: true, total, cash, remainder, exchanged, per100, value, candidates };
}
function calculateRate() {
  const unit = unitName(rateType);
  const r = getRateComputation();
  updateReflectButton();
  if (!r.allFilled) { $("rateResult").innerHTML = '<p class="notice">数値を入力すると、換金率を自動で確認します。</p>'; return; }
  if (!r.valid) { $("rateResult").innerHTML = `<p class="notice">総${unit}数、換金額、あまり${unit}数を正しく入力してください。</p>`; return; }
  const candidateText = r.candidates.length ? r.candidates.map(amount => `${amount.toLocaleString()}円`).join("、") : "一般的な候補（100円・200円・500円・1,000円）では判定できません";
  const judgement = r.candidates.length === 1 ? `最低換金額は ${r.candidates[0].toLocaleString()}円 と確認できます。` : r.candidates.length > 1 ? "最低換金額は一つに絞れません。候補を確認してください。" : "この入力内容だけでは最低換金額を判定できません。";
  $("rateResult").innerHTML = `<div class="result-title">推定換金率</div><div class="amount">100円＝${compactNumber(r.per100)}${unit}</div><div class="rows"><div class="row"><span>換金した${unit}数</span><strong>${r.exchanged.toLocaleString()}${unit}</strong></div><div class="row"><span>推定価値</span><strong>${yen(r.value)}</strong></div><div class="row"><span>最低換金額の候補</span><strong>${candidateText}</strong></div></div><p class="notice">${judgement}</p>`;
}
function refreshReflectShopSelect() {
  const select = $("reflectShopSelect");
  const previous = select.value;
  select.innerHTML = '<option value="__new__">＋ 新規店舗として登録</option>' + shops.map(shop => `<option value="${shop.id}">${escapeHtml(shop.name)}</option>`).join("");
  select.value = shops.some(shop => String(shop.id) === previous) ? previous : "__new__";
  $("reflectShopName").style.display = select.value === "__new__" ? "" : "none";
}
function updateReflectButton() {
  const r = getRateComputation();
  $("reflectToShop").disabled = !r.valid;
}
function reflectToShop() {
  const r = getRateComputation();
  if (!r.valid) return;
  const select = $("reflectShopSelect");
  const perKey = rateType === "pachi" ? "pachiPer100" : "slotPer100";
  const unitKey = rateType === "pachi" ? "pachiUnit" : "slotUnit";
  const per100Value = Number(r.per100.toFixed(4));
  if (select.value === "__new__") {
    const name = $("reflectShopName").value.trim();
    if (!name) { alert("新しい店舗名を入力してください。"); return; }
    const shop = { id: Date.now(), name, pachiPer100: 0, pachiUnit: 0, slotPer100: 0, slotUnit: 0 };
    shop[perKey] = per100Value;
    if (r.candidates.length === 1) shop[unitKey] = r.candidates[0];
    shops.push(shop);
  } else {
    const shop = shops.find(item => String(item.id) === select.value);
    if (!shop) return;
    shop[perKey] = per100Value;
    if (r.candidates.length === 1) shop[unitKey] = r.candidates[0];
  }
  saveShops(); updateShopSelects(); renderShops(); refreshReflectShopSelect(); calculate(); previewSession();
  $("reflectShopName").value = "";
  alert("店舗管理に反映しました。");
}
function calculate() {
  const amount = number("currentBalls"), investment = number("investmentMoney"), desiredCash = number("desiredCash");
  const { per100, min } = setting(selectedShop("calcShop"), calcType);
  if (!per100 || !min) { $("result").innerHTML = '<p class="notice">店舗の換金設定を登録してください。</p>'; return; }
  const value = amount / per100 * 100;
  const cash = Math.floor(value / min) * min;
  const remainder = amount - Math.min(amount, Math.floor(cash / 100 * per100 + 1e-9));
  let rows = `<div class="row"><span>端数</span><strong>${remainder.toLocaleString()}${unitName(calcType)}</strong></div>`;
  if ($("investmentMoney").value !== "") {
    const balance = cash - investment;
    const targetUnits = Math.ceil(Math.ceil(investment / min) * min / 100 * per100 - 1e-9);
    const toEven = Math.max(0, targetUnits - amount);
    rows += `<div class="row"><span>投資金額</span><strong>${yen(investment)}</strong></div><div class="row"><span>収支（換金ベース）</span><strong class="${balance >= 0 ? "plus" : "minus"}">${signedYen(balance)}</strong></div><div class="row"><span>チャラまであと</span><strong>${toEven ? `${toEven.toLocaleString()}${unitName(calcType)}` : "達成"}</strong></div>`;
  }
  if ($("desiredCash").value !== "") {
    const neededUnits = Math.ceil(Math.ceil(desiredCash / min) * min / 100 * per100 - 1e-9);
    rows += `<div class="row"><span>希望換金額に必要な${unitName(calcType)}数</span><strong>${neededUnits.toLocaleString()}${unitName(calcType)}</strong></div>`;
  }
  $("result").innerHTML = `<div class="result-title">換金額</div><div class="amount">${yen(cash)}</div><div class="rows">${rows}</div>`;
}
function captureDraft() { drafts[sessionType] = { start: $("sessionStart").value, used: $("sessionUsed").value, end: $("sessionEnd").value }; }
function loadDraft() { const draft = drafts[sessionType]; $("sessionStart").value = draft.start; $("sessionUsed").value = draft.used; $("sessionEnd").value = draft.end; }
function captureCalcDraft() { calcDrafts[calcType] = { balls: $("currentBalls").value, investment: $("investmentMoney").value, desired: $("desiredCash").value }; }
function loadCalcDraft() { const draft = calcDrafts[calcType]; $("currentBalls").value = draft.balls; $("investmentMoney").value = draft.investment; $("desiredCash").value = draft.desired; }
function captureRateDraft() { rateDrafts[rateType] = { total: $("rateTotal").value, cash: $("rateCash").value, remainder: $("rateRemainder").value }; localStorage.setItem(rateDraftKey, JSON.stringify(rateDrafts)); }
function loadRateDraft() { const draft = rateDrafts[rateType]; $("rateTotal").value = draft.total; $("rateCash").value = draft.cash; $("rateRemainder").value = draft.remainder; }
function sessionValues() {
  const shop = selectedShop("sessionShop"), set = setting(shop, sessionType);
  const start = number("sessionStart"), end = number("sessionEnd");
  const remainingEntered = $("sessionUsed").value !== "";
  const remaining = number("sessionUsed");
  const used = remainingEntered ? Math.max(0, start - remaining) : 0;
  const raw = balls => set.per100 ? balls / set.per100 * 100 : 0;
  const usedValue = round500(raw(used));
  const difference = end - start;
  const profit = round500(raw(difference));
  const cashOutValue = usedValue + profit;
  return { shop, set, start, used, end, usedValue, cashOutValue, difference, profit, startValueRaw: raw(start), usedValueRaw: raw(used), endValueRaw: raw(end), differenceValueRaw: raw(difference) };
}
function updateUsedInfo() {
  const unit = unitName(sessionType);
  if ($("sessionStart").value === "" || $("sessionUsed").value === "") { $("sessionUsedInfo").textContent = ""; return; }
  const start = number("sessionStart"), remaining = number("sessionUsed");
  if (remaining > start) { $("sessionUsedInfo").textContent = "使用後の持ち玉数が開始持ち玉数を超えています。"; return; }
  $("sessionUsedInfo").textContent = `使用${unit}数：${(start - remaining).toLocaleString()}${unit}（自動計算）`;
}
function previewSession() {
  if ($("sessionEnd").value === "") { $("sessionPreview").innerHTML = '<p class="notice">終了持玉数（持枚数）を入力すると、投資金額と台単体収支を表示します。</p>'; return; }
  const v = sessionValues();
  if (!v.set.per100) { $("sessionPreview").innerHTML = '<p class="notice">店舗の換金設定を登録してください。</p>'; return; }
  const unit = unitName(sessionType);
  $("sessionPreview").innerHTML = `<div class="summary-grid"><div class="summary-box investment"><div class="result-title">投資金額</div><div class="amount">${yen(v.usedValue)}</div></div><div class="summary-box"><div class="result-title">換金額</div><div class="amount">${yen(v.cashOutValue)}</div></div><div class="summary-box"><div class="result-title">台単体収支</div><div class="amount ${v.profit >= 0 ? "plus" : "minus"}">${signedYen(v.profit)}</div></div></div><div class="rows"><div class="row"><span>開始持${unit}数</span><strong>${v.start.toLocaleString()}${unit}（${yen(v.startValueRaw)}）</strong></div><div class="row"><span>使用${unit}数</span><strong>${v.used.toLocaleString()}${unit}（${yen(v.usedValueRaw)}）</strong></div><div class="row"><span>終了持${unit}数</span><strong>${v.end.toLocaleString()}${unit}（${yen(v.endValueRaw)}）</strong></div><div class="row"><span>増減${unit}数</span><strong>${v.difference >= 0 ? "+" : "−"}${Math.abs(v.difference).toLocaleString()}${unit}（${v.difference >= 0 ? "+" : "−"}${yen(Math.abs(v.differenceValueRaw))}）</strong></div></div>`;
}
function renderSessions() {
  const label = sessionType === "pachi" ? "パチンコ" : "パチスロ";
  $("historyTitle").textContent = `${label}履歴`;
  const filtered = sessions.map((item, index) => ({ item, index })).filter(record => (record.item.type || "pachi") === sessionType);
  if (!filtered.length) { $("sessionHistory").innerHTML = `<div class="empty">${label}の保存されたセッションはありません。</div>`; return; }
  $("sessionHistory").innerHTML = filtered.reverse().map(({ item, index }) => {
    const unit = unitName(item.type || "pachi"), used = Number(item.used || 0);
    const start = Number(item.start || 0), end = Number(item.end || 0);
    const per100 = setting(selectedShop("sessionShop"), sessionType).per100;
    const raw = balls => per100 ? balls / per100 * 100 : 0;
    const investment = item.investment ?? (per100 ? round500(raw(used)) : 0);
    const profit = item.profit ?? (per100 ? round500(raw(end - start)) : 0);
    const cashOut = item.cashOut ?? (investment + profit);
    const diff = Number(item.difference ?? 0);
    const startValueRaw = item.startValueRaw ?? raw(start);
    const usedValueRaw = item.usedValueRaw ?? raw(used);
    const endValueRaw = item.endValueRaw ?? raw(end);
    const diffValueRaw = item.differenceValueRaw ?? raw(diff);
    return `<article class="history-item"><div class="history-title">${escapeHtml(item.shopName || "店舗未記録")}</div><div class="history-meta">${escapeHtml(item.date || "過去の記録")}</div><div class="history-summary"><span>投資金額 <b>${yen(investment)}</b></span><span>換金額 <b>${yen(cashOut)}</b></span><span>台単体収支 <b class="${profit >= 0 ? "plus" : "minus"}">${signedYen(profit)}</b></span></div><div class="history-grid"><span>開始持${unit}数</span><b>${start.toLocaleString()}${unit}（${yen(startValueRaw)}）</b><span>使用${unit}数</span><b>${used.toLocaleString()}${unit}（${yen(usedValueRaw)}）</b><span>終了持${unit}数</span><b>${end.toLocaleString()}${unit}（${yen(endValueRaw)}）</b><span>増減${unit}数</span><b>${diff >= 0 ? "+" : "−"}${Math.abs(diff).toLocaleString()}${unit}（${diff >= 0 ? "+" : "−"}${yen(Math.abs(diffValueRaw))}）</b></div><button class="small-button" data-delete-session="${index}">この履歴を削除</button></article>`;
  }).join("");
}
function handoffSession() {
  if ($("sessionStart").value === "" || $("sessionEnd").value === "") { alert("開始持玉数（持枚数）と終了持玉数（持枚数）を入力してください。"); return; }
  const v = sessionValues();
  sessions.push({ id: Date.now(), date: new Date().toLocaleString("ja-JP"), shopName: v.shop.name, type: sessionType, start: v.start, used: v.used, end: v.end, difference: v.difference, investment: v.usedValue, cashOut: v.cashOutValue, profit: v.profit, startValueRaw: v.startValueRaw, usedValueRaw: v.usedValueRaw, endValueRaw: v.endValueRaw, differenceValueRaw: v.differenceValueRaw });
  saveSessions();
  drafts[sessionType] = { start: v.end.toLocaleString(), used: "", end: "" };
  loadDraft(); updateUsedInfo(); renderSessions(); previewSession();
}
function renderShops() {
  $("shopList").innerHTML = shops.length ? shops.map(shop => {
    const pachiText = shop.pachiPer100 > 0 ? `100円 ${shop.pachiPer100}玉 ／ 最低 ${shop.pachiUnit}円` : "未登録";
    const slotText = shop.slotPer100 > 0 ? `100円 ${shop.slotPer100}枚 ／ 最低 ${shop.slotUnit}円` : "未登録";
    return `<div class="shopItem" data-shop-id="${shop.id}"><span class="drag-handle" data-drag="${shop.id}">⠿</span><div class="shopItemBody"><b>${escapeHtml(shop.name)}</b><div class="history-meta">パチンコ：${pachiText}<br>パチスロ：${slotText}</div><button class="small-button" data-edit-shop="${shop.id}" style="background:#e8eff8;color:#285285">編集</button><button class="small-button" data-delete-shop="${shop.id}">削除</button></div></div>`;
  }).join("") : '<div class="empty">店舗が未登録です。上のフォームから登録してください。</div>';
}

document.querySelectorAll(".tab").forEach(button => button.onclick = () => { document.querySelectorAll(".tab,.page").forEach(el => el.classList.remove("active")); button.classList.add("active"); $(button.dataset.page).classList.add("active"); });
document.querySelectorAll("#gameType button").forEach(button => button.onclick = () => { captureCalcDraft(); calcType = button.dataset.type; document.querySelectorAll("#gameType button").forEach(b => b.classList.toggle("active", b === button)); loadCalcDraft(); updateLabels(); calculate(); });
document.querySelectorAll("#rateType button").forEach(button => button.onclick = () => { captureRateDraft(); rateType = button.dataset.type; document.querySelectorAll("#rateType button").forEach(b => b.classList.toggle("active", b === button)); loadRateDraft(); updateLabels(); calculateRate(); });
document.querySelectorAll("#sessionType button").forEach(button => button.onclick = () => { captureDraft(); sessionType = button.dataset.type; document.querySelectorAll("#sessionType button").forEach(b => b.classList.toggle("active", b === button)); loadDraft(); updateLabels(); updateUsedInfo(); previewSession(); renderSessions(); });
document.querySelectorAll('input[inputmode="numeric"], input[inputmode="decimal"]').forEach(input => input.addEventListener("input", () => formatNumericInput(input)));
["currentBalls", "investmentMoney", "desiredCash"].forEach(id => $(id).addEventListener("input", () => { captureCalcDraft(); calculate(); }));
$("calcShop").addEventListener("input", calculate); $("calcShop").addEventListener("change", calculate);
["rateTotal", "rateCash", "rateRemainder"].forEach(id => $(id).addEventListener("input", () => { captureRateDraft(); calculateRate(); }));
["sessionShop", "sessionStart", "sessionUsed", "sessionEnd"].forEach(id => $(id).addEventListener("input", () => { captureDraft(); updateUsedInfo(); previewSession(); })); $("sessionShop").addEventListener("change", previewSession);
$("clearBalls").onclick = () => { $("currentBalls").value = ""; $("investmentMoney").value = ""; $("desiredCash").value = ""; captureCalcDraft(); calculate(); };
$("clearRate").onclick = () => { rateDrafts[rateType] = { total: "", cash: "", remainder: "" }; localStorage.setItem(rateDraftKey, JSON.stringify(rateDrafts)); loadRateDraft(); calculateRate(); };
$("handoffSession").onclick = handoffSession;
$("clearSession").onclick = () => { drafts[sessionType] = { start: "", used: "", end: "" }; loadDraft(); updateUsedInfo(); previewSession(); };
$("clearHistory").onclick = () => { if (sessions.length && confirm("パチンコ・パチスロのセッション履歴をすべて削除しますか？")) { sessions = []; saveSessions(); renderSessions(); } };
$("sessionHistory").onclick = event => { const index = event.target.dataset.deleteSession; if (index === undefined) return; if (confirm("この履歴を削除しますか？")) { sessions.splice(Number(index), 1); saveSessions(); renderSessions(); } };
$("reflectShopSelect").addEventListener("change", () => { $("reflectShopName").style.display = $("reflectShopSelect").value === "__new__" ? "" : "none"; });
$("reflectToShop").onclick = reflectToShop;
let editingShopId = null;
function resetShopForm() {
  editingShopId = null;
  $("shopName").value = "";
  $("pachiPer100").value = "27.5"; $("pachiUnit").value = "200";
  $("slotPer100").value = "5.5"; $("slotUnit").value = "200";
  $("addShop").textContent = "店舗を保存";
  $("cancelEditShop").style.display = "none";
}
function startEditShop(id) {
  const shop = shops.find(item => String(item.id) === id);
  if (!shop) return;
  editingShopId = shop.id;
  $("shopName").value = shop.name;
  $("pachiPer100").value = shop.pachiPer100 > 0 ? shop.pachiPer100 : "";
  $("pachiUnit").value = shop.pachiPer100 > 0 ? shop.pachiUnit : "";
  $("slotPer100").value = shop.slotPer100 > 0 ? shop.slotPer100 : "";
  $("slotUnit").value = shop.slotPer100 > 0 ? shop.slotUnit : "";
  $("addShop").textContent = "店舗を更新";
  $("cancelEditShop").style.display = "";
  $("shopName").scrollIntoView({ behavior: "smooth", block: "center" });
}
$("addShop").onclick = () => {
  const name = $("shopName").value.trim();
  const values = [number("pachiPer100"), number("pachiUnit"), number("slotPer100"), number("slotUnit")];
  const pachiValid = values[0] > 0 && values[1] > 0;
  const slotValid = values[2] > 0 && values[3] > 0;
  if (!name || (!pachiValid && !slotValid)) { alert("店舗名と、パチンコ・パチスロどちらか一方の換金設定を入力してください。"); return; }
  const fields = { name, pachiPer100: pachiValid ? values[0] : 0, pachiUnit: pachiValid ? values[1] : 0, slotPer100: slotValid ? values[2] : 0, slotUnit: slotValid ? values[3] : 0 };
  if (editingShopId !== null) {
    const shop = shops.find(item => String(item.id) === String(editingShopId));
    if (shop) Object.assign(shop, fields);
  } else {
    const duplicate = shops.find(item => item.name === name);
    if (duplicate) { Object.assign(duplicate, fields); }
    else shops.push({ id: Date.now(), ...fields });
  }
  saveShops(); updateShopSelects(); renderShops(); refreshReflectShopSelect(); calculate(); previewSession(); resetShopForm();
};
$("cancelEditShop").onclick = resetShopForm;
$("shopList").onclick = event => {
  const editId = event.target.dataset.editShop;
  if (editId) { startEditShop(editId); return; }
  const id = event.target.dataset.deleteShop;
  const shop = shops.find(item => String(item.id) === id);
  if (shop && confirm(`「${shop.name}」を削除しますか？`)) {
    shops = shops.filter(item => String(item.id) !== id);
    if (String(editingShopId) === id) resetShopForm();
    saveShops(); updateShopSelects(); renderShops(); refreshReflectShopSelect(); calculate(); previewSession();
  }
};

let dragState = null;
$("shopList").addEventListener("pointerdown", event => {
  const handle = event.target.closest(".drag-handle");
  if (!handle) return;
  event.preventDefault();
  const item = handle.closest(".shopItem");
  dragState = { id: handle.dataset.drag, pointerId: event.pointerId, startY: event.clientY };
  item.classList.add("dragging");
  try { item.setPointerCapture(event.pointerId); } catch (error) {}
  document.addEventListener("pointermove", onShopDragMove);
  document.addEventListener("pointerup", onShopDragEnd);
});
function onShopDragMove(event) {
  if (!dragState) return;
  const item = $("shopList").querySelector(`.shopItem[data-shop-id="${dragState.id}"]`);
  if (!item) return;
  const deltaY = event.clientY - dragState.startY;
  item.style.transform = `translateY(${deltaY}px)`;
  const items = Array.from($("shopList").querySelectorAll(".shopItem"));
  const draggingIndex = items.indexOf(item);
  for (const other of items) {
    if (other === item) continue;
    const rect = other.getBoundingClientRect();
    const middle = rect.top + rect.height / 2;
    const otherIndex = items.indexOf(other);
    if ((draggingIndex < otherIndex && event.clientY > middle) || (draggingIndex > otherIndex && event.clientY < middle)) {
      const shopIndex = shops.findIndex(shop => String(shop.id) === dragState.id);
      const otherShopIndex = shops.findIndex(shop => String(shop.id) === other.dataset.shopId);
      if (shopIndex > -1 && otherShopIndex > -1) {
        const [moved] = shops.splice(shopIndex, 1);
        shops.splice(otherShopIndex, 0, moved);
        renderShops();
        const newItem = $("shopList").querySelector(`.shopItem[data-shop-id="${dragState.id}"]`);
        if (newItem) { newItem.classList.add("dragging"); dragState.startY = event.clientY; }
      }
      break;
    }
  }
}
function onShopDragEnd() {
  if (!dragState) return;
  const item = $("shopList").querySelector(`.shopItem[data-shop-id="${dragState.id}"]`);
  if (item) { item.classList.remove("dragging"); item.style.transform = ""; }
  document.removeEventListener("pointermove", onShopDragMove);
  document.removeEventListener("pointerup", onShopDragEnd);
  dragState = null;
  saveShops(); updateShopSelects(); refreshReflectShopSelect(); calculate(); previewSession();
}

function collectBackup() {
  return { version: 1, exportedAt: new Date().toISOString(), shops: JSON.parse(localStorage.getItem(shopKey) || "[]") };
}
async function backupData() {
  const json = JSON.stringify(collectBackup(), null, 2);
  const filename = `hadama-backup-${new Date().toISOString().slice(0, 10)}.json`;
  $("backupStatus").textContent = "";
  try {
    const file = new File([json], filename, { type: "application/json" });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: "端玉チェッカー バックアップ" });
      $("backupStatus").textContent = "共有シートからファイルに保存してください。";
      return;
    }
  } catch (error) { if (error.name === "AbortError") return; }
  const url = URL.createObjectURL(new Blob([json], { type: "application/json" }));
  const a = document.createElement("a");
  a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 3000);
  $("backupStatus").textContent = "バックアップを書き出しました。画面に表示されただけの場合は、共有ボタンから「ファイルに保存」を選んでください。";
}
function restoreData(file) {
  const reader = new FileReader();
  reader.onload = () => {
    let data;
    try { data = JSON.parse(reader.result); if (!data || !Array.isArray(data.shops)) throw new Error("invalid"); }
    catch (error) { alert("バックアップファイルの形式が正しくありません。"); return; }
    if (!confirm("現在の店舗情報を上書きして復元します。よろしいですか？")) return;
    localStorage.setItem(shopKey, JSON.stringify(data.shops));
    $("backupStatus").textContent = "復元しました。";
    location.reload();
  };
  reader.readAsText(file);
}
$("backupData").onclick = backupData;
$("restoreData").onclick = () => $("restoreFile").click();
$("restoreFile").addEventListener("change", () => { const file = $("restoreFile").files[0]; if (file) restoreData(file); $("restoreFile").value = ""; });

// ---- 確変記録 ----
// 機種ごとの累計（machine.totals）を保存する。画面の回数がそのまま累計で、保存後も数字は残る。
const machineKey = "machines-v100";
const kakuhenKey = "kakuhen-records-v100"; // 旧形式（1回ずつの記録）。読み込み時の移行にのみ使用
let machines = JSON.parse(localStorage.getItem(machineKey) || "[]");
let selectedMachineId = null;
const countDefs = [["normal", "通常当たり"], ["kakuhen", "確変当たり"], ["charge", "チャージ"], ["other", "その他"]];
const kakuhenCounts = { normal: 0, kakuhen: 0, charge: 0, other: 0 };
let kakuhenStatusTimer = null;
let renamingOther = false; // 「その他」名称の編集欄を開いているか
let otherDraft = "";       // 編集欄に入力中の文字
const emptyTotals = () => ({ normal: 0, kakuhen: 0, charge: 0, other: 0 });
const escapeAttr = value => escapeHtml(value).replace(/"/g, "&quot;");
const otherLabelOf = machine => (machine && machine.otherLabel) || "その他";
const countLabel = (key, machine) => key === "other" ? otherLabelOf(machine) : countDefs.find(def => def[0] === key)[1];
const isChecked = (machine, key) => !machine.checks || machine.checks[key] !== false;
const savedTotals = machine => ({ ...emptyTotals(), ...(machine.totals || {}) });
const selectedMachine = () => machines.find(item => String(item.id) === String(selectedMachineId));
const isKakuhenDirty = machine => countDefs.some(([key]) => kakuhenCounts[key] !== savedTotals(machine)[key]);
function saveMachines() { localStorage.setItem(machineKey, JSON.stringify(machines)); }
function loadKakuhenCounts(machine) { Object.assign(kakuhenCounts, machine ? savedTotals(machine) : emptyTotals()); }
function showKakuhenStatus(text) {
  $("kakuhenStatus").textContent = text;
  clearTimeout(kakuhenStatusTimer);
  if (text) kakuhenStatusTimer = setTimeout(() => { $("kakuhenStatus").textContent = ""; }, 2500);
}
// 旧形式の記録がある場合、累計に取り込む（totalsが未設定の機種のみ）
(function migrateKakuhenRecords() {
  let records = [];
  try { records = JSON.parse(localStorage.getItem(kakuhenKey) || "[]"); } catch (error) { return; }
  let changed = false;
  machines.forEach(machine => {
    if (machine.totals) return;
    const totals = emptyTotals();
    records.forEach(record => { if (String(record.machineId) === String(machine.id)) countDefs.forEach(([key]) => { totals[key] += Number(record[key] || 0); }); });
    if (countDefs.some(([key]) => totals[key] > 0)) { machine.totals = totals; changed = true; }
  });
  if (changed) saveMachines();
})();
// 分母 = チェックした項目の合計 / 分子 = そのうち通常当たり以外
function nonNormalRatio(machine, totals) {
  let den = 0, num = 0;
  countDefs.forEach(([key]) => { if (isChecked(machine, key)) { den += totals[key]; if (key !== "normal") num += totals[key]; } });
  return { den, num, percent: den > 0 ? num / den * 100 : null };
}
const percentText = percent => percent === null ? "—" : `${Math.round(percent * 10) / 10}%`;
function renderMachineSelect() {
  const select = $("machineSelect");
  select.innerHTML = `<option value="">${machines.length ? "機種を選択してください" : "機種が未登録です"}</option>` + machines.map(machine => `<option value="${machine.id}">${escapeHtml(machine.name)}</option>`).join("");
  select.value = selectedMachine() ? String(selectedMachineId) : "";
  select.disabled = machines.length === 0;
}
function renderKakuhenCounters() {
  const machine = selectedMachine();
  const box = $("kakuhenCounters");
  if (!machine) { box.style.display = "none"; box.innerHTML = ""; return; }
  const ratio = nonNormalRatio(machine, kakuhenCounts);
  box.style.display = "";
  box.innerHTML = `<div class="counter-head"><div class="counter-title">${escapeHtml(machine.name)}（累計）</div></div>` +
    countDefs.map(([key]) => { const label = escapeHtml(countLabel(key, machine)); return `<div class="counter-row"><label class="counter-name"><input type="checkbox" class="counter-check" data-check="${key}" ${isChecked(machine, key) ? "checked" : ""}><span class="counter-text"><span class="counter-label">${label}</span></span></label><div class="counter-ctrl"><button class="counter-btn cnt-plus" data-count="${key}" data-delta="1" aria-label="${label}を1増やす">＋</button><span class="counter-value">${kakuhenCounts[key]}</span><button class="counter-btn cnt-minus" data-count="${key}" data-delta="-1" aria-label="${label}を1減らす">−</button></div></div>`; }).join("") +
    `<div class="ratio-box"><div class="ratio-cell"><div class="result-title">累計大当たり回数</div><div class="ratio-num">${ratio.den}</div></div><div class="ratio-cell"><div class="result-title">通常当たり以外の割合</div><div class="ratio-num">${percentText(ratio.percent)}</div></div></div>` +
    `<button id="saveKakuhen" class="button" ${isKakuhenDirty(machine) ? "" : "disabled"}>保存</button>` +
    `<div class="counter-actions"><button class="mini-button" data-rename-toggle>「その他」名称変更</button><button class="small-button" id="deleteMachine">この機種を削除</button></div>` +
    (renamingOther ? `<div class="rename-wrap"><div class="notice">「その他」の表示名を入力（空欄で「その他」に戻ります）</div><div class="rename-box"><input id="otherLabelInput" type="text" maxlength="12" placeholder="その他" value="${escapeAttr(otherDraft)}"><button class="mini-button" data-rename-ok>決定</button><button class="mini-button" data-rename-cancel>キャンセル</button></div></div>` : "");
}
function renderKakuhenSummary() {
  $("kakuhenSummaryCard").style.display = machines.length ? "" : "none";
  $("kakuhenHistory").innerHTML = machines.map(machine => {
    const totals = savedTotals(machine), ratio = nonNormalRatio(machine, totals);
    const cells = countDefs.map(([key]) => `<div class="sum-cell"><span class="sum-label">${escapeHtml(countLabel(key, machine))}</span><b class="sum-num">${totals[key]}</b></div>`).join("") +
      `<div class="sum-cell"><span class="sum-label">累計</span><b class="sum-num">${ratio.den}</b></div><div class="sum-cell"><span class="sum-label">割合</span><b class="sum-num">${percentText(ratio.percent)}</b></div>`;
    return `<div class="sum-item"><div class="sum-name">${escapeHtml(machine.name)}</div><div class="sum-grid">${cells}</div></div>`;
  }).join("");
}
function refreshKakuhen() { renderMachineSelect(); renderKakuhenCounters(); renderKakuhenSummary(); }
function openMachineForm(open) {
  $("machineForm").style.display = open ? "" : "none";
  $("toggleMachineForm").textContent = open ? "閉じる" : "＋ 機種登録";
  if (open) $("machineName").focus(); else { $("machineName").value = ""; $("machineOther").value = ""; }
}
$("machineSelect").addEventListener("change", () => {
  const nextId = $("machineSelect").value;
  const current = selectedMachine();
  if (current && String(current.id) !== nextId && isKakuhenDirty(current) && !confirm("保存していない変更があります。破棄して機種を切り替えますか？")) { $("machineSelect").value = String(current.id); return; }
  selectedMachineId = nextId || null;
  renamingOther = false;
  loadKakuhenCounts(selectedMachine());
  if ($("machineForm").style.display !== "none") openMachineForm(false);
  renderKakuhenCounters();
});
function startMachineForm() {
  const current = selectedMachine();
  if (current && isKakuhenDirty(current) && !confirm("保存していない変更があります。破棄して機種登録に進みますか？")) return;
  selectedMachineId = null; renamingOther = false; loadKakuhenCounts(null);
  renderMachineSelect(); renderKakuhenCounters();
  openMachineForm(true);
}
$("toggleMachineForm").onclick = () => { if ($("machineForm").style.display === "none") startMachineForm(); else openMachineForm(false); };
$("cancelMachine").onclick = () => openMachineForm(false);
$("addMachine").onclick = () => {
  const name = $("machineName").value.trim();
  if (!name) return;
  if (machines.some(machine => machine.name === name)) { showKakuhenStatus("同じ機種名がすでに登録されています"); return; }
  const machine = { id: Date.now(), name, checks: { charge: false, other: false } }; // 新規登録時はチャージ・その他のチェックを外しておく
  const other = $("machineOther").value.trim();
  if (other) machine.otherLabel = other;
  machines.push(machine);
  saveMachines();
  const current = selectedMachine();
  if (!current || !isKakuhenDirty(current)) { selectedMachineId = machine.id; renamingOther = false; loadKakuhenCounts(machine); }
  openMachineForm(false);
  refreshKakuhen();
  showKakuhenStatus("機種を登録しました");
};
$("kakuhenCounters").addEventListener("click", event => {
  const machine = selectedMachine();
  if (!machine) return;
  const countButton = event.target.closest("[data-count]");
  if (countButton) {
    const key = countButton.dataset.count;
    kakuhenCounts[key] = Math.max(0, kakuhenCounts[key] + Number(countButton.dataset.delta));
    renderKakuhenCounters();
    return;
  }
  if (event.target.closest("[data-rename-toggle]")) {
    renamingOther = !renamingOther; otherDraft = machine.otherLabel || "";
    renderKakuhenCounters();
    if (renamingOther && $("otherLabelInput")) $("otherLabelInput").focus();
    return;
  }
  if (event.target.closest("[data-rename-cancel]")) { renamingOther = false; renderKakuhenCounters(); return; }
  if (event.target.closest("[data-rename-ok]")) {
    const label = otherDraft.trim();
    if (label) machine.otherLabel = label; else delete machine.otherLabel;
    renamingOther = false;
    saveMachines(); renderKakuhenCounters(); renderKakuhenSummary();
    return;
  }
  if (event.target.id === "saveKakuhen") {
    if (!isKakuhenDirty(machine)) return;
    machine.totals = { ...kakuhenCounts };
    machine.updatedAt = new Date().toLocaleString("ja-JP");
    saveMachines(); renderKakuhenCounters(); renderKakuhenSummary();
    showKakuhenStatus("保存しました");
    return;
  }
  if (event.target.id === "deleteMachine") {
    if (!confirm(`「${machine.name}」を削除しますか？（累計の記録も削除されます）`)) return;
    machines = machines.filter(item => item.id !== machine.id);
    selectedMachineId = null; renamingOther = false; loadKakuhenCounts(null);
    saveMachines(); refreshKakuhen();
    showKakuhenStatus("削除しました");
  }
});
$("kakuhenCounters").addEventListener("input", event => { if (event.target.id === "otherLabelInput") otherDraft = event.target.value; });
$("kakuhenCounters").addEventListener("change", event => {
  const key = event.target.dataset.check;
  const machine = selectedMachine();
  if (!key || !machine) return;
  machine.checks = { ...(machine.checks || {}), [key]: event.target.checked };
  saveMachines(); renderKakuhenCounters(); renderKakuhenSummary();
});

refreshKakuhen();
updateShopSelects(); loadRateDraft(); updateLabels(); renderShops(); renderSessions(); calculate(); calculateRate(); updateUsedInfo(); previewSession(); refreshReflectShopSelect();
