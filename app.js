const CAPACITY = 11;
const APPLICATIONS_KEY = "weekendVanApplications";
const SCHEDULE_KEY = "weekendVanSchedule";
const rideLabels = { up: "상행 편도", down: "하행 편도", round: "왕복" };
const weekdayLabels = ["일요일", "월요일", "화요일", "수요일", "목요일", "금요일", "토요일"];

const defaultSchedule = {
  serviceDate: getNextSaturdayDate(),
  weekday: "토요일",
  doryangDepartureTime: "08:00",
  gimcheonIcDepartureTime: "08:25",
  arrivalTime: "10:00",
};

const storedApplications = readStored(APPLICATIONS_KEY, []);
let applications = Array.isArray(storedApplications) ? storedApplications : [];
let schedule = { ...defaultSchedule, ...readStored(SCHEDULE_KEY, {}) };
let companionNumber = 0;
let editingId = null;

function readStored(key, fallback) {
  try {
    const value = JSON.parse(localStorage.getItem(key));
    return value ?? fallback;
  } catch {
    return fallback;
  }
}

function saveApplications() {
  localStorage.setItem(APPLICATIONS_KEY, JSON.stringify(applications));
}

function saveSchedule() {
  localStorage.setItem(SCHEDULE_KEY, JSON.stringify(schedule));
}

function getNextSaturdayDate(from = new Date()) {
  const date = new Date(from);
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + ((6 - date.getDay() + 7) % 7));
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function weekdayFromDate(value) {
  if (!value) return "요일 미정";
  return weekdayLabels[new Date(`${value}T12:00:00`).getDay()];
}

function formatDate(value) {
  if (!value) return "날짜 미정";
  return new Intl.DateTimeFormat("ko-KR", { year: "numeric", month: "long", day: "numeric" }).format(new Date(`${value}T12:00:00`));
}

