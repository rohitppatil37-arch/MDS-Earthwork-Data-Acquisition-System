// ===============================
// INIT
// ===============================

document.addEventListener("DOMContentLoaded", () => {
  initApp();
});

async function initApp() {

  try {

    console.log("🚀 App Starting...");

    await loadConfig();

    console.log("📦 Loaded CONFIG:", CONFIG);

    if (!CONFIG.subdivisions) {
      throw new Error("Config missing subdivisions");
    }

    populateSubdivisions();

    getEl("workDate").value =
      new Date().toISOString().split("T")[0];

    handleDieselLogic();

    attachEventListeners();

// 👇 ADD THIS
initVoiceInput();
  // 👇 ADD THIS
getEl("mainForm")?.addEventListener("reset", () => {
  if(recognition && isRecording){
    recognition.stop();
  }

  const status = getEl("voiceStatus");
  if(status) status.innerText = "";
});  
  } catch (err) {

    console.error("❌ INIT FAILED:", err);
    alert("⚠️ Configuration load करण्यात त्रुटी आली.");

  }

}

  function attachEventListeners() {

  getEl("subdivision")?.addEventListener("change", handleSubdivisionChange);
  getEl("workType")?.addEventListener("change", handleWorkTypeChange);
  getEl("machineType")?.addEventListener("change", handleMachineTypeChange);

  getEl("machineName")?.addEventListener("change", () => {

  const subCode = getValue("subdivision");
  const machineName = getValue("machineName");
  const machineType = getValue("machineType");

  populateStaff(subCode, machineName); // 👈 MAIN CHANGE
  toggleFormFields(machineType, subCode);

});

  getEl("startReading")?.addEventListener("input", calculateTotalReading);
  getEl("endReading")?.addEventListener("input", calculateTotalReading);

  getEl("shift1Start")?.addEventListener("input", calculateShiftHours);
  getEl("shift1End")?.addEventListener("input", calculateShiftHours);
  getEl("shift2Start")?.addEventListener("input", calculateShiftHours);
  getEl("shift2End")?.addEventListener("input", calculateShiftHours);

  getEl("dieselQty")?.addEventListener("input", handleDieselLogic);
  getEl("mainForm")?.addEventListener("submit", handleSubmit);

  document.querySelectorAll("input, select").forEach(el => {

    const clearError = () => {
      el.classList.remove("error");
      if (document.querySelectorAll(".error").length === 0) {
        closeErrorBox();
      }
    };

    el.addEventListener("input", clearError);
    el.addEventListener("change", clearError);

  });

}  
// ===============================
// SUBDIVISION
// ===============================

function populateSubdivisions() {

  if (!CONFIG || !CONFIG.subdivisions) return;

  const select = getEl("subdivision");
  if (!select) return;

  resetSelect(select, "उपविभाग निवडा...");

  CONFIG.subdivisions.forEach(sub => {
    addOption(select, sub["Subdivision Code"], sub["Subdivision Name"]);
  });
}

function handleSubdivisionChange() {

  if (!CONFIG || !CONFIG.projects) return;

  const subCode = getValue("subdivision");

  resetSelect(getEl("workType"), "कामाचा प्रकार निवडा...");
  resetSelect(getEl("projectName"), "प्रकल्प निवडा...");
  resetMachineSection();

  if (!subCode) return;

  const workTypes = unique(
    CONFIG.projects
      .filter(p => p["Subdivision Code"] === subCode)
      .map(p => p["Work Type"])
  );

  workTypes.forEach(type =>
    addOption(getEl("workType"), type, type)
  );

  populateMachineTypes(subCode);
}

// ===============================
// WORK TYPE → PROJECT
// ===============================

function handleWorkTypeChange() {

  if (!CONFIG || !CONFIG.projects) return;

  const subCode = getValue("subdivision");
  const workType = getValue("workType");

  const projectSelect = getEl("projectName");
  resetSelect(projectSelect, "प्रकल्प निवडा...");

  if (!subCode || !workType) return;

  const projects = CONFIG.projects.filter(p =>
    p["Subdivision Code"] === subCode &&
    p["Work Type"] === workType
  );

  projects.forEach(p =>
    addOption(projectSelect, p["Project Name"], p["Project Name"])
  );
}

