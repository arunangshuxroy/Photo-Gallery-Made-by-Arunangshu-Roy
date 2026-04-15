const fileInput = document.getElementById("fileInput");
const uploadBox = document.getElementById("uploadBox");
const uploadPrompt = document.getElementById("uploadPrompt");
const previewContainer = document.getElementById("previewContainer");
const previewImg = document.getElementById("previewImg");
const clearBtn = document.getElementById("clearBtn");
const uploadBtn = document.getElementById("uploadBtn");
const statusMsg = document.getElementById("statusMsg");
const galleryGrid = document.getElementById("galleryGrid");
const loader = document.getElementById("loader");
const emptyState = document.getElementById("emptyState");
const imageCount = document.getElementById("imageCount");
const modalOverlay = document.getElementById("modalOverlay");
const confirmDelete = document.getElementById("confirmDelete");
const cancelDelete = document.getElementById("cancelDelete");
const themeToggle = document.getElementById("themeToggle");
const themeIcon = themeToggle.querySelector(".theme-icon");

const savedTheme = localStorage.getItem("theme") || "light";
document.documentElement.setAttribute("data-theme", savedTheme);
themeIcon.textContent = savedTheme === "dark" ? "🌙" : "☀️";

themeToggle.addEventListener("click", () => {
  const next = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", next);
  localStorage.setItem("theme", next);
  themeIcon.textContent = next === "dark" ? "🌙" : "☀️";
});


const lightboxImg = document.getElementById("lightboxImg");
const lightboxClose = document.getElementById("lightboxClose");
const brightnessSlider = document.getElementById("brightnessSlider");
const saturationSlider = document.getElementById("saturationSlider");
const brightnessVal = document.getElementById("brightnessVal");
const saturationVal = document.getElementById("saturationVal");
const saveEdits = document.getElementById("saveEdits");
const resetEdits = document.getElementById("resetEdits");
const lightboxSkeleton = document.getElementById("lightboxSkeleton");
const lightboxControls = document.getElementById("lightboxControls");

let lightboxFilename = null;

// ── Lightbox ──

function applyFilter() {
  lightboxImg.style.filter = `brightness(${brightnessSlider.value}) saturate(${saturationSlider.value})`;
  brightnessVal.textContent = parseFloat(brightnessSlider.value).toFixed(2);
  saturationVal.textContent = parseFloat(saturationSlider.value).toFixed(2);
}

brightnessSlider.addEventListener("input", applyFilter);
saturationSlider.addEventListener("input", applyFilter);

resetEdits.addEventListener("click", () => {
  brightnessSlider.value = 1;
  saturationSlider.value = 1;
  applyFilter();
});

