const CAPACITY = 11;
const APPLICATIONS_KEY = "weekendVanApplications";
const SCHEDULE_KEY = "weekendVanSchedule";
const defaultSchedule = { weekday: "토요일", doryangDepartureTime: "08:00", gimcheonIcDepartureTime: "08:25", arrivalTime: "10:00" };
const rideLabels = { up: "상행 편도", down: "하행 편도", round: "왕복" };
let applications = readStored(APPLICATIONS_KEY, []);
let schedule = readStored(SCHEDULE_KEY, defaultSchedule);
let companionNumber = 0;

function readStored(key, fallback) { try { const value = JSON.parse(localStorage.getItem(key)); return value ?? fallback; } catch { return fallback; } }
function saveApplications() { localStorage.setItem(APPLICATIONS_KEY, JSON.stringify(applications)); }
function addMinutes(time, minutes) { const [hours, minute] = time.split(":").map(Number); const total = (hours * 60 + minute + minutes) % (24 * 60); return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`; }
function counts() { const up = applications.filter((item) => item.rideType === "up" || item.rideType === "round").length; const down = applications.filter((item) => item.rideType === "down" || item.rideType === "round").length; return { upRemaining: Math.max(0, CAPACITY - up), downRemaining: Math.max(0, CAPACITY - down) }; }

function render() {
  const summary = counts();
  document.querySelector("#up-remaining").textContent = summary.upRemaining;
  document.querySelector("#down-remaining").textContent = summary.downRemaining;
  document.querySelector("#total-count").textContent = applications.length;
  renderGroup("doryang", applications.filter((item) => item.departurePoint === "doryang"));
  renderGroup("ic", applications.filter((item) => item.departurePoint === "gimcheon_ic"));
  document.querySelector("#schedule-weekday").textContent = schedule.weekday;
  document.querySelector("#doryang-time").textContent = schedule.doryangDepartureTime;
  document.querySelector("#ic-time").textContent = schedule.gimcheonIcDepartureTime;
  document.querySelector("#arrival-time").textContent = schedule.arrivalTime;
  document.querySelector("#doryang-list-time").textContent = schedule.doryangDepartureTime;
  document.querySelector("#ic-list-time").textContent = schedule.gimcheonIcDepartureTime;
  document.querySelectorAll('input[name="ride"]').forEach((input) => { const unavailable = input.value === "up" ? summary.upRemaining === 0 : input.value === "down" ? summary.downRemaining === 0 : summary.upRemaining === 0 || summary.downRemaining === 0; input.disabled = unavailable; input.closest("label").classList.toggle("is-disabled", unavailable); });
  updateSubmitButton();
}

function renderGroup(prefix, items) {
  document.querySelector(`#${prefix}-count`).textContent = items.length;
  const list = document.querySelector(`#${prefix}-list`); list.replaceChildren();
  if (!items.length) { const empty = document.createElement("p"); empty.className = "empty"; empty.textContent = "신청한 사람이 없습니다."; list.append(empty); return; }
  items.forEach((item) => { const row = document.createElement("div"); row.className = "name-row"; const name = document.createElement("strong"); name.textContent = item.name; const badge = document.createElement("span"); badge.className = `ride-badge ${item.rideType}`; badge.textContent = rideLabels[item.rideType]; row.append(name, badge); list.append(row); });
}

function updateSubmitButton() {
  const summary = counts(); const selected = document.querySelector('input[name="ride"]:checked'); const needed = document.querySelectorAll(".companion-name").length + 1;
  const available = selected && (selected.value === "up" ? summary.upRemaining >= needed : selected.value === "down" ? summary.downRemaining >= needed : summary.upRemaining >= needed && summary.downRemaining >= needed);
  const button = document.querySelector("#submit-button"); button.disabled = !available; button.textContent = available ? "신청하기 →" : "선택한 구간의 자리가 부족합니다";
}

function showMessage(text, type) { const message = document.querySelector("#form-message"); message.textContent = text; message.className = `form-message ${type}`; }

document.querySelector("#add-companion").addEventListener("click", () => {
  if (document.querySelectorAll(".companion-row").length >= 10) return;
  companionNumber += 1; const row = document.createElement("div"); row.className = "companion-row"; const input = document.createElement("input"); input.className = "field companion-name"; input.placeholder = `동행인 ${companionNumber} 이름`; input.maxLength = 40; input.required = true; input.setAttribute("aria-label", `동행인 ${companionNumber} 이름`); const remove = document.createElement("button"); remove.type = "button"; remove.className = "remove-companion"; remove.setAttribute("aria-label", "동행인 삭제"); remove.textContent = "×"; remove.addEventListener("click", () => { row.remove(); updateSubmitButton(); }); row.append(input, remove); document.querySelector("#companions").append(row); input.focus(); updateSubmitButton();
});

document.querySelectorAll('input[name="ride"]').forEach((input) => input.addEventListener("change", updateSubmitButton));
document.querySelector("#signup-form").addEventListener("submit", (event) => {
  event.preventDefault(); const mainName = document.querySelector("#applicant-name").value.trim().replace(/\s+/g, " "); const companionNames = [...document.querySelectorAll(".companion-name")].map((input) => input.value.trim().replace(/\s+/g, " ")); const names = [mainName, ...companionNames];
  if (names.some((name) => name.length < 2)) { showMessage("이름을 두 글자 이상 입력해주세요.", "error"); return; }
  const rideType = document.querySelector('input[name="ride"]:checked')?.value; const departurePoint = document.querySelector('input[name="departure"]:checked')?.value; const summary = counts(); const enoughSeats = rideType === "up" ? summary.upRemaining >= names.length : rideType === "down" ? summary.downRemaining >= names.length : summary.upRemaining >= names.length && summary.downRemaining >= names.length;
  if (!enoughSeats) { showMessage("선택한 구간에 인원수만큼 자리가 남아 있지 않습니다.", "error"); return; }
  const createdAt = new Date().toISOString(); applications.push(...names.map((name, index) => ({ id: `${Date.now()}-${index}`, name, rideType, departurePoint, createdAt }))); saveApplications(); event.currentTarget.reset(); document.querySelector("#companions").replaceChildren(); document.querySelector('input[name="departure"][value="doryang"]').checked = true; document.querySelector('input[name="ride"][value="round"]').checked = true; showMessage(names.length === 1 ? `${names[0]}님, 신청됐습니다.` : `${names[0]}님 외 ${names.length - 1}명, 신청됐습니다.`, "success"); render();
});

const scheduleDialog = document.querySelector("#schedule-dialog");
document.querySelector("#open-schedule").addEventListener("click", () => { document.querySelector("#weekday-input").value = schedule.weekday; document.querySelector("#departure-time-input").value = schedule.doryangDepartureTime; scheduleDialog.showModal(); });
document.querySelector("#close-schedule").addEventListener("click", () => scheduleDialog.close());
document.querySelector("#schedule-form").addEventListener("submit", (event) => { event.preventDefault(); const weekday = document.querySelector("#weekday-input").value; const doryangDepartureTime = document.querySelector("#departure-time-input").value; if (!doryangDepartureTime) return; schedule = { weekday, doryangDepartureTime, gimcheonIcDepartureTime: addMinutes(doryangDepartureTime, 25), arrivalTime: addMinutes(doryangDepartureTime, 120) }; localStorage.setItem(SCHEDULE_KEY, JSON.stringify(schedule)); scheduleDialog.close(); render(); });
render();