// ===============================
// MACHINE SECTION
// ===============================

function populateMachineTypes(subCode) {

  if (!CONFIG || !CONFIG.machines) return;

  const machineTypeSelect = getEl("machineType");
  resetSelect(machineTypeSelect, "सयंत्राचा प्रकार निवडा...");

  const types = unique(
    CONFIG.machines
      .filter(m => m["Subdivision Code"] === subCode)
      .map(m => m["Machine Type"])
  );

  types.forEach(type =>
    addOption(machineTypeSelect, type, type)
  );
}

function handleMachineTypeChange() {

  if (!CONFIG || !CONFIG.machines) return;

  const subCode = getValue("subdivision");
  const machineType = getValue("machineType");

  // 🔥 Always hide vehicle section first
  if (getEl("vehicleSection"))
    getEl("vehicleSection").style.display = "none";

  resetSelect(getEl("machineName"), "मशीन निवडा...");
  resetSelect(getEl("staffName"), "चालक / ऑपरेटर निवडा...");

  if (!subCode || !machineType) return;

  const machines = CONFIG.machines.filter(m =>
    m["Subdivision Code"] === subCode &&
    m["Machine Type"] === machineType
  );

  machines.forEach(m =>
    addOption(getEl("machineName"), m["Machine Name"], m["Machine Name"])
  );
  
  toggleFormFields(machineType, subCode);
}

function toggleFormFields(machineType, subCode) {

  const vehicleSection = getEl("vehicleSection");
  if (!vehicleSection || !CONFIG?.machines) return;

  const selectedMachine = getValue("machineName");

  // If machine not selected yet
  if (!selectedMachine) {
    vehicleSection.style.display = "none";
    getEl("tripCount").required = false;
    getEl("locationFromTo").required = false;
    return;
  }

  const machineData = CONFIG.machines.find(m =>
    m["Subdivision Code"]?.trim() === subCode?.trim() &&
    m["Machine Name"]?.trim() === selectedMachine?.trim()
  );

  if (!machineData) {
    vehicleSection.style.display = "none";
    return;
  }

  const isVehicle = machineData.Category?.trim() === "Vehicle";

  if (isVehicle) {
    vehicleSection.style.display = "block";
    getEl("tripCount").required = true;
    getEl("locationFromTo").required = true;
  } else {
    vehicleSection.style.display = "none";
    getEl("tripCount").required = false;
    getEl("locationFromTo").required = false;
    getEl("tripCount").value = "";
    getEl("locationFromTo").value = "";
  }
}

function populateStaff(subCode, machineName) {

  if (!CONFIG || !CONFIG.staff || !CONFIG.machines) return;

  const staffSelect = getEl("staffName");
  resetSelect(staffSelect, "चालक / ऑपरेटर निवडा...");

  const machineData = CONFIG.machines.find(m =>
    String(m["Subdivision Code"]).trim() === String(subCode).trim() &&
    String(m["Machine Name"]).trim() === String(machineName).trim()
  );

  if (!machineData) return;

  const category = String(machineData["Category"] || "")
    .trim()
    .toLowerCase();

  const roleRequired =
    category === "machine" ? "Operator" : "Driver";

  const staff = CONFIG.staff.filter(s =>
    String(s["Subdivision Code"]).trim() === String(subCode).trim() &&
    String(s["Role"]).trim().toLowerCase() === roleRequired.toLowerCase()
  );

  staff.forEach(person =>
    addOption(staffSelect, person["Name"], person["Name"])
  );
}

function resetMachineSection() {
  resetSelect(getEl("machineType"), "सयंत्राचा प्रकार निवडा...");
  resetSelect(getEl("machineName"), "मशीन निवडा...");
  resetSelect(getEl("staffName"), "चालक / ऑपरेटर निवडा...");

  if (getEl("machineSection"))
    getEl("machineSection").style.display = "block";

  if (getEl("vehicleSection"))
    getEl("vehicleSection").style.display = "none";
}

