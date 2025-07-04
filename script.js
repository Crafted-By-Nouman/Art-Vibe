const canvas = document.querySelector("canvas"),
  toolBtns = document.querySelectorAll(".tool"),
  fillColor = document.querySelector("#fill-color"),
  sizeSlider = document.querySelector("#size-slider"),
  brushSizes = document.querySelectorAll(".brush-size"),
  colorBtns = document.querySelectorAll(".colors .option"),
  colorPicker = document.querySelector("#color-picker"),
  clearCanvas = document.querySelector(".clear-canvas"),
  saveImg = document.querySelector(".save-img"),
  undoBtn = document.querySelector("#undo-btn"),
  redoBtn = document.querySelector("#redo-btn"),
  zoomInBtn = document.querySelector("#zoom-in"),
  zoomOutBtn = document.querySelector("#zoom-out"),
  zoomResetBtn = document.querySelector("#zoom-reset"),
  opacitySlider = document.querySelector("#opacity-slider"),
  rectCornerSlider = document.querySelector("#rect-corner"),
  lineWidthSlider = document.querySelector("#line-width"),
  lineDashCheckbox = document.querySelector("#line-dash"),
  tooltip = document.querySelector("#tooltip"),
  shapeOptions = {
    rectangle: document.querySelector("#rectangle-options"),
    line: document.querySelector("#line-options"),
  },
  ctx = canvas.getContext("2d");

// State management
let prevMouseX,
  prevMouseY,
  snapshot,
  isDrawing = false,
  selectedTool = "brush",
  brushWidth = 5,
  selectedColor = "#000",
  globalOpacity = 1,
  history = [],
  historyIndex = -1,
  zoomLevel = 1,
  panOffset = { x: 0, y: 0 },
  isPanning = false,
  startPanPoint = { x: 0, y: 0 },
  textInput = null;

// Initialize canvas
const setCanvasBackground = () => {
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = selectedColor;
  saveState();
};

const initCanvas = () => {
  canvas.width = canvas.offsetWidth;
  canvas.height = canvas.offsetHeight;
  setCanvasBackground();
};

// Drawing functions
const drawRect = (e) => {
  const cornerRadius = parseInt(rectCornerSlider.value);
  const x = Math.min(e.offsetX, prevMouseX);
  const y = Math.min(e.offsetY, prevMouseY);
  const width = Math.abs(e.offsetX - prevMouseX);
  const height = Math.abs(e.offsetY - prevMouseY);

  ctx.beginPath();

  if (cornerRadius > 0) {
    ctx.moveTo(x + cornerRadius, y);
    ctx.lineTo(x + width - cornerRadius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + cornerRadius);
    ctx.lineTo(x + width, y + height - cornerRadius);
    ctx.quadraticCurveTo(
      x + width,
      y + height,
      x + width - cornerRadius,
      y + height
    );
    ctx.lineTo(x + cornerRadius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - cornerRadius);
    ctx.lineTo(x, y + cornerRadius);
    ctx.quadraticCurveTo(x, y, x + cornerRadius, y);
  } else {
    ctx.rect(x, y, width, height);
  }

  ctx.closePath();
  fillColor.checked ? ctx.fill() : ctx.stroke();
};

const drawCircle = (e) => {
  ctx.beginPath();
  const radius = Math.sqrt(
    Math.pow(prevMouseX - e.offsetX, 2) + Math.pow(prevMouseY - e.offsetY, 2)
  );
  ctx.arc(prevMouseX, prevMouseY, radius, 0, 2 * Math.PI);
  fillColor.checked ? ctx.fill() : ctx.stroke();
};

const drawTriangle = (e) => {
  ctx.beginPath();
  ctx.moveTo(prevMouseX, prevMouseY);
  ctx.lineTo(e.offsetX, e.offsetY);
  ctx.lineTo(prevMouseX * 2 - e.offsetX, e.offsetY);
  ctx.closePath();
  fillColor.checked ? ctx.fill() : ctx.stroke();
};

