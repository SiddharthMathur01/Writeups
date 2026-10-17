(function () {
  "use strict";

  var root = document.getElementById("ctf-desktop");
  if (!root) return;

  var workspace = document.getElementById("desktop-workspace");
  var dock = document.getElementById("desktop-dock");
  var appMenu = document.getElementById("desktop-app-menu");
  var contextMenu = document.getElementById("desktop-context-menu");
  var windowNodes = Array.prototype.slice.call(root.querySelectorAll("[data-window-id]"));
  var zIndex = 20;
  var activeWorkspace = "1", terminalSequence = 1;
  terminalSequence = windowNodes.filter(function (node) { return node.dataset.windowType === "terminal"; }).length;
  var dragState = null, iconDragState = null;
  var fileItems = [];
  var music = { audio: document.getElementById("desktop-ambient-audio"), playing: false, timer: null };
  var tracks = [
    { id: "ambient-research", title: "Ambient research", style: "Calm ambient synth", src: "ambient-research.ogg", duration: 90 },
    { id: "lofi-circuit", title: "Lo-fi circuit", style: "Lo-fi coding instrumental", src: "lofi-circuit.ogg", duration: 60 },
    { id: "minimal-signal", title: "Minimal signal", style: "Atmospheric electronic", src: "minimal-signal.ogg", duration: 60 },
    { id: "soft-keys", title: "Soft keys", style: "Gentle piano ambient", src: "soft-keys.ogg", duration: 60 },
    { id: "orbital-drift", title: "Orbital drift", style: "Space-inspired ambient", src: "orbital-drift.ogg", duration: 60 },
    { id: "focus-field", title: "Focus field", style: "Soft focus / study", src: "focus-field.ogg", duration: 60 }
  ];
  var audioBase = new URL("assets/audio/", document.baseURI).href;
  var currentTrack = 0, hideDockTimer = null;

  try {
    fileItems = JSON.parse(document.getElementById("shell").dataset.writeups || "[]").map(function (item) {
      return Object.assign({}, item, { path: item.path || String(item.url || "").replace(/^\/+|\/+$/g, "") });
    });
  } catch (_) {}
  function runTerminalCommand(command, animated, terminalWindow) {
    var win = terminalWindow || windowNodes.filter(function (node) { return node.dataset.windowType === "terminal" && node.dataset.workspaceId === activeWorkspace && node.dataset.open === "true" && !node.hidden; }).slice(-1)[0];
    if (!win) win = createTerminal();
    if (!win) return;
    if (window.CTFLAB && typeof window.CTFLAB.runCommand === "function") window.CTFLAB.runCommand(command, animated !== false, win.querySelector(".shell"));
    focusWindow(win);
  }

  var wallpaperChoices = [], wallpaperSequence = 0;
  var wallpaperBase = new URL(root.dataset.wallpaperBase || "assets/wallpapers/ml4w/", document.baseURI).href;
  function updateDockAccent(imageUrl, requestId) {
    var sampleImage = new Image();
    sampleImage.onload = function () {
      if (requestId !== wallpaperSequence) return;
      try {
        var canvas = document.createElement("canvas"), context = canvas.getContext("2d", { willReadFrequently:true });
        canvas.width = 36; canvas.height = 36;
        context.drawImage(sampleImage, 0, 0, canvas.width, canvas.height);
        var pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
        var best = null, bestScore = -1;
        for (var i = 0; i < pixels.length; i += 16) {
          var r = pixels[i] / 255, g = pixels[i + 1] / 255, b = pixels[i + 2] / 255;
          var max = Math.max(r, g, b), min = Math.min(r, g, b), light = (max + min) / 2;
          var saturation = max === min ? 0 : (max - min) / (1 - Math.abs(2 * light - 1));
          if (light < .16 || light > .82 || saturation < .23) continue;
          var score = saturation * (1 - Math.abs(light - .52));
          if (score > bestScore) { bestScore = score; best = [r, g, b]; }
        }
        if (!best) best = [.43, .82, .58];
        var max = Math.max.apply(null, best), min = Math.min.apply(null, best), light = (max + min) / 2;
        var sat = max === min ? .62 : (max - min) / (1 - Math.abs(2 * light - 1));
        light = Math.max(.58, Math.min(.70, light)); sat = Math.max(.58, Math.min(.82, sat));
        var hue;
        if (max === min) hue = 145;
        else if (max === best[0]) hue = ((best[1] - best[2]) / (max - min) + (best[1] < best[2] ? 6 : 0)) * 60;
        else if (max === best[1]) hue = ((best[2] - best[0]) / (max - min) + 2) * 60;
        else hue = ((best[0] - best[1]) / (max - min) + 4) * 60;
        var c = (1 - Math.abs(2 * light - 1)) * sat, x = c * (1 - Math.abs((hue / 60) % 2 - 1)), m = light - c / 2;
        var rgb = hue < 60 ? [c,x,0] : hue < 120 ? [x,c,0] : hue < 180 ? [0,c,x] : hue < 240 ? [0,x,c] : hue < 300 ? [x,0,c] : [c,0,x];
        rgb = rgb.map(function (v) { return Math.round((v + m) * 255); });
        root.style.setProperty("--dock-accent", "rgb(" + rgb.join(",") + ")");
        root.style.setProperty("--dock-accent-soft", "rgba(" + rgb.join(",") + ",.17)");
        root.style.setProperty("--dock-accent-glow", "rgba(" + rgb.join(",") + ",.46)");
      } catch (_) {}
    };
    sampleImage.src = imageUrl;
  }
  function wallpaperAsset(path) {
    return new URL(String(path || "").split("/").map(encodeURIComponent).join("/"), wallpaperBase).href;
  }
  function setWallpaper(name) {
    if (!wallpaperChoices.length) return;
    if (!wallpaperChoices.some(function (choice) { return choice.id === name; })) name = wallpaperChoices[0].id;
    root.dataset.wallpaper = name;
    var selected = wallpaperChoices.find(function (choice) { return choice.id === name; });
    var wallpaper = document.getElementById("desktop-wallpaper");
    if (wallpaper) wallpaper.style.backgroundImage = selected ? 'linear-gradient(rgba(7,12,12,.18),rgba(7,12,12,.18)),url("' + wallpaperAsset(selected.full) + '")' : "";
    if (wallpaper) { wallpaper.style.backgroundSize = "cover"; wallpaper.style.backgroundPosition = "center center"; wallpaper.style.backgroundRepeat = "no-repeat"; }
    var requestId = ++wallpaperSequence, imageCheck = new Image();
    if (selected) updateDockAccent(wallpaperAsset(selected.thumbnail), requestId);
    imageCheck.onerror = function () {
      if (requestId !== wallpaperSequence || root.dataset.wallpaper !== name) return;
      if (isDevelopment()) console.error("CTF-LAB wallpaper failed to load:", wallpaperAsset(selected.full), "(id:", name + ")");
      var fallback = wallpaperChoices.find(function (choice) { return choice.id !== name; });
      if (fallback) setWallpaper(fallback.id);
      else if (wallpaper) wallpaper.style.backgroundImage = "";
    };
    imageCheck.src = wallpaperAsset(selected.full);
    try { localStorage.setItem("ctf-desktop-wallpaper", name); } catch (_) {}
    root.querySelectorAll("[data-wallpaper]").forEach(function (button) {
      button.setAttribute("aria-pressed", String(button.dataset.wallpaper === name));
    });
    var preview = dock.querySelector("[data-wallpaper-preview]"), label = dock.querySelector("[data-wallpaper-name]"), current = dock.querySelector("[data-wallpaper-current]");
    if (preview) {
      preview.dataset.error = "false"; preview.alt = "";
      preview.onerror = function () { this.dataset.error = "true"; if (isDevelopment()) console.error("CTF-LAB wallpaper thumbnail failed to load:", wallpaperAsset(selected.thumbnail), "(id:", name + ")"); };
      preview.onload = function () { this.dataset.error = "false"; };
      preview.src = wallpaperAsset(selected.thumbnail);
    }
    if (label) label.textContent = selected.name;
    if (current) { current.title = selected.name; current.setAttribute("aria-label", "Current wallpaper: " + selected.name + ". Open wallpaper settings"); }
  }
  function isDevelopment() { return /^(localhost|127\.0\.0\.1|\[::1\])$/i.test(location.hostname); }
  fetch(new URL("catalog.json", wallpaperBase).href).then(function (response) { if (!response.ok) throw new Error("Wallpaper catalog unavailable: HTTP " + response.status); return response.json(); }).then(function (manifest) {
    wallpaperChoices = manifest.map(function (item) { return { id:item.id, name:item.name, category:item.category || "ML4W", full:item.full, thumbnail:item.thumbnail }; }).filter(function (item) { return item.id && item.full && item.thumbnail; });
    var saved = null; try { saved = localStorage.getItem("ctf-desktop-wallpaper"); } catch (_) {}
    setWallpaper(wallpaperChoices.some(function (choice) { return choice.id === saved; }) ? saved : (wallpaperChoices.some(function (choice) { return choice.id === "ml4w-desert-moon"; }) ? "ml4w-desert-moon" : wallpaperChoices[0].id));
    windowNodes.filter(function (win) { return win.dataset.windowType === "settings"; }).forEach(function (win) { renderSettings("wallpaper", win); });
    var index = wallpaperChoices.findIndex(function (choice) { return choice.id === root.dataset.wallpaper; });
    [wallpaperChoices[(index - 1 + wallpaperChoices.length) % wallpaperChoices.length], wallpaperChoices[(index + 1) % wallpaperChoices.length]].forEach(function (choice) { var image = new Image(); image.src = wallpaperAsset(choice.full); });
    }).catch(function (error) { console.error("CTF-LAB wallpaper catalog failed:", error); });

  function persistWindow(win) {
    var rect = win.getBoundingClientRect(), area = workspace.getBoundingClientRect();
    if (!area.width || !area.height) return;
    try {
      localStorage.setItem("ctf-desktop-window-" + win.dataset.windowId, JSON.stringify({
        x: rect.left - area.left, y: rect.top - area.top, w: rect.width, h: rect.height,
        rw: rect.width / area.width, rh: rect.height / area.height,
        rx: (rect.left - area.left) / area.width, ry: (rect.top - area.top) / area.height
      }));
    } catch (_) {}
  }
  function restoreWindowGeometry(win) {
    var id = win.dataset.windowId, saved = null, area = workspace.getBoundingClientRect();
    try { saved = JSON.parse(localStorage.getItem("ctf-desktop-window-" + id) || "null"); } catch (_) {}
    if (!saved || !area.width || !area.height) return;
    var type = win.dataset.windowType, minLeft = type === "terminal" ? terminalIconRail(area.width) : 0;
    var caps = { terminal: [1260, 780], files: [1080, 700], settings: [760, 620], music: [520, 680] }[type] || [1100, 760];
    var width = Math.min(Math.max(0, area.width - minLeft), caps[0], Math.max(300, saved.rw * area.width));
    var height = Math.min(area.height, caps[1], Math.max(250, saved.rh * area.height));
    var left = Math.max(minLeft, Math.min(area.width - width, saved.rx * area.width));
    var top = Math.max(0, Math.min(area.height - height, saved.ry * area.height));
    win.style.left = left + "px"; win.style.top = top + "px";
    win.style.width = width + "px"; win.style.height = height + "px";
  }
  function findWindow(type, workspaceId) {
    var candidates = windowNodes.filter(function (node) { return node.dataset.windowType === type && (node.dataset.workspaceId === String(workspaceId) || node.dataset.workspaceId === "all"); });
    return candidates.find(function (node) { return node.dataset.open === "true" && !node.hidden; }) || candidates[candidates.length - 1] || null;
  }
  function createWindowInstance(type, workspaceId) {
    var template = windowNodes.find(function (node) { return node.dataset.windowType === type; });
    if (!template) return null;
    var instance = type === "terminal" ? ++terminalSequence : windowNodes.filter(function (node) { return node.dataset.windowType === type; }).length + 1;
    var clone = template.cloneNode(true), suffix = type + "-" + instance, idMap = new Map();
    clone.id = "window-" + suffix; clone.dataset.windowId = suffix; clone.dataset.windowType = type;
    clone.querySelectorAll("[id]").forEach(function (node) { var oldId = node.id, newId = oldId + "-" + instance; idMap.set(oldId, newId); node.id = newId; });
    clone.querySelectorAll("[for],[aria-labelledby],[aria-describedby],[aria-controls]").forEach(function (node) {
      ["for", "aria-labelledby", "aria-describedby", "aria-controls"].forEach(function (attribute) {
        var value = node.getAttribute(attribute); if (!value) return;
        node.setAttribute(attribute, value.split(/\s+/).map(function (id) { return idMap.get(id) || id; }).join(" "));
      });
    });
    clone.dataset.workspaceId = String(workspaceId); clone.dataset.open = "false"; clone.dataset.minimized = "false"; clone.dataset.focused = "false";
    clone.dataset.positioned = "false"; clone.hidden = true; clone.removeAttribute("data-maximized"); clone.style.cssText = "";
    if (type === "terminal") {
      clone.dataset.instanceId = String(instance); clone.setAttribute("aria-label", "Terminal " + instance + " window");
      var title = clone.querySelector(".window-title"); if (title && title.firstChild) title.firstChild.nodeValue = "Terminal " + instance + " ";
      var shell = clone.querySelector(".shell");
      if (shell) {
        shell.dataset.ready = "";
        shell.classList.remove("shell--intro-typing");
        shell.querySelectorAll(".shell__entry,.shell__intro").forEach(function (node) { node.remove(); });
        var skipIntro = shell.querySelector(".shell__skip"); if (skipIntro) skipIntro.hidden = true;
        var input = shell.querySelector(".shell__input"); if (input) { input.disabled = false; input.value = ""; }
      }
    }
    workspace.appendChild(clone); windowNodes.push(clone);
    if (type === "terminal") {
      var area = workspace.getBoundingClientRect(), sourceRect = template.getBoundingClientRect(), newRect = clone.getBoundingClientRect(), rail = terminalIconRail(area.width);
      clone.hidden = false; clone.dataset.open = "true";
      var width = parseFloat(template.style.width) || sourceRect.width || newRect.width || Math.min(area.width * .76, 1260);
      var height = parseFloat(template.style.height) || sourceRect.height || newRect.height || Math.min(area.height * .72, 780);
      var cascade = (instance - 1) * 24;
      var sourceLeft = sourceRect.width ? sourceRect.left - area.left : rail + 12;
      var sourceTop = sourceRect.height ? sourceRect.top - area.top : 12;
      clone.style.left = Math.max(rail, Math.min(area.width - width, sourceLeft + cascade)) + "px";
      clone.style.top = Math.max(0, Math.min(area.height - height, sourceTop + cascade)) + "px";
      clone.style.width = Math.min(width, area.width - rail) + "px"; clone.style.height = height + "px";
      clone.dataset.positioned = "true";
      if (window.CTFLAB && window.CTFLAB.initSession) window.CTFLAB.initSession(shell, { newSession: true });
    } else if (type === "files") {
      clone.setAttribute("aria-label", "File Manager " + instance + " window");
      var fileTitle = clone.querySelector(".window-title");
      if (fileTitle && fileTitle.firstChild) fileTitle.firstChild.nodeValue = "File Manager " + instance + " ";
    }
    return clone;
  }
  function updateDock() {
    dock.querySelectorAll("[data-task-app]").forEach(function (button) {
      var type = button.dataset.taskApp;
      if (type === "writeups") { button.dataset.running = "false"; button.dataset.focused = "false"; button.setAttribute("aria-pressed", "false"); return; }
      if (type === "terminal") {
        var terminals = windowNodes.filter(function (node) { return node.dataset.windowType === "terminal" && node.dataset.workspaceId === activeWorkspace && node.dataset.open === "true"; });
        button.dataset.running = String(terminals.length > 0);
        button.dataset.focused = String(terminals.some(function (node) { return node.dataset.focused === "true" && !node.hidden; }));
        var count = button.querySelector("[data-terminal-count]"); if (count) { count.textContent = terminals.length > 1 ? String(terminals.length) : ""; count.hidden = terminals.length < 2; }
        button.setAttribute("aria-label", terminals.length > 1 ? "Terminal, " + terminals.length + " windows on workspace " + activeWorkspace : "Terminal");
        button.title = terminals.length > 1 ? terminals.length + " terminal windows · open a new terminal" : "Open a new terminal";
      } else if (type === "files") {
        var explorers = windowNodes.filter(function (node) { return node.dataset.windowType === "files" && node.dataset.workspaceId === activeWorkspace && node.dataset.open === "true"; });
        button.dataset.running = String(explorers.length > 0);
        button.dataset.focused = String(explorers.some(function (node) { return node.dataset.focused === "true" && !node.hidden; }));
        button.setAttribute("aria-label", explorers.length > 1 ? "File Manager, " + explorers.length + " windows on workspace " + activeWorkspace : "File Manager");
        button.title = explorers.length > 1 ? explorers.length + " File Manager windows · open another window" : "Open a new File Manager window";
      } else {
        var win = findWindow(type, type === "music" ? "all" : activeWorkspace);
        button.dataset.running = String(!!win && win.dataset.open === "true");
        button.dataset.focused = String(!!win && win.dataset.focused === "true" && !win.hidden);
      }
      button.setAttribute("aria-pressed", button.dataset.focused);
    });
  }
  function applyWorkspace(id) {
    id = String(id); if (["1", "2", "3"].indexOf(id) < 0) return;
    activeWorkspace = id; root.dataset.activeWorkspace = id;
    try { localStorage.setItem("ctf-desktop-workspace", id); } catch (_) {}
    root.querySelectorAll("[data-workspace]").forEach(function (button) {
      var active = button.dataset.workspace === id; button.classList.toggle("workspace-switcher__active", active); button.setAttribute("aria-pressed", String(active));
    });
    windowNodes.forEach(function (win) {
      var inWorkspace = win.dataset.workspaceId === id || win.dataset.workspaceId === "all";
      win.hidden = !inWorkspace || win.dataset.open !== "true" || win.dataset.minimized === "true";
      if (!inWorkspace) win.dataset.focused = "false";
    });
    updateDock();
  }
  function focusWindow(win) {
    if (!win) return;
    if (win.dataset.workspaceId !== "all" && win.dataset.workspaceId !== activeWorkspace) applyWorkspace(win.dataset.workspaceId);
    zIndex += 1;
    win.style.zIndex = String(zIndex);
    windowNodes.forEach(function (node) { node.dataset.focused = String(node === win); });
    updateDock();
  }
  function openWindow(id) {
    if (id === "terminal") return createTerminal();
    var win;
    if (id === "files") {
      var hasOpenExplorer = windowNodes.some(function (node) { return node.dataset.windowType === "files" && node.dataset.workspaceId === activeWorkspace && node.dataset.open === "true" && !node.hidden; });
      win = hasOpenExplorer ? createWindowInstance("files", activeWorkspace) : findWindow("files", activeWorkspace);
    } else win = findWindow(id, id === "music" ? "all" : activeWorkspace);
    if (!win && id !== "music") win = createWindowInstance(id, activeWorkspace);
    if (!win) win = findWindow(id, "all");
    if (!win) return null;
    if (win.hidden) {
      win.hidden = false; win.dataset.open = "true";
      if (!win.dataset.positioned) { restoreWindowGeometry(win); win.dataset.positioned = "true"; }
      if (id === "files") renderFiles(null, win);
      if (id === "settings") renderSettings(win.querySelector("[data-settings-tab].is-selected")?.dataset.settingsTab || "wallpaper", win);
    }
    win.dataset.minimized = "false";
    focusWindow(win);
    appMenu.hidden = true; contextMenu.hidden = true;
    return win;
  }
  function createTerminal() {
    var win = createWindowInstance("terminal", activeWorkspace);
    if (!win) return null;
    focusWindow(win); updateDock();
    var input = win.querySelector(".shell__input"); if (input) input.focus({ preventScroll: true });
    appMenu.hidden = true; contextMenu.hidden = true;
    return win;
  }
  function hideWindow(win, state) {
    if (!win) return;
    persistWindow(win);
    win.hidden = true;
    win.dataset.focused = "false";
    if (state === "close") win.dataset.open = "false";
    win.dataset.minimized = String(state === "minimize");
    updateDock();
  }
  function toggleMaximize(win) {
    if (win.dataset.maximized === "true") {
      var previous = win._previousGeometry;
      win.dataset.maximized = "false";
      updateMaximizedIconBackdrop(win);
      if (previous) {
        win.style.left = previous.left; win.style.top = previous.top;
        win.style.width = previous.width; win.style.height = previous.height;
      } else restoreWindowGeometry(win);
      persistWindow(win);
    } else {
      win._previousGeometry = { left: win.style.left, top: win.style.top, width: win.style.width, height: win.style.height };
      if (!win.style.width) {
        var rect = win.getBoundingClientRect(), area = workspace.getBoundingClientRect();
        win.style.left = (rect.left - area.left) + "px"; win.style.top = (rect.top - area.top) + "px";
        win.style.width = rect.width + "px"; win.style.height = rect.height + "px";
      }
      win.dataset.maximized = "true";
      updateMaximizedIconBackdrop(win);
    }
    focusWindow(win);
  }
  function updateMaximizedIconBackdrop(win) {
    win.querySelectorAll(":scope > .desktop-icon-backdrop").forEach(function (node) { node.remove(); });
    if (win.dataset.maximized !== "true") return;
    var layer = workspace.querySelector(".desktop-icons");
    if (!layer) return;
    var backdrop = layer.cloneNode(true);
    backdrop.removeAttribute("id");
    backdrop.className = "desktop-icons--positioned desktop-icon-backdrop";
    backdrop.setAttribute("aria-hidden", "true");
    backdrop.setAttribute("inert", "");
    win.insertBefore(backdrop, win.firstChild);
  }
  function minSize(win) {
    if (window.matchMedia("(max-width: 800px)").matches) return { w: 290, h: 260 };
    return win.dataset.windowType === "terminal" ? { w: 420, h: 280 } : { w: 330, h: 270 };
  }
  function clampWindow(win) {
    var area = workspace.getBoundingClientRect(), rect = win.getBoundingClientRect();
    var maxW = area.width, maxH = area.height, min = minSize(win);
    var minLeft = 0;
    maxW = Math.max(0, area.width - minLeft);
    var width = Math.max(Math.min(min.w, maxW), Math.min(rect.width, maxW));
    var height = Math.max(Math.min(min.h, maxH), Math.min(rect.height, maxH));
    var left = Math.max(minLeft, Math.min(area.width - width, rect.left - area.left));
    var top = Math.max(0, Math.min(area.height - height, rect.top - area.top));
    win.style.left = left + "px"; win.style.top = top + "px";
    win.style.width = width + "px"; win.style.height = height + "px";
  }
  function startPointer(event, win, mode) {
    if (event.button !== 0 || win.dataset.maximized === "true") return;
    var area = workspace.getBoundingClientRect(), rect = win.getBoundingClientRect();
    dragState = { win: win, mode: mode, pointerX: event.clientX, pointerY: event.clientY,
      left: rect.left - area.left, top: rect.top - area.top, width: rect.width, height: rect.height,
      bounds: area, min: minSize(win) };
    focusWindow(win);
    if (event.currentTarget.setPointerCapture) event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
  }
  root.addEventListener("pointerdown", function (event) {
    var resize = event.target.closest("[data-resize]");
    if (resize) { startPointer(event, resize.closest("[data-window-id]"), resize.dataset.resize); return; }
    var handle = event.target.closest("[data-drag-handle]");
    if (handle && !event.target.closest("button")) startPointer(event, handle.closest("[data-window-id]"), "move");
    else {
      var win = event.target.closest("[data-window-id]");
      if (win && !win.hidden) focusWindow(win);
    }
  });
  document.addEventListener("pointermove", function (event) {
    if (!dragState) return;
    var s = dragState, dx = event.clientX - s.pointerX, dy = event.clientY - s.pointerY;
    var x = s.left, y = s.top, w = s.width, h = s.height, mode = s.mode;
    if (mode === "move") { x += dx; y += dy; }
    else {
      if (mode.indexOf("e") >= 0) w += dx;
      if (mode.indexOf("s") >= 0) h += dy;
      if (mode.indexOf("w") >= 0) { x += dx; w -= dx; }
      if (mode.indexOf("n") >= 0) { y += dy; h -= dy; }
      if (w < s.min.w) { if (mode.indexOf("w") >= 0) x -= s.min.w - w; w = s.min.w; }
      if (h < s.min.h) { if (mode.indexOf("n") >= 0) y -= s.min.h - h; h = s.min.h; }
      if (x < 0 && mode.indexOf("w") >= 0) { w += x; x = 0; }
      if (y < 0 && mode.indexOf("n") >= 0) { h += y; y = 0; }
      if (x + w > s.bounds.width) w = s.bounds.width - x;
      if (y + h > s.bounds.height) h = s.bounds.height - y;
    }
    if (mode === "move") {
      var minLeft = 0;
      x = Math.max(minLeft, Math.min(s.bounds.width - w, x));
      y = Math.max(0, Math.min(s.bounds.height - h, y));
    } else {
      var resizeMinLeft = 0;
      x = Math.max(resizeMinLeft, x); y = Math.max(0, y);
      w = Math.max(Math.min(s.min.w, s.bounds.width), Math.min(s.bounds.width - x, w));
      h = Math.max(Math.min(s.min.h, s.bounds.height), Math.min(s.bounds.height - y, h));
    }
    s.win.style.left = x + "px"; s.win.style.top = y + "px";
    s.win.style.width = w + "px"; s.win.style.height = h + "px";
  });
  document.addEventListener("pointerup", function () {
    if (iconDragState) {
      var state = iconDragState; iconDragState = null;
      state.icon.classList.remove("is-dragging");
      if (state.moved) {
        var iconArea = workspace.getBoundingClientRect(), iconLeft = parseFloat(state.icon.style.left) || 0, iconTop = parseFloat(state.icon.style.top) || 0;
        state.icon.dataset.desktopIconX = String(iconLeft / Math.max(1, iconArea.width));
        state.icon.dataset.desktopIconY = String(iconTop / Math.max(1, iconArea.height));
        try { localStorage.setItem("ctf-desktop-icon-" + state.icon.dataset.desktopIconKey, JSON.stringify({ x: iconLeft / Math.max(1, iconArea.width), y: iconTop / Math.max(1, iconArea.height) })); } catch (_) {}
        state.icon._suppressClick = true;
        window.setTimeout(function () { state.icon._suppressClick = false; }, 0);
      }
    }
    if (!dragState) return;
    persistWindow(dragState.win); dragState = null;
  });
  window.addEventListener("resize", function () {
    windowNodes.forEach(function (win) { if (!win.hidden && win.dataset.maximized !== "true") clampWindow(win); });
    var iconArea = workspace.getBoundingClientRect();
    root.querySelectorAll(".desktop-icon[data-desktop-icon-key]").forEach(function (icon) {
      var x = (Number(icon.dataset.desktopIconX) || 0) * iconArea.width, y = (Number(icon.dataset.desktopIconY) || 0) * iconArea.height;
      icon.style.left = Math.max(0, Math.min(iconArea.width - icon.offsetWidth, x)) + "px";
      icon.style.top = Math.max(0, Math.min(iconArea.height - icon.offsetHeight, y)) + "px";
    });
  });
  root.addEventListener("dblclick", function (event) {
    var title = event.target.closest("[data-drag-handle]");
    if (title && !event.target.closest("button")) toggleMaximize(title.closest("[data-window-id]"));
  });
  root.addEventListener("click", function (event) {
    var action = event.target.closest("[data-window-action]");
    if (action) {
      var win = action.closest("[data-window-id]");
      if (action.dataset.windowAction === "minimize") hideWindow(win, "minimize");
      if (action.dataset.windowAction === "close") hideWindow(win, "close");
      if (action.dataset.windowAction === "maximize") toggleMaximize(win);
      return;
    }
    var directory = event.target.closest("[data-open-directory]");
    if (directory) {
      var explorer = openWindow("files");
      if (explorer) renderFiles(directory.dataset.openDirectory, explorer);
      return;
    }
    var app = event.target.closest("[data-open-window]");
    if (app) {
      var appId = app.dataset.openWindow;
      openWindow(appId);
      if (app.dataset.settingsOpen) selectSettingsTab(app.dataset.settingsOpen);
      return;
    }
    var task = event.target.closest("[data-task-app]");
    if (task) { if (task.dataset.taskApp === "terminal") createTerminal(); else if (task.dataset.taskApp === "writeups") runTerminalCommand("ls writeups/", true); else openWindow(task.dataset.taskApp); return; }
    var command = event.target.closest("[data-terminal-command]");
    if (command) {
      event.preventDefault(); event.stopPropagation();
      runTerminalCommand(command.dataset.terminalCommand, true);
      return;
    }
    var workspaceButton = event.target.closest("[data-workspace]");
    if (workspaceButton) { applyWorkspace(workspaceButton.dataset.workspace); return; }
    if (event.target.closest("[data-new-terminal]")) { createTerminal(); return; }
    var fileItemButton = event.target.closest("[data-file-path]");
    if (fileItemButton) { renderFiles(fileItemButton.dataset.filePath, fileItemButton.closest("[data-window-type='files']")); return; }
    var fileCommandButton = event.target.closest("[data-file-command]");
    if (fileCommandButton) { runTerminalCommand(fileCommandButton.dataset.fileCommand, true); return; }
    var wallpaper = event.target.closest("[data-wallpaper]");
    if (wallpaper) { setWallpaper(wallpaper.dataset.wallpaper); return; }
    var tab = event.target.closest("[data-settings-tab]");
    if (tab) { selectSettingsTab(tab.dataset.settingsTab, tab.closest("[data-window-type='settings']")); return; }
    var refresh = event.target.closest("[data-refresh-desktop]");
    if (refresh) { refreshDesktop(); return; }
  });
  root.addEventListener("change", function (event) {
    if (event.target.id === "dock-position-setting") { localStorage.setItem("ctf-desktop-dock-position", event.target.value); applyDockSettings(); }
    if (event.target.id === "dock-mode-setting") { localStorage.setItem("ctf-desktop-dock-mode", event.target.value); if (event.target.value === "minimized") localStorage.setItem("ctf-desktop-dock-collapsed", "true"); applyDockSettings(); }
  });
  root.querySelectorAll("[data-workspace]").forEach(function (button) {
    button.addEventListener("keydown", function (event) {
      if (event.key === "ArrowRight" || event.key === "ArrowLeft") { event.preventDefault(); var next = (Number(button.dataset.workspace) + (event.key === "ArrowRight" ? 1 : 1)) % 3 + 1; var previous = (Number(button.dataset.workspace) + 1) % 3 + 1; applyWorkspace(String(event.key === "ArrowRight" ? next : previous)); root.querySelector('[data-workspace="' + (event.key === "ArrowRight" ? next : previous) + '"]').focus(); }
    });
  });
  root.querySelectorAll("[data-settings-tab]").forEach(function (settingsTab) {
    settingsTab.addEventListener("click", function (event) { event.preventDefault(); event.stopPropagation(); selectSettingsTab(settingsTab.dataset.settingsTab, settingsTab.closest("[data-window-type='settings']")); });
  });

  function makeFileButton(icon, label, path, command) {
    var button = document.createElement("button");
    button.className = "file-item";
    if (path != null) button.dataset.filePath = path;
    if (command) button.dataset.fileCommand = command;
    var glyph = document.createElement("span"), title = document.createElement("span");
    glyph.textContent = icon; title.textContent = label; button.append(glyph, title);
    return button;
  }
  function renderFiles(path, win) {
    win = win || findWindow("files", activeWorkspace);
    if (!win) return;
    var filePath = path == null ? (win._filePath || "") : path;
    win._filePath = filePath;
    var host = win.querySelector(".file-manager__items"), label = win.querySelector(".file-manager__path");
    if (!host || !label) return;
    host.replaceChildren();
    label.textContent = "~/" + filePath;
    if (!filePath) {
      host.append(makeFileButton("▤", "README.md", null, "cat README.md"), makeFileButton("▤", "about.txt", null, "cat about.txt"), makeFileButton("▣", "writeups/", "writeups/"));
      return;
    }
    if (filePath === "writeups/") {
      var categories = Array.from(new Set(fileItems.map(function (item) { return item.path.split("/")[0]; }))).sort();
      categories.forEach(function (category) { host.append(makeFileButton("▣", category + "/", "writeups/" + category + "/")); });
      return;
    }
    var category = filePath.replace(/^writeups\//, "").replace(/\/$/, "");
    fileItems.filter(function (item) { return item.path.indexOf(category + "/") === 0; }).forEach(function (item) {
      var command = "cat writeups/" + item.path + "/writeup.md";
      host.append(makeFileButton("▤", item.title || item.path.split("/").pop(), null, command));
    });
  }

  function selectSettingsTab(name, win) {
    win = win || findWindow("settings", activeWorkspace);
    if (!win) return;
    win.querySelectorAll("[data-settings-tab]").forEach(function (tab) { tab.classList.toggle("is-selected", tab.dataset.settingsTab === name); });
    renderSettings(name, win);
  }
  function renderSettings(name, win) {
    win = win || root.querySelector('[data-window-type="settings"]');
    var host = win && win.querySelector(".settings-content");
    if (!host) return;
    host.replaceChildren();
    if (name === "sound") {
      host.innerHTML = "<h2>Audio devices</h2><p>Terminal mechanics and ambient audio use separate volume paths.</p><div class=\"settings-audio\"><span>Keyboard typing sound</span><button type=\"button\" data-audio-toggle>Sound: On</button></div><div class=\"settings-audio\"><span>Ambient music</span><button type=\"button\" data-open-window=\"music\">Open player</button></div>";
      var toggle = host.querySelector("[data-audio-toggle]");
      toggle.setAttribute("aria-pressed", String(localStorage.getItem("ctf-terminal-sound") !== "off"));
      toggle.textContent = localStorage.getItem("ctf-terminal-sound") === "off" ? "Sound: Off" : "Sound: On";
      return;
    }
    if (name === "dock") {
      var position = localStorage.getItem("ctf-desktop-dock-position") || "center", mode = localStorage.getItem("ctf-desktop-dock-mode") || "always";
      var positionMarkup = ["center", "left", "right"].map(function (value) { return '<option value="' + value + '"' + (value === position ? " selected" : "") + '>' + value[0].toUpperCase() + value.slice(1) + '</option>'; }).join("");
      var modeMarkup = [["always", "Always visible"], ["auto", "Auto-hide"], ["minimized", "Minimized launcher"]].map(function (option) { return '<option value="' + option[0] + '"' + (option[0] === mode ? " selected" : "") + '>' + option[1] + '</option>'; }).join("");
      host.innerHTML = '<h2>Application dock</h2><p>Choose where the floating dock sits and how it appears.</p><label class="dock-setting">Position <select id="dock-position-setting">' + positionMarkup + '</select></label><label class="dock-setting">Visibility <select id="dock-mode-setting">' + modeMarkup + '</select></label>';
      host.querySelector("#dock-position-setting").addEventListener("change", function (event) { localStorage.setItem("ctf-desktop-dock-position", event.target.value); applyDockSettings(); });
      host.querySelector("#dock-mode-setting").addEventListener("change", function (event) { localStorage.setItem("ctf-desktop-dock-mode", event.target.value); if (event.target.value === "minimized") localStorage.setItem("ctf-desktop-dock-collapsed", "true"); applyDockSettings(); });
      return;
    }
    var heading = document.createElement("h2"), text = document.createElement("p"), choices = document.createElement("div");
    heading.textContent = "Desktop wallpaper"; text.textContent = "ML4W wallpaper collection · select a preview to apply it.";
    choices.className = "wallpaper-options";
    wallpaperChoices.forEach(function (choice) {
      var button = document.createElement("button"); button.type = "button"; button.className = "wallpaper-choice"; button.dataset.wallpaper = choice.id; button.setAttribute("aria-pressed", String(root.dataset.wallpaper === choice.id));
      var preview = document.createElement("img"); preview.className = "wallpaper-preview"; preview.loading = "lazy"; preview.alt = ""; preview.dataset.loaded = "false";
      preview.onload = function () { this.dataset.loaded = "true"; };
      preview.onerror = function () {
        if (isDevelopment()) console.error("CTF-LAB wallpaper thumbnail failed to load:", wallpaperAsset(choice.thumbnail), "(id:", choice.id + ")");
        var fallback = document.createElement("span"); fallback.className = "wallpaper-preview wallpaper-preview--fallback"; fallback.setAttribute("role", "img"); fallback.setAttribute("aria-label", choice.name + " preview unavailable"); fallback.textContent = "Preview unavailable"; this.replaceWith(fallback);
      };
      preview.src = wallpaperAsset(choice.thumbnail);
      var name = document.createElement("span"); name.className = "wallpaper-label"; name.textContent = choice.name + " · " + choice.category;
      button.append(preview, name); choices.append(button);
    });
    host.append(heading, text, choices);
  }

  function updateClock() {
    var clock = document.getElementById("desktop-clock");
    if (!clock) return;
    clock.textContent = new Intl.DateTimeFormat(undefined, { weekday: "short", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date());
  }
  updateClock(); window.setInterval(updateClock, 15000);

  function loadMusicPrefs() {
    var volume = 22, muted = false;
    try { volume = Number(localStorage.getItem("ctf-desktop-music-volume") || 22); muted = localStorage.getItem("ctf-desktop-music-muted") === "true"; } catch (_) {}
    var slider = document.getElementById("music-volume");
    if (slider) slider.value = String(Math.max(0, Math.min(100, volume)));
    if (music.audio) { music.audio.volume = Math.max(0, Math.min(100, volume)) / 100; music.audio.muted = muted; }
    updateVolumeLabel();
    if (muted) root.dataset.musicMuted = "true";
    updateMusicMuteControls();
  }
  function updateVolumeLabel() {
    var slider = document.getElementById("music-volume"), value = slider ? Number(slider.value) : 22;
    var label = document.getElementById("music-volume-value");
    if (label) label.textContent = value + "%";
    try { localStorage.setItem("ctf-desktop-music-volume", String(value)); } catch (_) {}
    if (music.audio) music.audio.volume = value / 100;
    if (music.audio) music.audio.muted = root.dataset.musicMuted === "true";
  }
  function updateMusicMuteControls() {
    var muted = root.dataset.musicMuted === "true";
    root.querySelectorAll("[data-music-mute]").forEach(function (button) {
      button.setAttribute("aria-pressed", String(muted));
      button.setAttribute("aria-label", muted ? "Unmute ambient music" : "Mute ambient music");
      button.dataset.muted = String(muted);
    });
  }
  function toggleMusicMute() {
    root.dataset.musicMuted = root.dataset.musicMuted === "true" ? "false" : "true";
    try { localStorage.setItem("ctf-desktop-music-muted", root.dataset.musicMuted); } catch (_) {}
    updateMusicMuteControls(); updateVolumeLabel();
  }
  function startMusic() {
    if (!music.audio) return;
    var status = document.getElementById("music-status");
    if (status) status.textContent = "Starting ambient audio…";
    music.audio.play().then(function () {
      music.playing = true; root.dataset.musicPlaying = "true";
      updateMusicControls();
      if (status) status.textContent = "Now playing · " + tracks[currentTrack].style + " · Original CTF-LAB composition";
      if (!music.timer) music.timer = window.setInterval(updateMusicTime, 500);
    }).catch(function () {
      music.playing = false; root.dataset.musicPlaying = "false";
      updateMusicControls();
      if (status) status.textContent = "The local ambient track could not be played in this browser.";
    });
  }
  function stopMusic() {
    if (!music.audio || !music.playing) return;
    music.playing = false; root.dataset.musicPlaying = "false";
    music.audio.pause();
    if (music.timer) { clearInterval(music.timer); music.timer = null; }
    updateMusicControls();
  }
  function toggleMusic() { if (music.playing) stopMusic(); else startMusic(); }
  function selectTrack(index, keepPlaying) {
    index = (index + tracks.length) % tracks.length;
    var wasPlaying = keepPlaying == null ? music.playing : keepPlaying;
    currentTrack = index;
    music.audio.pause(); music.audio.currentTime = 0; music.audio.src = audioBase + tracks[index].src; music.audio.load();
    var select = document.getElementById("music-track-select"); if (select) select.value = tracks[index].id;
    try { localStorage.setItem("ctf-desktop-music-track", tracks[index].id); } catch (_) {}
    var title = document.getElementById("music-current-title"), panelTitle = document.getElementById("panel-track-title"), status = document.getElementById("music-status");
    if (title) title.textContent = tracks[index].title;
    if (panelTitle) panelTitle.textContent = tracks[index].title;
    if (status) status.textContent = tracks[index].style + " · Original composition";
    updateMusicTime();
    if (wasPlaying) startMusic();
  }
  var playlist = document.getElementById("music-track-select");
  if (playlist) {
    tracks.forEach(function (track) { var option = document.createElement("option"); option.value = track.id; option.textContent = track.title + " — " + track.style; playlist.appendChild(option); });
    var savedTrack = localStorage.getItem("ctf-desktop-music-track"), savedIndex = tracks.findIndex(function (track) { return track.id === savedTrack; });
    if (savedIndex >= 0) currentTrack = savedIndex;
    playlist.value = tracks[currentTrack].id; music.audio.src = audioBase + tracks[currentTrack].src;
    playlist.addEventListener("change", function () { selectTrack(tracks.findIndex(function (track) { return track.id === playlist.value; })); });
  }
  root.querySelectorAll("[data-music-previous]").forEach(function (button) { button.addEventListener("click", function () { selectTrack(currentTrack - 1); }); });
  root.querySelectorAll("[data-music-next]").forEach(function (button) { button.addEventListener("click", function () { selectTrack(currentTrack + 1); }); });
  function updateMusicControls() {
    root.querySelectorAll("[data-music-toggle]").forEach(function (button) {
      var svg = button.querySelector("svg");
      if (svg) svg.innerHTML = music.playing ? '<path d="M8 5h3v14H8zm6 0h3v14h-3z"/>' : '<path d="m8 5 12 7-12 7z"/>';
      button.setAttribute("aria-label", music.playing ? "Pause ambient music" : "Play ambient music");
    });
  }
  function updateMusicTime() {
    if (!music.audio) return;
    var seconds = Math.floor(music.audio.currentTime || 0);
    var value = String(Math.floor(seconds / 60)).padStart(2, "0") + ":" + String(seconds % 60).padStart(2, "0");
    var panel = document.getElementById("panel-track-time"), elapsed = document.getElementById("music-elapsed");
    if (panel) panel.textContent = value;
    if (elapsed) elapsed.textContent = value;
    var trackDuration = Number.isFinite(music.audio.duration) && music.audio.duration > 0 ? music.audio.duration : tracks[currentTrack].duration;
    var progress = document.getElementById("music-progress-fill");
    if (progress && trackDuration) progress.style.width = (100 * music.audio.currentTime / trackDuration) + "%";
    var seek = document.getElementById("music-seek");
    if (seek && trackDuration && !seek.matches(":active")) seek.value = String(Math.round(1000 * music.audio.currentTime / trackDuration));
    var duration = document.getElementById("music-duration");
    if (duration && trackDuration) duration.textContent = String(Math.floor(trackDuration / 60)).padStart(2, "0") + ":" + String(Math.floor(trackDuration % 60)).padStart(2, "0");
    var currentTitle = document.getElementById("music-current-title"), panelTitle = document.getElementById("panel-track-title");
    if (currentTitle) currentTitle.textContent = tracks[currentTrack].title;
    if (panelTitle) panelTitle.textContent = tracks[currentTrack].title;
  }
  var seekControl = document.getElementById("music-seek");
  if (seekControl) seekControl.addEventListener("input", function () { music.audio.currentTime = tracks[currentTrack].duration * Number(seekControl.value) / 1000; updateMusicTime(); });
  var volumeSlider = document.getElementById("music-volume");
  if (volumeSlider) volumeSlider.addEventListener("input", updateVolumeLabel);
  if (music.audio) music.audio.addEventListener("ended", function () { selectTrack(currentTrack + 1, true); });
  root.querySelectorAll("[data-music-toggle]").forEach(function (button) { button.addEventListener("click", function (event) { event.stopPropagation(); toggleMusic(); }); });
  root.querySelectorAll("[data-music-mute]").forEach(function (button) { button.addEventListener("click", function (event) { event.stopPropagation(); toggleMusicMute(); }); });
  loadMusicPrefs();
  updateMusicTime();

  function applyDockSettings() {
    dock.dataset.dockPosition = localStorage.getItem("ctf-desktop-dock-position") || "center";
    dock.dataset.dockMode = localStorage.getItem("ctf-desktop-dock-mode") || "always";
    if (dock.dataset.dockMode === "minimized" && localStorage.getItem("ctf-desktop-dock-collapsed") == null) localStorage.setItem("ctf-desktop-dock-collapsed", "true");
    dock.dataset.collapsed = String(localStorage.getItem("ctf-desktop-dock-collapsed") === "true");
    var collapse = document.getElementById("dock-collapse");
    if (collapse) collapse.setAttribute("aria-label", dock.dataset.collapsed === "true" ? "Expand dock" : "Minimize dock");
  }
  applyDockSettings();
  document.getElementById("dock-collapse").addEventListener("click", function (event) {
    event.stopPropagation();
    if (dock.dataset.dockMode !== "minimized") { localStorage.setItem("ctf-desktop-dock-mode", "minimized"); localStorage.setItem("ctf-desktop-dock-collapsed", "true"); }
    else localStorage.setItem("ctf-desktop-dock-collapsed", String(dock.dataset.collapsed !== "true"));
    applyDockSettings();
  });
  dock.querySelector("[data-wallpaper-prev]").addEventListener("click", function (event) { event.preventDefault(); event.stopPropagation(); navigateWallpaper(-1); });
  dock.querySelector("[data-wallpaper-next]").addEventListener("click", function (event) { event.preventDefault(); event.stopPropagation(); navigateWallpaper(1); });
  dock.querySelector("[data-wallpaper-current]").addEventListener("click", function (event) { event.preventDefault(); event.stopPropagation(); openWindow("settings"); renderSettings("wallpaper"); });
  function navigateWallpaper(direction) {
    if (!wallpaperChoices.length) return;
    var currentIndex = wallpaperChoices.findIndex(function (choice) { return choice.id === root.dataset.wallpaper; });
    setWallpaper(wallpaperChoices[(currentIndex + direction + wallpaperChoices.length) % wallpaperChoices.length].id);
    var nextIndex = wallpaperChoices.findIndex(function (choice) { return choice.id === root.dataset.wallpaper; });
    [wallpaperChoices[(nextIndex - 1 + wallpaperChoices.length) % wallpaperChoices.length], wallpaperChoices[(nextIndex + 1) % wallpaperChoices.length]].forEach(function (choice) { var image = new Image(); image.src = wallpaperAsset(choice.full); });
  }
  dock.addEventListener("click", function (event) {
    if (dock.dataset.collapsed === "true" && !event.target.closest("[data-task-app]")) { dock.dataset.collapsed = "false"; localStorage.setItem("ctf-desktop-dock-collapsed", "false"); applyDockSettings(); }
  });
  root.addEventListener("pointermove", function (event) {
    if (dock.dataset.dockMode !== "auto") return;
    if (event.clientY >= window.innerHeight - 14) { clearTimeout(hideDockTimer); dock.dataset.revealed = "true"; }
    else if (!event.target.closest("#desktop-dock")) { clearTimeout(hideDockTimer); hideDockTimer = setTimeout(function () { dock.dataset.revealed = "false"; }, 650); }
  });
  root.addEventListener("touchstart", function (event) { if (dock.dataset.dockMode === "auto" && event.touches[0].clientY >= window.innerHeight - 36) dock.dataset.revealed = "true"; }, { passive: true });
  dock.addEventListener("pointerenter", function () { clearTimeout(hideDockTimer); dock.dataset.revealed = "true"; });
  dock.addEventListener("pointerleave", function () { if (dock.dataset.dockMode === "auto") { clearTimeout(hideDockTimer); hideDockTimer = setTimeout(function () { dock.dataset.revealed = "false"; }, 650); } });
  dock.addEventListener("touchstart", function () { dock.dataset.revealed = "true"; }, { passive: true });

  document.getElementById("desktop-launcher").addEventListener("click", function (event) {
    event.stopPropagation();
    appMenu.hidden = !appMenu.hidden;
    this.setAttribute("aria-expanded", String(!appMenu.hidden));
  });
  workspace.addEventListener("contextmenu", function (event) {
    if (event.target.closest(".desktop-window,.desktop-icon,.desktop-app-menu,.desktop-context-menu")) return;
    event.preventDefault(); appMenu.hidden = true; contextMenu.hidden = false;
    var rect = workspace.getBoundingClientRect(), width = 200, height = 180;
    contextMenu.style.left = Math.max(4, Math.min(rect.width - width - 4, event.clientX - rect.left)) + "px";
    contextMenu.style.top = Math.max(4, Math.min(rect.height - height - 4, event.clientY - rect.top)) + "px";
  });
  document.addEventListener("click", function (event) {
    if (!event.target.closest("#desktop-app-menu,#desktop-launcher")) {
      appMenu.hidden = true;
      document.getElementById("desktop-launcher").setAttribute("aria-expanded", "false");
    }
    if (!event.target.closest("#desktop-context-menu")) contextMenu.hidden = true;
  });
  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape") { appMenu.hidden = true; contextMenu.hidden = true; }
    if (event.ctrlKey && event.altKey && /^[123]$/.test(event.key) && !event.target.closest("input,textarea,select")) { event.preventDefault(); applyWorkspace(event.key); }
  });
  var desktopIcons = Array.prototype.slice.call(root.querySelectorAll(".desktop-icon"));
  var iconLayer = workspace.querySelector(".desktop-icons");
  function clampDesktopIcon(icon, x, y, area) {
    return { x:Math.max(0, Math.min(area.width - icon.offsetWidth, x)), y:Math.max(0, Math.min(area.height - icon.offsetHeight, y)) };
  }
  if (iconLayer && desktopIcons.length) {
    var iconArea = workspace.getBoundingClientRect();
    var startPositions = desktopIcons.map(function (icon, index) {
      var rect = icon.getBoundingClientRect(), key = icon.dataset.openWindow || icon.dataset.openDirectory || "shortcut-" + index, saved = null;
      try { saved = JSON.parse(localStorage.getItem("ctf-desktop-icon-" + key) || "null"); } catch (_) {}
      icon.dataset.desktopIconKey = key;
      var x = saved && Number.isFinite(saved.x) ? saved.x * iconArea.width : rect.left - iconArea.left;
      var y = saved && Number.isFinite(saved.y) ? saved.y * iconArea.height : rect.top - iconArea.top;
      return clampDesktopIcon(icon, x, y, iconArea);
    });
    iconLayer.classList.add("desktop-icons--positioned");
    desktopIcons.forEach(function (icon, index) {
      icon.style.left = startPositions[index].x + "px"; icon.style.top = startPositions[index].y + "px";
      icon.dataset.desktopIconX = String(startPositions[index].x / Math.max(1, iconArea.width));
      icon.dataset.desktopIconY = String(startPositions[index].y / Math.max(1, iconArea.height));
      icon.addEventListener("pointerdown", function (event) {
        if (event.button !== 0) return;
        event.stopPropagation();
        var area = workspace.getBoundingClientRect();
        iconDragState = { icon:icon, pointerId:event.pointerId, startX:event.clientX, startY:event.clientY,
          left:parseFloat(icon.style.left) || 0, top:parseFloat(icon.style.top) || 0, area:area, moved:false };
        if (icon.setPointerCapture) icon.setPointerCapture(event.pointerId);
      });
      icon.addEventListener("click", function (event) {
        if (icon._suppressClick) { event.preventDefault(); event.stopImmediatePropagation(); icon._suppressClick = false; }
      }, true);
    });
  }
  document.addEventListener("pointermove", function (event) {
    if (!iconDragState || event.pointerId !== iconDragState.pointerId) return;
    var state = iconDragState, dx = event.clientX - state.startX, dy = event.clientY - state.startY;
    if (!state.moved && Math.hypot(dx, dy) < 5) return;
    state.moved = true;
    var point = clampDesktopIcon(state.icon, state.left + dx, state.top + dy, state.area);
    state.icon.style.left = point.x + "px"; state.icon.style.top = point.y + "px";
    state.icon.classList.add("is-dragging"); event.preventDefault();
  });
  root.querySelectorAll(".desktop-icon").forEach(function (icon) {
    icon.addEventListener("click", function () {
      root.querySelectorAll(".desktop-icon").forEach(function (node) { node.classList.toggle("is-selected", node === icon); });
    });
    if (icon.dataset.terminalCommand) icon.addEventListener("click", function (event) {
      event.preventDefault(); event.stopPropagation();
      openWindow("terminal");
      runTerminalCommand(icon.dataset.terminalCommand, true);
    });
    icon.addEventListener("dblclick", function () {
      var app = icon.dataset.openWindow;
      if (app && app !== "terminal") openWindow(app);
    });
  });
  function refreshDesktop() {
    setWallpaper(root.dataset.wallpaper || "aurora"); updateClock();
    contextMenu.hidden = true;
  }

  windowNodes.forEach(function (win) {
    if (!win.dataset.windowType) win.dataset.windowType = win.dataset.windowId;
    if (!win.dataset.workspaceId) win.dataset.workspaceId = "1";
    win.dataset.focused = String(win.dataset.windowType === "terminal" && win.dataset.instanceId === "1");
    win.dataset.positioned = "true";
    restoreWindowGeometry(win);
    if (win.dataset.windowType === "terminal") win.style.zIndex = String(++zIndex);
  });
  applyWorkspace(activeWorkspace);
  renderFiles("", findWindow("files", "1")); renderSettings("wallpaper", findWindow("settings", "1"));
  window.CTFLABDesktop = { open: openWindow, newTerminal: createTerminal, switchWorkspace: applyWorkspace, refresh: refreshDesktop, wallpaper: setWallpaper };
})();