// ===============================
// CALCULATIONS
// ===============================

function calculateTotalReading() {
  const start = Number(getValue("startReading")) || 0;
  const end = Number(getValue("endReading")) || 0;

  if (end >= start && getEl("totalHoursReading")) {
    getEl("totalHoursReading").value =
      (end - start).toFixed(1);
  }
}

function calculateShiftHours() {
  function toHours(t) {
    if (!t) return 0;
    const [h, m] = t.split(":").map(Number);
    return h + m / 60;
  }

  const total =
    Math.max(0, toHours(getValue("shift1End")) - toHours(getValue("shift1Start"))) +
    Math.max(0, toHours(getValue("shift2End")) - toHours(getValue("shift2Start")));

  if (getEl("totalShiftHours"))
    getEl("totalShiftHours").value = total.toFixed(1);
}

function handleDieselLogic() {
  const qty = Number(getValue("dieselQty")) || 0;
  const time = getEl("dieselTime");
  const reading = getEl("dieselReading");

  if (!time || !reading) return;

  if (qty > 0) {
    time.disabled = false;
    reading.disabled = false;
  } else {
    time.value = "";
    reading.value = "";
    time.disabled = true;
    reading.disabled = true;
  }
}

// ===============================
// FORM SUBMIT
// ===============================

async function handleSubmit(e) {

  e.preventDefault();

  const btn = e.target.querySelector("button[type='submit']");
  btn.disabled = true;
  btn.innerHTML = "⏳जतन होत आहे...";

  const subSelect = getEl("subdivision");
  const subCode = subSelect?.value || "";
  const subName = subSelect?.options[subSelect.selectedIndex]?.text || "";

  // ✅ Single validation call
  if (!validateFrontend()) {
    btn.disabled = false;
    btn.innerHTML = "✅ माहिती जतन करा";
    return;
  }

  const start = Number(getValue("startReading")) || 0;
  const end = Number(getValue("endReading")) || 0;

  const total = end - start;
  const diesel = Number(getValue("dieselQty")) || 0;

  let remark = "✅ काम झाले";

  if (total === 0 && diesel === 0) {
    remark = "🚫 काम झाले नाही";
  } else if (total > 0 && diesel === 0) {
    remark = "⚠️ काम झाले पण डिझेल भरले नाही";
  }

  const payload = {
    "उपविभाग कोड": subCode,
    "उपविभाग": subName,
    "दिनांक": getValue("workDate"),
    "कामाचा प्रकार": getValue("workType"),
    "प्रकल्पाचे नाव": getValue("projectName"),
    "सयंत्राचा प्रकार": getValue("machineType"),
    "चालक": getValue("staffName"),
    "मशीन": getValue("machineName"),
    "डिझेल (लिटर)": diesel,
    "डिझेल वेळ": getValue("dieselTime"),
    "डिझेल reading": getValue("dieselReading"),
    "सुरुवातीचे reading": start,
    "शेवटचे reading": end,
    "Dashboard एकूण (तास/km)": total,
    "या ठिकाणापासून ते त्या ठिकाणापर्यंत": getValue("locationFromTo"),
    "एकूण ट्रिप्स": getValue("tripCount"),
    "शिफ्ट-१ सुरू वेळ": getValue("shift1Start"),
    "शिफ्ट-१ बंद वेळ": getValue("shift1End"),
    "शिफ्ट-२ सुरू वेळ": getValue("shift2Start"),
    "शिफ्ट-२ बंद वेळ": getValue("shift2End"),
    "एकूण तास (shift)": getValue("totalShiftHours"),
    "टीप": remark
  };

  try {

    const res = await fetch(API_URL, {
      method: "POST",
      body: JSON.stringify(payload),
      headers: {
        "Content-Type": "text/plain;charset=utf-8"
      }
    });

    const text = await res.text();

    if (text && text.toLowerCase().includes("success")) {

      showSuccessMessage("माहिती यशस्वीरित्या जतन झाली!");
      getEl("mainForm").reset();
      resetMachineSection();
      getEl("workDate").value =
        new Date().toISOString().split("T")[0];
      handleDieselLogic();

    } else {

      alert("⚠️ Server error आला.\n" + text);
    }

  } catch (err) {

    alert("❌ नेटवर्क एरर. पुन्हा प्रयत्न करा.");
  }

  btn.disabled = false;
  btn.innerHTML = "✅ माहिती जतन करा";
}