const drawLine = (e) => {
  ctx.beginPath();
  ctx.moveTo(prevMouseX, prevMouseY);
  ctx.lineTo(e.offsetX, e.offsetY);

  if (lineDashCheckbox.checked) {
    ctx.setLineDash([5, 5]);
  } else {
    ctx.setLineDash([]);
  }

  ctx.stroke();
  ctx.setLineDash([]); // Reset line dash
};

const addText = (e) => {
  if (textInput) return;

  textInput = document.createElement("div");
  textInput.contentEditable = true;
  textInput.style.position = "absolute";
  textInput.style.left = `${e.offsetX + canvas.offsetLeft}px`;
  textInput.style.top = `${e.offsetY + canvas.offsetTop}px`;
  textInput.style.minWidth = "100px";
  textInput.style.minHeight = "24px";
  textInput.style.padding = "4px 8px";
  textInput.style.border = "1px dashed #4A98F7";
  textInput.style.outline = "none";
  textInput.style.fontFamily = "Poppins, sans-serif";
  textInput.style.fontSize = `${brushWidth}px`;
  textInput.style.color = selectedColor;
  textInput.style.backgroundColor = "rgba(255, 255, 255, 0.7)";
  textInput.style.borderRadius = "4px";
  textInput.style.zIndex = "10";

  textInput.addEventListener("blur", () => {
    const text = textInput.innerText;
    if (text) {
      ctx.font = `${brushWidth}px Poppins`;
      ctx.fillStyle = selectedColor;
      ctx.globalAlpha = globalOpacity;
      ctx.fillText(text, e.offsetX, e.offsetY);
      saveState();
    }
    document.body.removeChild(textInput);
    textInput = null;
  });

  document.body.appendChild(textInput);
  textInput.focus();
};

// State management functions
const saveState = () => {
  // Remove any states after current index (for redo)
  if (historyIndex < history.length - 1) {
    history = history.slice(0, historyIndex + 1);
  }

  // Save current canvas state
  history.push(canvas.toDataURL());
  historyIndex++;

  // Limit history to 50 states
  if (history.length > 50) {
    history.shift();
    historyIndex--;
  }

  updateUndoRedoButtons();
};

const undo = () => {
  if (historyIndex <= 0) return;
  historyIndex--;
  loadState();
};

const redo = () => {
  if (historyIndex >= history.length - 1) return;
  historyIndex++;
  loadState();
};

const loadState = () => {
  const img = new Image();
  img.onload = () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0);
  };
  img.src = history[historyIndex];
  updateUndoRedoButtons();
};

const updateUndoRedoButtons = () => {
  undoBtn.disabled = historyIndex <= 0;
  redoBtn.disabled = historyIndex >= history.length - 1;
};

// Zoom and pan functions
const applyZoomAndPan = () => {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.translate(panOffset.x, panOffset.y);
  ctx.scale(zoomLevel, zoomLevel);

  // Redraw from history
  if (history.length > 0) {
    const img = new Image();
    img.onload = () => {
      ctx.drawImage(img, 0, 0);
    };
    img.src = history[historyIndex];
  } else {
    setCanvasBackground();
  }
};

const zoom = (direction) => {
  const factor = direction === "in" ? 1.2 : 0.8;
  const newZoom = zoomLevel * factor;

  // Limit zoom levels
  if (newZoom < 0.1 || newZoom > 10) return;

  zoomLevel = newZoom;
  applyZoomAndPan();
};

const resetZoom = () => {
  zoomLevel = 1;
  panOffset = { x: 0, y: 0 };
  applyZoomAndPan();
};

