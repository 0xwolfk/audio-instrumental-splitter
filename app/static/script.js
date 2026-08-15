lucide.createIcons();

const dropzone = document.getElementById("dropzone");
const fileInput = document.getElementById("fileInput");
const fileRow = document.getElementById("fileRow");
const fileName = document.getElementById("fileName");
const clearFile = document.getElementById("clearFile");
const splitButton = document.getElementById("splitButton");
const statusPanel = document.getElementById("statusPanel");
const statusText = document.getElementById("statusText");
const progressFill = document.getElementById("progressFill");
const resultsPanel = document.getElementById("resultsPanel");
const errorPanel = document.getElementById("errorPanel");
const errorText = document.getElementById("errorText");
const downloadVocals = document.getElementById("downloadVocals");
const downloadInstrumental = document.getElementById("downloadInstrumental");
const downloadBoth = document.getElementById("downloadBoth");

let selectedFile = null;
let pollTimer = null;

function isMp3(file) {
  return file && file.name.toLowerCase().endsWith(".mp3");
}

function selectFile(file) {
  if (!isMp3(file)) {
    showError("Only MP3 files are accepted.");
    return;
  }
  selectedFile = file;
  fileName.textContent = file.name;
  fileRow.classList.remove("hidden");
  splitButton.disabled = false;
  hideError();
}

function resetFile() {
  selectedFile = null;
  fileInput.value = "";
  fileRow.classList.add("hidden");
  splitButton.disabled = true;
}

function showError(message) {
  errorText.textContent = message;
  errorPanel.classList.remove("hidden");
}

function hideError() {
  errorPanel.classList.add("hidden");
}

function getSelectedBitrate() {
  const checked = document.querySelector('input[name="bitrate"]:checked');
  return checked ? checked.value : "320";
}

dropzone.addEventListener("click", () => fileInput.click());
dropzone.addEventListener("dragover", (e) => {
  e.preventDefault();
  dropzone.classList.add("dragover");
});
dropzone.addEventListener("dragleave", () => dropzone.classList.remove("dragover"));
dropzone.addEventListener("drop", (e) => {
  e.preventDefault();
  dropzone.classList.remove("dragover");
  const file = e.dataTransfer.files[0];
  if (file) selectFile(file);
});

fileInput.addEventListener("change", () => {
  const file = fileInput.files[0];
  if (file) selectFile(file);
});

clearFile.addEventListener("click", (e) => {
  e.stopPropagation();
  resetFile();
});

splitButton.addEventListener("click", async () => {
  if (!selectedFile) return;

  hideError();
  resultsPanel.classList.add("hidden");
  statusPanel.classList.remove("hidden");
  splitButton.disabled = true;
  setProgress(0, "Uploading…");

  const formData = new FormData();
  formData.append("file", selectedFile);
  formData.append("bitrate", getSelectedBitrate());
  formData.append("high_quality", document.getElementById("highQuality").checked);

  try {
    const response = await fetch("/api/separate", { method: "POST", body: formData });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body.detail || "Upload failed");
    }
    const { job_id } = await response.json();
    pollStatus(job_id);
  } catch (err) {
    statusPanel.classList.add("hidden");
    splitButton.disabled = false;
    showError(err.message);
  }
});

function setProgress(percent, label) {
  progressFill.style.width = `${percent}%`;
  statusText.textContent = label;
}

function pollStatus(jobId) {
  clearInterval(pollTimer);
  pollTimer = setInterval(async () => {
    try {
      const response = await fetch(`/api/status/${jobId}`);
      if (!response.ok) throw new Error("Lost track of the job");
      const data = await response.json();

      if (data.status === "processing" || data.status === "queued") {
        setProgress(data.progress || 0, `Splitting… ${data.progress || 0}%`);
      } else if (data.status === "done") {
        clearInterval(pollTimer);
        setProgress(100, "Splitting… 100%");
        statusPanel.classList.add("hidden");
        splitButton.disabled = false;
        downloadVocals.href = `/api/download/${jobId}/vocals`;
        downloadInstrumental.href = `/api/download/${jobId}/instrumental`;
        downloadBoth.onclick = () => {
          window.location.href = `/api/download/${jobId}/zip/both`;
        };
        resultsPanel.classList.remove("hidden");
      } else if (data.status === "error") {
        clearInterval(pollTimer);
        statusPanel.classList.add("hidden");
        splitButton.disabled = false;
        showError(data.error || "Splitting failed");
      }
    } catch (err) {
      clearInterval(pollTimer);
      statusPanel.classList.add("hidden");
      splitButton.disabled = false;
      showError(err.message);
    }
  }, 1200);
}