// ===============================
// UTILITIES
// ===============================
function showSuccessMessage(message) {
  const box = document.createElement("div");
  box.className = "success-toast";
  box.innerText = message;

  document.body.appendChild(box);

  setTimeout(() => {
    box.classList.add("show");
  }, 10);

  setTimeout(() => {
    box.classList.remove("show");
    setTimeout(() => box.remove(), 300);
  }, 3000);
}
function getEl(id) { return document.getElementById(id); }
function getValue(id) { return getEl(id)?.value || ""; }

function resetSelect(selectElement, placeholder) {
  if (!selectElement) return;
  selectElement.innerHTML = "";
  addOption(selectElement, "", placeholder);
}

function addOption(selectElement, value, text) {
  if (!selectElement) return;
  const opt = document.createElement("option");
  opt.value = value;
  opt.textContent = text;
  selectElement.appendChild(opt);
}

function unique(arr) {
  return [...new Set(arr)];
}
function showErrorBox(fields) {

  const list = document.getElementById("errorList");
  const box = document.getElementById("errorBox");

  list.innerHTML = "";

  fields.forEach(field => {
    const li = document.createElement("li");
    li.textContent = field.label;
    list.appendChild(li);

    if (field.id) {
      getEl(field.id)?.classList.add("error");
    }
  });

  box.classList.remove("hidden");

  // Scroll to first error field
  if (fields[0]?.id) {
    getEl(fields[0].id)?.scrollIntoView({ behavior: "smooth", block: "center" });
  }
}

function closeErrorBox() {
  document.getElementById("errorBox").classList.add("hidden");

  // Remove red highlight
  document.querySelectorAll(".error").forEach(el =>
    el.classList.remove("error")
  );
}
function validateFrontend() {
// Clear old errors
document.querySelectorAll(".error").forEach(el =>
  el.classList.remove("error")
);
  const fieldLabels = {
  subdivision: "उपविभाग",
  workType: "कामाचा प्रकार",
  projectName: "प्रकल्पाचे नाव",
  machineType: "सयंत्राचा प्रकार",
  machineName: "मशीन",
  staffName: "चालक / ऑपरेटर",
  startReading: "सुरुवातीचे reading",
  endReading: "शेवटचे reading",
  dieselQty: "डिझेल प्रमाण",
  shift1Start: "शिफ्ट-१ सुरू वेळ",
  shift1End: "शिफ्ट-१ बंद वेळ",
  shift2Start: "शिफ्ट-२ सुरू वेळ",
  shift2End: "शिफ्ट-२ बंद वेळ"
};

  let missing = [];

  // Basic Required Check
  for (let id in fieldLabels) {
    if (!getValue(id).trim()) {
      missing.push({ id, label: fieldLabels[id] });
    }
  }

  // Vehicle Validation
  const vehicleSection = getEl("vehicleSection");
  if (vehicleSection && vehicleSection.offsetParent !== null) {
    if (!getValue("tripCount").trim())
      missing.push({ id: "tripCount", label: "एकूण ट्रिप्स" });

    if (!getValue("locationFromTo").trim())
      missing.push({ id: "locationFromTo", label: "स्थान माहिती" });
  }

  // Diesel Extra Validation
  const dieselRaw = getValue("dieselQty").trim();
  const diesel = Number(dieselRaw);

  if (dieselRaw !== "" && (isNaN(diesel) || diesel < 0)) {
    missing.push({ id: "dieselQty", label: "डिझेल प्रमाण वैध संख्या असावी" });
  }

  if (diesel > 0) {
    if (!getValue("dieselTime").trim())
      missing.push({ id: "dieselTime", label: "डिझेल वेळ" });

    if (!getValue("dieselReading").trim())
      missing.push({ id: "dieselReading", label: "डिझेल reading" });
  }

  if (missing.length > 0) {
    showErrorBox(missing);
    return false;
  }

  // Reading Logical Validation
  const start = Number(getValue("startReading"));
  const end = Number(getValue("endReading"));

  if (isNaN(start) || isNaN(end) || end <= start) {
    showErrorBox([
      { id: "endReading", label: "शेवटचे reading सुरुवातीपेक्षा मोठे असावे" }
    ]);
    return false;
  }

  // Shift Time Validation
function timeToMinutes(t) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

const shift1Start = getValue("shift1Start");
const shift1End   = getValue("shift1End");
const shift2Start = getValue("shift2Start");
const shift2End   = getValue("shift2End");

// Shift 1 strict validation
if (timeToMinutes(shift1End) <= timeToMinutes(shift1Start)) {
  showErrorBox([
    { id: "shift1End", label: "शिफ्ट-१ बंद वेळ सुरू वेळेपेक्षा मोठी असावी" }
  ]);
  return false;
}

// Shift 2 strict validation
if (timeToMinutes(shift2End) <= timeToMinutes(shift2Start)) {
  showErrorBox([
    { id: "shift2End", label: "शिफ्ट-२ बंद वेळ सुरू वेळेपेक्षा मोठी असावी" }
  ]);
  return false;
}
  
// ✅ If everything valid
closeErrorBox();
return true;
}
// ===============================
// 🎙️ VOICE INPUT (LOCATION ONLY)
// ===============================