// Event handlers
const startDraw = (e) => {
  if (selectedTool === "text") {
    addText(e);
    return;
  }

  isDrawing = true;
  prevMouseX = e.offsetX;
  prevMouseY = e.offsetY;
  ctx.beginPath();
  ctx.lineWidth = brushWidth;
  ctx.strokeStyle = selectedTool === "eraser" ? "#fff" : selectedColor;
  ctx.fillStyle = selectedColor;
  ctx.globalAlpha = globalOpacity;
  snapshot = ctx.getImageData(0, 0, canvas.width, canvas.height);

  // For tools that draw immediately on click
  if (selectedTool === "brush" || selectedTool === "eraser") {
    ctx.moveTo(prevMouseX, prevMouseY);
    ctx.lineTo(prevMouseX, prevMouseY);
    ctx.stroke();
  }
};

const drawing = (e) => {
  if (!isDrawing || selectedTool === "text") return;

  ctx.putImageData(snapshot, 0, 0);

  switch (selectedTool) {
    case "brush":
    case "eraser":
      ctx.lineTo(e.offsetX, e.offsetY);
      ctx.stroke();
      break;
    case "rectangle":
      drawRect(e);
      break;
    case "circle":
      drawCircle(e);
      break;
    case "triangle":
      drawTriangle(e);
      break;
    case "line":
      drawLine(e);
      break;
  }
};

const stopDraw = () => {
  if (isDrawing && selectedTool !== "text") {
    saveState();
  }
  isDrawing = false;
};

const showTooltip = (e, text) => {
  tooltip.textContent = text;
  tooltip.style.left = `${e.pageX + 10}px`;
  tooltip.style.top = `${e.pageY + 10}px`;
  tooltip.style.opacity = "1";
};

const hideTooltip = () => {
  tooltip.style.opacity = "0";
};

// Initialize
window.addEventListener("load", initCanvas);
window.addEventListener("resize", () => {
  // Save current content before resizing
  const tempCanvas = document.createElement("canvas");
  const tempCtx = tempCanvas.getContext("2d");
  tempCanvas.width = canvas.width;
  tempCanvas.height = canvas.height;
  tempCtx.drawImage(canvas, 0, 0);

  initCanvas();

  // Restore content after resizing
  ctx.drawImage(tempCanvas, 0, 0);
});

// Tool selection
toolBtns.forEach((btn) => {
  btn.addEventListener("click", () => {
    // Hide all shape options
    Object.values(shapeOptions).forEach((option) =>
      option.classList.remove("active")
    );

    // Show options for selected shape tool
    if (shapeOptions[btn.id]) {
      shapeOptions[btn.id].classList.add("active");
    }

    document.querySelector(".options .active").classList.remove("active");
    btn.classList.add("active");
    selectedTool = btn.id;
  });

  // Tooltips
  btn.addEventListener("mouseover", (e) => {
    showTooltip(e, btn.getAttribute("title"));
  });
  btn.addEventListener("mouseout", hideTooltip);
});

// Brush size selection
sizeSlider.addEventListener("input", () => {
  brushWidth = sizeSlider.value;
  // Update active brush size indicator
  brushSizes.forEach((size) => size.classList.remove("active"));
});

brushSizes.forEach((size) => {
  size.addEventListener("click", () => {
    brushWidth = parseInt(size.dataset.size);
    sizeSlider.value = brushWidth;
    brushSizes.forEach((s) => s.classList.remove("active"));
    size.classList.add("active");
  });
});

// Color selection
colorBtns.forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelector(".options .selected").classList.remove("selected");
    btn.classList.add("selected");
    selectedColor = window
      .getComputedStyle(btn)
      .getPropertyValue("background-color");
  });
});

colorPicker.addEventListener("change", () => {
  colorPicker.parentElement.style.background = colorPicker.value;
  colorPicker.parentElement.click();
});

// Opacity control
opacitySlider.addEventListener("input", () => {
  globalOpacity = opacitySlider.value / 100;
});

// Canvas actions
clearCanvas.addEventListener("click", () => {
  if (confirm("Are you sure you want to clear the canvas?")) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setCanvasBackground();
    history = [];
    historyIndex = -1;
    updateUndoRedoButtons();
  }
});