function addMinutes(time, minutes) {
  const [hours, minute] = time.split(":").map(Number);
  const total = (hours * 60 + minute + minutes) % (24 * 60);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

function counts(items = applications) {
  const up = items.filter((item) => item.rideType === "up" || item.rideType === "round").length;
  const down = items.filter((item) => item.rideType === "down" || item.rideType === "round").length;
  return {
    upRemaining: Math.max(0, CAPACITY - up),
    downRemaining: Math.max(0, CAPACITY - down),
  };
}

function hasCapacity(numberOfPeople, rideType, items = applications) {
  const summary = counts(items);
  if (rideType === "up") return summary.upRemaining >= numberOfPeople;
  if (rideType === "down") return summary.downRemaining >= numberOfPeople;
  return summary.upRemaining >= numberOfPeople && summary.downRemaining >= numberOfPeople;
}

function normalizedName(name) {
  return name.trim().replace(/\s+/g, " ").toLocaleLowerCase("ko-KR");
}

function findDuplicate(names, ignoredId = null) {
  const knownNames = new Set(
    applications
      .filter((item) => item.id !== ignoredId)
      .map((item) => normalizedName(item.name)),
  );
  for (const name of names) {
    const normalized = normalizedName(name);
    if (knownNames.has(normalized)) return name;
    knownNames.add(normalized);
  }
  return null;
}

function render() {
  const summary = counts();
  document.querySelector("#up-remaining").textContent = summary.upRemaining;
  document.querySelector("#down-remaining").textContent = summary.downRemaining;
  document.querySelector("#total-count").textContent = applications.length;
  renderGroup("doryang", applications.filter((item) => item.departurePoint === "doryang"));
  renderGroup("ic", applications.filter((item) => item.departurePoint === "gimcheon_ic"));

  document.querySelector("#schedule-weekday").textContent = schedule.weekday || weekdayFromDate(schedule.serviceDate);
  document.querySelector("#schedule-date").textContent = formatDate(schedule.serviceDate);
  document.querySelector("#doryang-time").textContent = schedule.doryangDepartureTime;
  document.querySelector("#ic-time").textContent = schedule.gimcheonIcDepartureTime;
  document.querySelector("#arrival-time").textContent = schedule.arrivalTime;
  document.querySelector("#doryang-list-time").textContent = schedule.doryangDepartureTime;
  document.querySelector("#ic-list-time").textContent = schedule.gimcheonIcDepartureTime;

  document.querySelectorAll('input[name="ride"]').forEach((input) => {
    const unavailable = !hasCapacity(1, input.value);
    input.disabled = unavailable;
    input.closest("label").classList.toggle("is-disabled", unavailable);
  });
  updateSubmitButton();
}

function renderGroup(prefix, items) {
  document.querySelector(`#${prefix}-count`).textContent = items.length;
  const list = document.querySelector(`#${prefix}-list`);
  list.replaceChildren();

  if (!items.length) {
    const empty = document.createElement("p");
    empty.className = "empty";
    empty.textContent = "신청한 사람이 없습니다.";
    list.append(empty);
    return;
  }

  items.forEach((item) => {
    const row = document.createElement("div");
    row.className = "name-row";

    const main = document.createElement("div");
    main.className = "name-main";
    const name = document.createElement("strong");
    name.textContent = item.name;
    const badge = document.createElement("span");
    badge.className = `ride-badge ${item.rideType}`;
    badge.textContent = rideLabels[item.rideType];
    main.append(name, badge);

    const actions = document.createElement("div");
    actions.className = "name-actions";
    const editButton = document.createElement("button");
    editButton.type = "button";
    editButton.className = "name-action";
    editButton.textContent = "수정";
    editButton.setAttribute("aria-label", `${item.name} 신청 수정`);
    editButton.addEventListener("click", () => openEditDialog(item.id));
    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "name-action delete";
    deleteButton.textContent = "취소";
    deleteButton.setAttribute("aria-label", `${item.name} 신청 취소`);
    deleteButton.addEventListener("click", () => deleteApplication(item.id));
    actions.append(editButton, deleteButton);

    row.append(main, actions);
    list.append(row);
  });
}

function updateSubmitButton() {
  const selected = document.querySelector('input[name="ride"]:checked');
  const needed = document.querySelectorAll(".companion-name").length + 1;
  const available = Boolean(selected && hasCapacity(needed, selected.value));
  const button = document.querySelector("#submit-button");
  button.disabled = !available;
  button.textContent = available ? "신청하기 →" : "선택한 구간의 자리가 부족합니다";
}

function showMessage(text, type) {
  const message = document.querySelector("#form-message");
  message.textContent = text;
  message.className = `form-message ${type}`;
}

function openEditDialog(id) {
  const application = applications.find((item) => item.id === id);
  if (!application) return;
  editingId = id;
  document.querySelector("#edit-name").value = application.name;
  document.querySelector("#edit-departure").value = application.departurePoint;
  document.querySelector("#edit-ride").value = application.rideType;
  document.querySelector("#edit-message").className = "form-message";
  document.querySelector("#edit-dialog").showModal();
}

function deleteApplication(id) {
  const application = applications.find((item) => item.id === id);
  if (!application || !confirm(`${application.name}님의 신청을 취소할까요?`)) return;
  applications = applications.filter((item) => item.id !== id);
  saveApplications();
  render();
}

document.querySelector("#add-companion").addEventListener("click", () => {
  if (document.querySelectorAll(".companion-row").length >= 10) return;
  companionNumber += 1;
  const row = document.createElement("div");
  row.className = "companion-row";
  const input = document.createElement("input");
  input.className = "field companion-name";
  input.placeholder = `동행인 ${companionNumber} 이름`;
  input.maxLength = 40;
  input.required = true;
  input.setAttribute("aria-label", `동행인 ${companionNumber} 이름`);
  const remove = document.createElement("button");
  remove.type = "button";
  remove.className = "remove-companion";
  remove.setAttribute("aria-label", "동행인 삭제");
  remove.textContent = "×";
  remove.addEventListener("click", () => {
    row.remove();
    updateSubmitButton();
  });
  row.append(input, remove);
  document.querySelector("#companions").append(row);
  input.focus();
  updateSubmitButton();
});

document.querySelectorAll('input[name="ride"]').forEach((input) => input.addEventListener("change", updateSubmitButton));

document.querySelector("#signup-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const mainName = document.querySelector("#applicant-name").value.trim().replace(/\s+/g, " ");
  const companionNames = [...document.querySelectorAll(".companion-name")].map((input) => input.value.trim().replace(/\s+/g, " "));
  const names = [mainName, ...companionNames];

  if (names.some((name) => name.length < 2)) {
    showMessage("이름을 두 글자 이상 입력해주세요.", "error");
    return;
  }
  const duplicate = findDuplicate(names);
  if (duplicate) {
    showMessage(`${duplicate} 이름은 이미 신청되어 있습니다.`, "error");
    return;
  }

  const rideType = document.querySelector('input[name="ride"]:checked')?.value;
  const departurePoint = document.querySelector('input[name="departure"]:checked')?.value;
  if (!rideType || !hasCapacity(names.length, rideType)) {
    showMessage("선택한 구간에 인원수만큼 자리가 남아 있지 않습니다.", "error");
    return;
  }

  const createdAt = new Date().toISOString();
  applications.push(...names.map((name, index) => ({ id: `${Date.now()}-${index}`, name, rideType, departurePoint, createdAt })));
  saveApplications();
  event.currentTarget.reset();
  document.querySelector("#companions").replaceChildren();
  document.querySelector('input[name="departure"][value="doryang"]').checked = true;
  document.querySelector('input[name="ride"][value="round"]').checked = true;
  showMessage(names.length === 1 ? `${names[0]}님, 신청됐습니다.` : `${names[0]}님 외 ${names.length - 1}명, 신청됐습니다.`, "success");
  render();
});