saveEdits.addEventListener("click", async () => {
  if (!lightboxFilename) return;
  saveEdits.disabled = true;
  saveEdits.textContent = "Saving…";
  try {
    const res = await fetch(`/edit/${lightboxFilename}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        brightness: parseFloat(brightnessSlider.value),
        saturation: parseFloat(saturationSlider.value),
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Save failed.");
    // Update gallery thumbnail
    const item = galleryGrid.querySelector(`[data-filename="${lightboxFilename}"]`);
    if (item) {
      const thumb = item.querySelector("img");
      thumb.src = data.thumb_url;
    }
    lightboxImg.src = data.url;
    brightnessSlider.value = 1;
    saturationSlider.value = 1;
    applyFilter();
    saveEdits.textContent = "Saved ✓";
    setTimeout(() => { saveEdits.textContent = "Save to S3"; saveEdits.disabled = false; }, 1500);
  } catch (err) {
    saveEdits.textContent = "Save to S3";
    saveEdits.disabled = false;
    setStatus(err.message, "error");
  }
});

function openLightbox(url, filename) {
  lightboxFilename = filename;
  lightboxImg.hidden = true;
  lightboxControls.hidden = true;
  lightboxSkeleton.hidden = false;
  lightboxImg.style.filter = "";
  brightnessSlider.value = 1;
  saturationSlider.value = 1;
  brightnessVal.textContent = "1.00";
  saturationVal.textContent = "1.00";
  lightboxOverlay.hidden = false;
  lightboxImg.onload = () => {
    lightboxSkeleton.hidden = true;
    lightboxImg.hidden = false;
    lightboxControls.hidden = false;
  };
  lightboxImg.src = url;
}

function closeLightbox() {
  lightboxOverlay.hidden = true;
  lightboxImg.src = "";
  lightboxImg.hidden = true;
  lightboxControls.hidden = true;
  lightboxSkeleton.hidden = false;
  lightboxFilename = null;
}

lightboxClose.addEventListener("click", closeLightbox);
lightboxOverlay.addEventListener("click", (e) => { if (e.target === lightboxOverlay) closeLightbox(); });

let pendingDelete = null;

// ── File selection ──

uploadBox.addEventListener("click", () => fileInput.click());

fileInput.addEventListener("change", () => {
  if (fileInput.files[0]) showPreview(fileInput.files[0]);
});

uploadBox.addEventListener("dragover", (e) => {
  e.preventDefault();
  uploadBox.classList.add("drag-over");
});

uploadBox.addEventListener("dragleave", () => uploadBox.classList.remove("drag-over"));

uploadBox.addEventListener("drop", (e) => {
  e.preventDefault();
  uploadBox.classList.remove("drag-over");
  const file = e.dataTransfer.files[0];
  if (file) showPreview(file);
});

function showPreview(file) {
  if (!["image/jpeg", "image/png"].includes(file.type)) {
    setStatus("Only JPEG and PNG files are allowed.", "error");
    return;
  }
  const reader = new FileReader();
  reader.onload = (e) => {
    previewImg.src = e.target.result;
    uploadPrompt.hidden = true;
    previewContainer.hidden = false;
    uploadBtn.disabled = false;
    setStatus("");
  };
  reader.readAsDataURL(file);
}

clearBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  resetUpload();
});

function resetUpload() {
  fileInput.value = "";
  previewImg.src = "";
  previewContainer.hidden = true;
  uploadPrompt.hidden = false;
  uploadBtn.disabled = true;
  setStatus("");
}

// ── Upload ──

uploadBtn.addEventListener("click", async () => {
  const file = fileInput.files[0];
  if (!file) return;

  uploadBtn.disabled = true;
  setStatus("Uploading…");

  const form = new FormData();
  form.append("image", file);

  try {
    const res = await fetch("/upload", { method: "POST", body: form });
    const data = await res.json();

    if (!res.ok) throw new Error(data.error || "Upload failed.");

    setStatus("Uploaded successfully.", "success");
    resetUpload();
    loadGallery();
  } catch (err) {
    setStatus(err.message, "error");
    uploadBtn.disabled = false;
  }
});

// ── Gallery ──

async function loadGallery() {
  loader.hidden = false;
  emptyState.hidden = true;
  galleryGrid.innerHTML = "";

  try {
    const res = await fetch("/images");
    const data = await res.json();
    const images = Array.isArray(data) ? data : [];

    loader.hidden = true;

    if (!images.length) {
      emptyState.hidden = false;
      imageCount.textContent = "";
      return;
    }

    imageCount.textContent = `${images.length} image${images.length !== 1 ? "s" : ""}`;
    images.forEach(addGalleryItem);
  } catch {
    loader.hidden = true;
    setStatus("Failed to load gallery.", "error");
  }
}

function addGalleryItem({ filename, url, thumb_url, size }) {
  const item = document.createElement("div");
  item.className = "gallery-item";
  item.dataset.filename = filename;

  const img = document.createElement("img");
  img.src = thumb_url;
  img.alt = filename;
  img.loading = "lazy";
  img.style.cursor = "pointer";
  img.onerror = () => { img.onerror = null; img.src = url; };
  img.addEventListener("click", () => openLightbox(url, filename));

  const footer = document.createElement("div");
  footer.className = "item-footer";

  const sizeEl = document.createElement("span");
  sizeEl.className = "item-size";
  sizeEl.textContent = formatSize(size);

  const delBtn = document.createElement("button");
  delBtn.className = "delete-btn";
  delBtn.textContent = "Delete";
  delBtn.addEventListener("click", () => openDeleteModal(filename));

  footer.append(sizeEl, delBtn);
  item.append(img, footer);
  galleryGrid.appendChild(item);
}

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ── Delete ──

function openDeleteModal(filename) {
  const pwd = prompt("Enter password to delete:");
  if (pwd !== "2026") {
    setStatus("Incorrect password.", "error");
    return;
  }
  pendingDelete = filename;
  modalOverlay.hidden = false;
}

cancelDelete.addEventListener("click", () => {
  modalOverlay.hidden = true;
  pendingDelete = null;
});

confirmDelete.addEventListener("click", async () => {
  if (!pendingDelete) return;
  modalOverlay.hidden = true;

  try {
    const res = await fetch(`/delete/${pendingDelete}`, { method: "DELETE" });
    if (!res.ok) throw new Error();

    const item = galleryGrid.querySelector(`[data-filename="${pendingDelete}"]`);
    if (item) item.remove();

    const remaining = galleryGrid.querySelectorAll(".gallery-item").length;
    imageCount.textContent = remaining ? `${remaining} image${remaining !== 1 ? "s" : ""}` : "";
    if (!remaining) emptyState.hidden = false;
  } catch {
    setStatus("Failed to delete image.", "error");
  }

  pendingDelete = null;
});

modalOverlay.addEventListener("click", (e) => {
  if (e.target === modalOverlay) {
    modalOverlay.hidden = true;
    pendingDelete = null;
  }
});

// ── Helpers ──

function setStatus(msg, type = "") {
  statusMsg.textContent = msg;
  statusMsg.className = `status-msg ${type}`.trim();
}

// ── Init ──
loadGallery();