saveImg.addEventListener("click", () => {
  const link = document.createElement("a");
  link.download = `drawing-${new Date().toISOString().slice(0, 10)}.png`;

  // Create a temporary canvas to add white background if needed
  const tempCanvas = document.createElement("canvas");
  const tempCtx = tempCanvas.getContext("2d");
  tempCanvas.width = canvas.width;
  tempCanvas.height = canvas.height;

  // Fill with white background
  tempCtx.fillStyle = "#fff";
  tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);

  // Draw the original canvas content
  tempCtx.drawImage(canvas, 0, 0);

  link.href = tempCanvas.toDataURL("image/png");
  link.click();
});

// Undo/redo
undoBtn.addEventListener("click", undo);
redoBtn.addEventListener("click", redo);

// Keyboard shortcuts
document.addEventListener("keydown", (e) => {
  if (e.ctrlKey && e.key === "z") {
    e.preventDefault();
    undo();
  } else if (e.ctrlKey && e.key === "y") {
    e.preventDefault();
    redo();
  } else if (e.key === "Delete" || e.key === "Backspace") {
    if (textInput) {
      document.body.removeChild(textInput);
      textInput = null;
    }
  }
});

// Zoom controls
zoomInBtn.addEventListener("click", () => zoom("in"));
zoomOutBtn.addEventListener("click", () => zoom("out"));
zoomResetBtn.addEventListener("click", resetZoom);

// Mouse wheel zoom
canvas.addEventListener("wheel", (e) => {
  e.preventDefault();
  if (e.ctrlKey) {
    const direction = e.deltaY < 0 ? "in" : "out";
    zoom(direction);
  }
});

// Panning
canvas.addEventListener("mousedown", (e) => {
  if (e.button === 1 || (e.button === 0 && e.ctrlKey)) {
    // Middle click or Ctrl+Left click
    isPanning = true;
    startPanPoint = {
      x: e.clientX - panOffset.x,
      y: e.clientY - panOffset.y,
    };
    canvas.style.cursor = "grabbing";
    e.preventDefault();
  }
});

document.addEventListener("mousemove", (e) => {
  if (isPanning) {
    panOffset.x = e.clientX - startPanPoint.x;
    panOffset.y = e.clientY - startPanPoint.y;
    applyZoomAndPan();
  }
});

document.addEventListener("mouseup", () => {
  if (isPanning) {
    isPanning = false;
    canvas.style.cursor = "crosshair";
  }
});

// Prevent default for middle click scrolling
canvas.addEventListener("mousedown", (e) => {
  if (e.button === 1) e.preventDefault();
});

// Canvas drawing events
canvas.addEventListener("mousedown", startDraw);
canvas.addEventListener("mousemove", drawing);
canvas.addEventListener("mouseup", stopDraw);
canvas.addEventListener("mouseout", stopDraw);

// Touch support
canvas.addEventListener("touchstart", (e) => {
  e.preventDefault();
  const touch = e.touches[0];
  const mouseEvent = new MouseEvent("mousedown", {
    clientX: touch.clientX,
    clientY: touch.clientY,
  });
  canvas.dispatchEvent(mouseEvent);
});

canvas.addEventListener("touchmove", (e) => {
  e.preventDefault();
  const touch = e.touches[0];
  const mouseEvent = new MouseEvent("mousemove", {
    clientX: touch.clientX,
    clientY: touch.clientY,
  });
  canvas.dispatchEvent(mouseEvent);
});

canvas.addEventListener("touchend", (e) => {
  e.preventDefault();
  const mouseEvent = new MouseEvent("mouseup");
  canvas.dispatchEvent(mouseEvent);
});

window.addEventListener("DOMContentLoaded", () => {
  if (window.innerWidth < 768) {
    const modal = document.getElementById("mobile-modal");
    if (modal) modal.style.display = "flex";
    document.body.style.overflow = "hidden"; // prevent scrolling
  }
});