const editDialog = document.querySelector("#edit-dialog");
document.querySelector("#close-edit").addEventListener("click", () => editDialog.close());
document.querySelector("#edit-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const name = document.querySelector("#edit-name").value.trim().replace(/\s+/g, " ");
  const departurePoint = document.querySelector("#edit-departure").value;
  const rideType = document.querySelector("#edit-ride").value;
  const message = document.querySelector("#edit-message");

  if (name.length < 2) {
    message.textContent = "이름을 두 글자 이상 입력해주세요.";
    message.className = "form-message error";
    return;
  }
  if (findDuplicate([name], editingId)) {
    message.textContent = `${name} 이름은 이미 신청되어 있습니다.`;
    message.className = "form-message error";
    return;
  }
  const otherApplications = applications.filter((item) => item.id !== editingId);
  if (!hasCapacity(1, rideType, otherApplications)) {
    message.textContent = "선택한 구간에 남은 자리가 없습니다.";
    message.className = "form-message error";
    return;
  }

  applications = applications.map((item) => item.id === editingId ? { ...item, name, departurePoint, rideType } : item);
  saveApplications();
  editDialog.close();
  render();
});

const scheduleDialog = document.querySelector("#schedule-dialog");
function openScheduleDialog() {
  document.querySelector("#service-date-input").value = schedule.serviceDate || getNextSaturdayDate();
  document.querySelector("#departure-time-input").value = schedule.doryangDepartureTime;
  scheduleDialog.showModal();
}

document.querySelector("#open-schedule").addEventListener("click", openScheduleDialog);
document.querySelector("#close-schedule").addEventListener("click", () => scheduleDialog.close());
document.querySelector("#schedule-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const serviceDate = document.querySelector("#service-date-input").value;
  const doryangDepartureTime = document.querySelector("#departure-time-input").value;
  if (!serviceDate || !doryangDepartureTime) return;
  schedule = {
    serviceDate,
    weekday: weekdayFromDate(serviceDate),
    doryangDepartureTime,
    gimcheonIcDepartureTime: addMinutes(doryangDepartureTime, 25),
    arrivalTime: addMinutes(doryangDepartureTime, 120),
  };
  saveSchedule();
  scheduleDialog.close();
  render();
});

document.querySelector("#new-trip").addEventListener("click", () => {
  if (!confirm("새 운행을 시작하면 현재 신청 명단이 모두 지워집니다. 계속할까요?")) return;
  applications = [];
  saveApplications();
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  schedule = {
    ...schedule,
    serviceDate: getNextSaturdayDate(tomorrow),
    weekday: "토요일",
  };
  saveSchedule();
  render();
  openScheduleDialog();
});

render();
