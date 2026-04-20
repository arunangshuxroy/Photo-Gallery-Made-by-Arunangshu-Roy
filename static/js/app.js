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
const themeLabel  = document.getElementById("themeLabel");

const savedTheme = localStorage.getItem("theme") || "light";
document.documentElement.setAttribute("data-theme", savedTheme);
themeToggle.checked = savedTheme === "dark";
themeLabel.textContent = savedTheme === "dark" ? "🌙" : "☀️";

themeToggle.addEventListener("change", () => {
  const next = themeToggle.checked ? "dark" : "light";
  document.documentElement.setAttribute("data-theme", next);
  localStorage.setItem("theme", next);
  themeLabel.textContent = next === "dark" ? "🌙" : "☀️";
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
  item.className = "gallery-item glass-card";
  item.dataset.filename = filename;

  // glass layers
  ["glass-filter", "glass-overlay", "glass-specular"].forEach(cls => {
    const d = document.createElement("div"); d.className = cls; item.appendChild(d);
  });

  const img = document.createElement("img");
  img.alt = filename;
  img.loading = "lazy";
  img.style.cursor = "pointer";
  img.style.opacity = "0";
  img.style.transition = "opacity 0.3s ease";
  img.onload = () => { img.style.opacity = "1"; };
  img.onerror = () => { img.onerror = null; img.src = url; };
  img.src = thumb_url;
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

// ── Tab Navigation ──

const tabBtns = document.querySelectorAll(".tab-btn");
const tabPanels = document.querySelectorAll(".tab-panel");

tabBtns.forEach(btn => {
  btn.addEventListener("click", () => {
    tabBtns.forEach(b => b.classList.remove("active"));
    tabPanels.forEach(p => { p.hidden = true; });
    btn.classList.add("active");
    const panel = document.getElementById(`tab-${btn.dataset.tab}`);
    if (panel) panel.hidden = false;
    if (btn.dataset.tab === "exhibition") initExhibition();
  });
});

// ── Exhibition / Coverflow ──

const cfTrack    = document.getElementById("cfTrack");
const cfDots     = document.getElementById("cfDots");
const cfPrev     = document.getElementById("cfPrev");
const cfNext     = document.getElementById("cfNext");
const cfEmpty    = document.getElementById("cfEmpty");
const cfReflection = document.getElementById("cfReflection");

const SLIDE_W    = 280;   // px spacing between slide centres
const SIDE_ROT   = 55;    // deg rotation for off-centre slides
const SIDE_TRANS = 0.38;  // x-translation factor for side slides
const SIDE_SCALE = 0.82;
const SIDE_OPACITY = 0.55;
const VISIBLE_SIDES = 3;  // slides visible each side of centre

let cfImages   = [];
let cfIndex    = 0;
let cfLoaded   = false;
let cfAutoplay = null;

async function initExhibition() {
  if (cfLoaded) { renderCF(); return; }
  try {
    const res  = await fetch("/images");
    const data = await res.json();
    cfImages = Array.isArray(data) ? data : [];
  } catch { cfImages = []; }

  cfLoaded = true;

  if (!cfImages.length) {
    cfEmpty.hidden = false;
    return;
  }

  cfEmpty.hidden = true;
  buildSlides();
  buildDots();
  renderCF();
  startAutoplay();
}

function buildSlides() {
  cfTrack.innerHTML = "";
  cfImages.forEach((img, i) => {
    const slide = document.createElement("div");
    slide.className = "cf-slide";
    slide.dataset.index = i;
    const el = document.createElement("img");
    el.src = img.thumb_url || img.url;
    el.alt = img.filename;
    el.loading = "lazy";
    el.onerror = () => { el.onerror = null; el.src = img.url; };
    slide.appendChild(el);
    slide.addEventListener("click", () => { cfIndex = i; renderCF(); resetAutoplay(); });
    cfTrack.appendChild(slide);
  });
}

function buildDots() {
  cfDots.innerHTML = "";
  cfImages.forEach((_, i) => {
    const dot = document.createElement("div");
    dot.className = "cf-dot" + (i === 0 ? " active" : "");
    dot.addEventListener("click", () => { cfIndex = i; renderCF(); resetAutoplay(); });
    cfDots.appendChild(dot);
  });
}

function renderCF() {
  const slides = cfTrack.querySelectorAll(".cf-slide");

  slides.forEach((slide, i) => {
    const offset = i - cfIndex;
    const absOff = Math.abs(offset);

    if (absOff > VISIBLE_SIDES) {
      slide.style.opacity = "0";
      slide.style.pointerEvents = "none";
      slide.style.zIndex = "0";
      return;
    }

    const sign    = Math.sign(offset) || 0;
    // centre each slide around 0; active slide sits at translateX(0)
    const tx      = offset * SLIDE_W;
    const ry      = absOff === 0 ? 0 : -sign * SIDE_ROT;
    const scale   = absOff === 0 ? 1 : Math.pow(SIDE_SCALE, absOff);
    const opacity = absOff === 0 ? 1 : Math.pow(SIDE_OPACITY, absOff) + 0.1;
    const z       = 100 - absOff * 10;

    slide.style.transform  = `translateX(calc(-50% + ${tx}px)) rotateY(${ry}deg) scale(${scale})`;
    slide.style.opacity    = opacity;
    slide.style.zIndex     = z;
    slide.style.pointerEvents = "auto";
    slide.classList.toggle("active", absOff === 0);
  });

  // dots
  cfDots.querySelectorAll(".cf-dot").forEach((d, i) => d.classList.toggle("active", i === cfIndex));

  // reflection
  updateReflection();
}

function updateReflection() {
  cfReflection.innerHTML = "";
  const cur = cfImages[cfIndex];
  if (!cur) return;

  const canvas = document.createElement("canvas");
  canvas.width  = 260;
  canvas.height = 90;
  const ctx = canvas.getContext("2d");
  const img = new Image();
  img.crossOrigin = "anonymous";
  img.onload = () => {
    // draw image flipped vertically
    ctx.save();
    ctx.translate(0, canvas.height);
    ctx.scale(1, -1);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    ctx.restore();
    // fade gradient overlay
    const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
    grad.addColorStop(0, "rgba(0,0,0,0)");
    grad.addColorStop(1, "rgba(0,0,0,0.85)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  };
  img.onerror = () => {};
  img.src = cur.thumb_url || cur.url;
  cfReflection.appendChild(canvas);
}

cfPrev.addEventListener("click", () => {
  cfIndex = (cfIndex - 1 + cfImages.length) % cfImages.length;
  renderCF();
  resetAutoplay();
});

cfNext.addEventListener("click", () => {
  cfIndex = (cfIndex + 1) % cfImages.length;
  renderCF();
  resetAutoplay();
});

// keyboard nav when exhibition is active
document.addEventListener("keydown", (e) => {
  const panel = document.getElementById("tab-exhibition");
  if (panel && !panel.hidden) {
    if (e.key === "ArrowLeft")  { cfIndex = (cfIndex - 1 + cfImages.length) % cfImages.length; renderCF(); resetAutoplay(); }
    if (e.key === "ArrowRight") { cfIndex = (cfIndex + 1) % cfImages.length; renderCF(); resetAutoplay(); }
  }
});

// touch/swipe
let cfTouchX = null;
document.getElementById("coverflow").addEventListener("touchstart", e => { cfTouchX = e.touches[0].clientX; }, { passive: true });
document.getElementById("coverflow").addEventListener("touchend", e => {
  if (cfTouchX === null) return;
  const dx = e.changedTouches[0].clientX - cfTouchX;
  if (Math.abs(dx) > 40) {
    cfIndex = dx < 0
      ? (cfIndex + 1) % cfImages.length
      : (cfIndex - 1 + cfImages.length) % cfImages.length;
    renderCF();
    resetAutoplay();
  }
  cfTouchX = null;
});

function startAutoplay() {
  cfAutoplay = setInterval(() => {
    if (cfImages.length < 2) return;
    cfIndex = (cfIndex + 1) % cfImages.length;
    renderCF();
  }, 4000);
}

function resetAutoplay() {
  clearInterval(cfAutoplay);
  startAutoplay();
}

// ── SRH002 — Search filter ──

const searchInput = document.getElementById("searchInput");
const searchClear = document.getElementById("searchClear");

searchInput.addEventListener("input", () => {
  const q = searchInput.value.trim().toLowerCase();
  searchClear.classList.toggle("visible", q.length > 0);
  document.querySelectorAll(".gallery-item").forEach(item => {
    const name = (item.dataset.filename || "").toLowerCase();
    item.style.display = name.includes(q) ? "" : "none";
  });
});

searchClear.addEventListener("click", () => {
  searchInput.value = "";
  searchClear.classList.remove("visible");
  document.querySelectorAll(".gallery-item").forEach(item => item.style.display = "");
  searchInput.focus();
});

// ── Liquid Glass dynamic lighting ──
// Attaches per-element mousemove so overflow:hidden doesn't matter.
// Uses CSS custom props --mx/--my fed into a ::before pseudo-element.

function attachGlassLight(el) {
  if (el.dataset.glassLit) return;
  el.dataset.glassLit = "1";
  el.addEventListener("mousemove", (e) => {
    const r = el.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width  * 100).toFixed(1);
    const y = ((e.clientY - r.top)  / r.height * 100).toFixed(1);
    el.style.setProperty("--mx", x + "%");
    el.style.setProperty("--my", y + "%");
    el.classList.add("glass-lit");
  });
  el.addEventListener("mouseleave", () => el.classList.remove("glass-lit"));
}

function initGlassLights() {
  document.querySelectorAll(".glass-card, .glass-button, .glass-nav, .glass-search, .toggle-track").forEach(attachGlassLight);
}

// Run on load and after gallery renders
initGlassLights();

// Re-run after gallery items are added (MutationObserver)
new MutationObserver(initGlassLights).observe(
  document.getElementById("galleryGrid"),
  { childList: true }
);