let recognition = null;
let isRecording = false;

function initVoiceInput(){

  const btn = getEl("micBtn");
const input = getEl("locationFromTo");
const status = getEl("voiceStatus");

// 👇 FIRST this
if(!btn || !input) return;

// 👇 THEN this
if(btn.dataset.voiceInit === "true") return;
btn.dataset.voiceInit = "true";

  const SpeechRecognition =
    window.SpeechRecognition || window.webkitSpeechRecognition;

  if(!SpeechRecognition){
    if(status) status.innerText = "❌ Voice support नाही";
    return;
  }

  recognition = new SpeechRecognition();

  // 🔥 Field-tested setting
  recognition.lang = "hi-IN"; // Marathi + Hindi mix better
  recognition.interimResults = false;
  recognition.continuous = false;

  // 🎤 START
  recognition.onstart = () => {
    isRecording = true;
    btn.classList.add("recording");
    if(status) status.innerText = "🎤 बोला...";
  };

  // ✅ RESULT
  recognition.onresult = (event) => {

  const text = event.results[0][0].transcript.trim();

  input.value = text;

  if(status) status.innerText = "✅ झाले";

  input.focus(); // ✅ ADD THIS
};

  recognition.onerror = (e) => {
  console.log("Voice error:", e);

  if(status){
    if(e.error === "not-allowed"){
      status.innerText = "🚫 Mic permission द्या";
    } else {
      status.innerText = "❌ पुन्हा प्रयत्न करा";
    }
  }
};

  // ⏹ END
  recognition.onend = () => {
    isRecording = false;
    btn.classList.remove("recording");
  };

  // 🎯 CLICK
  btn.addEventListener("click", () => {

    // 👉 Only if vehicle section visible
    const vehicleVisible =
      getEl("vehicleSection") &&
      getEl("vehicleSection").offsetParent !== null;

    if(!vehicleVisible){
      if(status) status.innerText = "⚠️ फक्त वाहनासाठी वापरा";
      return;
    }

    if(isRecording){
      recognition.stop();
    } else {
      try{
        recognition.start();
      }catch(e){
        console.log("Voice error:", e);
      }
    }

  });

}
