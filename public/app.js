const hostButton = document.querySelector("#hostButton");
const statusEl = document.querySelector("#status");
const dropzone = document.querySelector("#dropzone");
const fileInput = document.querySelector("#fileInput");
const folderInput = document.querySelector("#folderInput");
const pickFiles = document.querySelector("#pickFiles");
const pickFolder = document.querySelector("#pickFolder");
const progressWrap = document.querySelector("#progressWrap");
const progressName = document.querySelector("#progressName");
const progressPercent = document.querySelector("#progressPercent");
const progressBar = document.querySelector("#progressBar");
const links = document.querySelector("#links");
const history = document.querySelector("#history");
const historyLinks = document.querySelector("#historyLinks");

let hostUrl = "";

init();

function init() {
  fetch("/api/info")
    .then((response) => response.json())
    .then((info) => {
      hostUrl = info.origin;
      hostButton.textContent = info.origin.replace("http://", "");
    })
    .catch(() => {
      hostButton.textContent = location.host;
    });

  hostButton.addEventListener("click", () => copyText(hostUrl || location.origin, hostButton, hostButton));
  pickFiles.addEventListener("click", () => fileInput.click());
  pickFolder.addEventListener("click", () => folderInput.click());
  fileInput.addEventListener("change", () => uploadFiles([...fileInput.files]));
  folderInput.addEventListener("change", () => uploadFiles([...folderInput.files]));
  loadHistory();

  document.addEventListener("paste", (event) => {
    const files = [...(event.clipboardData?.files ?? [])];
    if (!files.length) return;
    event.preventDefault();
    uploadFiles(files);
  });

  dropzone.addEventListener("dragover", (event) => {
    event.preventDefault();
    dropzone.classList.add("isDragging");
  });

  dropzone.addEventListener("dragleave", () => {
    dropzone.classList.remove("isDragging");
  });

  dropzone.addEventListener("drop", (event) => {
    event.preventDefault();
    dropzone.classList.remove("isDragging");
    uploadFiles([...event.dataTransfer.files]);
  });
}

function uploadFiles(files) {
  if (!files.length) return;

  const formData = new FormData();
  for (const file of files) {
    const relativePath = file.webkitRelativePath || file.name;
    formData.append("files", file, file.name);
    formData.append("paths", relativePath);
  }

  setProgress(0, files.length === 1 ? files[0].name : `${files.length} 个项目`);
  statusEl.textContent = "上传中";
  statusEl.classList.remove("error");
  progressWrap.hidden = false;

  const request = new XMLHttpRequest();
  request.open("POST", "/api/upload");
  request.upload.addEventListener("progress", (event) => {
    if (event.lengthComputable) {
      setProgress(Math.round((event.loaded / event.total) * 100));
    }
  });

  request.addEventListener("load", () => {
    try {
      const data = JSON.parse(request.responseText);
      if (request.status >= 400) throw new Error(data.error || "上传失败");
      setProgress(100);
      progressWrap.hidden = true;
      statusEl.textContent = "已生成";
      renderLink(data, links);
      loadHistory();
    } catch (error) {
      showError(error.message);
    } finally {
      fileInput.value = "";
      folderInput.value = "";
    }
  });

  request.addEventListener("error", () => showError("网络错误"));
  request.send(formData);
}

function renderLink(data, target) {
  const card = document.createElement("article");
  card.className = "linkCard";
  card.innerHTML = `
    <div class="linkTop">
      <span>${escapeHtml(data.name)}</span>
      <span class="linkMeta">${formatBytes(data.size)} · ${formatTime(data.createdAt)}</span>
    </div>
    <a class="linkUrl" href="${data.path}" target="_blank" rel="noreferrer">${escapeHtml(data.url)}</a>
    <div class="linkActions">
      <button class="copy" type="button">复制链接</button>
      <a href="${data.path}" download>下载</a>
    </div>
  `;
  card.querySelector(".copy").addEventListener("click", (event) => copyText(data.url, event.currentTarget, card.querySelector(".linkUrl")));
  target.prepend(card);
}

function loadHistory() {
  fetch("/api/history")
    .then((response) => response.json())
    .then((items) => {
      historyLinks.innerHTML = "";
      history.hidden = !items.length;
      for (const item of items.reverse()) {
        renderLink(item, historyLinks);
      }
    })
    .catch(() => {
      history.hidden = true;
    });
}

function setProgress(value, name) {
  if (name) progressName.textContent = name;
  progressPercent.textContent = `${value}%`;
  progressBar.style.width = `${value}%`;
}

function showError(message) {
  statusEl.textContent = message;
  statusEl.classList.add("error");
  statusEl.classList.remove("success");
}

async function copyText(text, button, selectable) {
  try {
    let copied = false;
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      copied = true;
    } else {
      copied = fallbackCopyText(text);
    }
    const oldText = button.textContent;
    button.textContent = copied ? "已复制" : "已选中";
    statusEl.textContent = copied ? "已复制" : "已选中";
    statusEl.classList.add("success");
    statusEl.classList.remove("error");
    if (!copied && selectable) {
      selectElementText(selectable);
    }
    setTimeout(() => {
      button.textContent = oldText;
    }, 1100);
  } catch {
    showError("复制失败");
  }
}

function fallbackCopyText(text) {
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.style.position = "fixed";
  textarea.style.left = "0";
  textarea.style.top = "0";
  textarea.style.width = "1px";
  textarea.style.height = "1px";
  textarea.style.opacity = "0";
  document.body.append(textarea);
  textarea.focus({ preventScroll: true });
  textarea.select();
  textarea.setSelectionRange(0, textarea.value.length);
  const copied = document.execCommand("copy");
  textarea.remove();
  return copied;
}

function selectElementText(element) {
  const selection = window.getSelection();
  const range = document.createRange();
  range.selectNodeContents(element);
  selection.removeAllRanges();
  selection.addRange(range);
}

function formatBytes(bytes) {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** index).toFixed(index ? 1 : 0)} ${units[index]}`;
}

function formatTime(timestamp) {
  if (!timestamp) return "刚刚";
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(timestamp));
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[char]);
}
