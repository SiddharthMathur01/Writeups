(function () {
  "use strict";

  var soundOn = true, audio = null, audioBuffer = null, audioBufferPromise = null, audioUnlockPromise = null, keySamples = [], activeTyping = null;
  try { soundOn = localStorage.getItem("ctf-terminal-sound") !== "off"; } catch (_) {}

  function updateSoundButtons() {
    document.querySelectorAll("[data-audio-toggle]").forEach(function (button) {
      if (button.classList.contains("panel-status")) button.dataset.muted = String(!soundOn);
      else button.textContent = "SOUND: " + (soundOn ? "ON" : "OFF");
      button.setAttribute("aria-pressed", String(soundOn));
      button.setAttribute("aria-label", soundOn ? "Mute terminal sound" : "Enable terminal sound");
    });
  }
  function findKeySamples(buffer) {
    var channel = buffer.getChannelData(0), windowSize = Math.max(1, Math.floor(buffer.sampleRate * 0.09));
    var hop = Math.max(1, Math.floor(buffer.sampleRate * 0.008)), peaks = [], maxRms = 0;
    for (var start = 0; start + windowSize < channel.length; start += hop) {
      var sum = 0;
      for (var i = start; i < start + windowSize; i += 4) sum += channel[i] * channel[i];
      var rms = Math.sqrt(sum / (windowSize / 4));
      if (rms > maxRms) maxRms = rms;
      peaks.push({ offset: start / buffer.sampleRate, rms: rms });
    }
    var floor = Math.max(0.006, maxRms * 0.14), selected = [];
    peaks.forEach(function (peak, index) {
      if (peak.rms < floor || peak.rms < (peaks[index - 1] || peak).rms || peak.rms < (peaks[index + 1] || peak).rms) return;
      if (selected.length && peak.offset - selected[selected.length - 1] < 0.085) return;
      selected.push(peak.offset);
    });
    keySamples = selected.length ? selected : [0];
  }
  function unlockAudio() {
    if (!soundOn) return Promise.resolve();
    try {
      var Ctor = window.AudioContext || window.webkitAudioContext;
      if (!Ctor) return Promise.resolve();
      if (audio && audio.state === "closed") { audio = null; audioBuffer = null; audioBufferPromise = null; audioUnlockPromise = null; }
      if (!audio) {
        audio = new Ctor();
        var terminal = document.getElementById("shell");
        var sampleUrl = terminal && terminal.dataset.audioSrc ? new URL(terminal.dataset.audioSrc, document.baseURI).href : new URL("assets/audio/typewriter-typing.mp3", document.baseURI).href;
        audioBufferPromise = fetch(sampleUrl).then(function (response) {
          if (!response.ok) throw new Error("Keyboard audio unavailable");
          return response.arrayBuffer();
        }).then(function (data) { return audio.decodeAudioData(data); }).then(function (buffer) { audioBuffer = buffer; findKeySamples(buffer); return buffer; }).catch(function () { audioBuffer = null; return null; });
      }
      if (audio.state === "running") return Promise.resolve();
      if (!audioUnlockPromise) audioUnlockPromise = audio.resume().catch(function () {}).then(function () { audioUnlockPromise = null; });
      return audioUnlockPromise;
    } catch (_) { return Promise.resolve(); }
  }
  function keySound(isDelete) {
    if (!soundOn) return;
    unlockAudio().then(function () { return audioBufferPromise || audioBuffer; }).then(function (buffer) {
      if (!soundOn || !buffer || !audio || audio.state !== "running") return;
      try {
        var now = audio.currentTime, source = audio.createBufferSource(), gain = audio.createGain();
        var duration = Math.min(0.09, buffer.duration), offset = keySamples.length ? keySamples[Math.floor(Math.random() * keySamples.length)] : 0;
        offset = Math.min(offset, Math.max(0, buffer.duration - duration));
        source.buffer = buffer;
        source.playbackRate.setValueAtTime((isDelete ? 0.88 : 0.96) + Math.random() * (isDelete ? 0.1 : 0.08), now);
        gain.gain.setValueAtTime((isDelete ? 0.16 : 0.18) + Math.random() * 0.06, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
        source.connect(gain); gain.connect(audio.destination);
        source.start(now, offset, duration);
      } catch (_) {}
    });
  }
  document.addEventListener("pointerdown", unlockAudio);
  document.addEventListener("keydown", unlockAudio);
  document.addEventListener("click", function (event) {
    var button = event.target.closest && event.target.closest("[data-audio-toggle]");
    if (!button) return;
    soundOn = !soundOn;
    try { localStorage.setItem("ctf-terminal-sound", soundOn ? "on" : "off"); } catch (_) {}
    updateSoundButtons();
    if (soundOn) unlockAudio(); else if (audio && audio.state === "running") audio.suspend().catch(function () {});
  });
  updateSoundButtons();

  function initShell(root, options) {
    if (!root || !root.querySelector) root = document.getElementById("shell");
    options = options || {};
    if (!root || root.dataset.ready) return root && root._ctfLabSession;
    root.dataset.ready = "1";
    var output = root.querySelector(".shell__output"), form = root.querySelector(".shell__form");
    var input = root.querySelector(".shell__input"), cwdLabel = root.querySelector(".shell__cwd");
    var intro = root.querySelector(".shell__intro"), skip = root.querySelector(".shell__skip");
    var working = root.querySelector(".shell__working");
    var reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    var items = [], commandHistory = [], historyIndex = 0, cwd = "~", entryId = 0;
    var activeResult = null, busy = false, activeCommandController = null, queue = [], queueTimer = null, timers = [], introActive = false, welcomed = false;
    var pendingScrollEntries = new Set(), previousScrollTop = output.scrollTop;
    var homeLink = document.querySelector(".ctf-navbar__brand");
    var siteBase = new URL(homeLink ? homeLink.href : document.baseURI);
    try { items = JSON.parse(root.dataset.writeups || "[]"); } catch (_) {}
    items = items.map(function (item) {
      var url = String(item.url || "").replace(/^\/+|\/+$/g, "");
      return Object.assign({}, item, { path: url, href: new URL(url + "/", siteBase).href, searchText: "" });
    });

    function line(value, type) {
      var el = document.createElement("div");
      el.className = "shell__line" + (type ? " shell__line--" + type : "");
      el.textContent = value == null ? "" : String(value);
      if (activeResult) activeResult.appendChild(el); else output.insertBefore(el, form);
      return el;
    }
    function nearBottom() { return output.scrollHeight - output.scrollTop - output.clientHeight < 170; }
    function scrollToEnd(shouldScroll) {
      if (!shouldScroll) return;
      requestAnimationFrame(function () { output.scrollTo({ top: output.scrollHeight, behavior: reduced ? "auto" : "smooth" }); });
    }
    function commandLabel(command, container) {
      var el = document.createElement("div"), user = document.createElement("span"), dir = document.createElement("span");
      el.className = "shell__line shell__line--command";
      user.className = "prompt-user"; user.textContent = "siddharth@ctf-lab";
      dir.className = "prompt-dir"; dir.textContent = ":" + cwd + "$ ";
      el.append(user, dir, document.createTextNode(command)); container.appendChild(el);
      return el;
    }
    function addEntry(command) {
      var wasAtBottom = nearBottom(), entry = document.createElement("section");
      entry.className = "shell__entry"; entry.dataset.entryId = "terminal-entry-" + (++entryId);
      entry.dataset.status = "running"; entry.dataset.keepScroll = String(wasAtBottom); entry.setAttribute("aria-label", "Command " + command);
      pendingScrollEntries.add(entry);
      commandLabel(command, entry);
      var result = document.createElement("div"); result.className = "shell__result"; entry.appendChild(result);
      output.insertBefore(entry, form); scrollToEnd(wasAtBottom);
      return { result: result, wasAtBottom: wasAtBottom, entry: entry };
    }
    function setStatus(text) { if (working) working.textContent = text || ""; }
    function completeEntry(entry) {
      if (!entry) return;
      entry.dataset.status = "complete";
      pendingScrollEntries.delete(entry);
      setStatus("");
      scrollToEnd(entry.dataset.keepScroll === "true");
    }
    output.addEventListener("scroll", function () {
      if (output.scrollTop < previousScrollTop) pendingScrollEntries.forEach(function (entry) { entry.dataset.keepScroll = "false"; });
      previousScrollTop = output.scrollTop;
    }, { passive: true });
    function pathFor(item) { return "writeups/" + item.path + "/writeup.md"; }
    function normalize(value) { return String(value || "").toLowerCase().replace(/[^a-z0-9]/g, ""); }
    function baseName(item) { return item.path.split("/").pop(); }
    function resolveItem(query) {
      var q = String(query || "").trim().replace(/^writeups\//i, "").replace(/\/writeup\.md$/i, "").replace(/\.md$/i, "").replace(/\/$/, "");
      var nq = normalize(q);
      if (!nq) return null;
      return items.find(function (item) {
        return [item.title, baseName(item), item.path].some(function (candidate) { return normalize(candidate) === nq || normalize(candidate).endsWith(nq); });
      }) || items.find(function (item) { return normalize(item.title).includes(nq) || normalize(item.path).includes(nq); });
    }
    function categories() { return Array.from(new Set(items.map(function (item) { return item.path.split("/")[0]; }))).sort(); }
    function currentVirtualPath() { return cwd === "~" ? "" : cwd.slice(2); }
    function resolveVirtualPath(value) {
      var raw = String(value || "").trim();
      if (!raw || raw === "~" || raw === "/") return "";
      raw = raw.replace(/^~\/?/, "").replace(/^\/+/, "");
      var parts = raw.indexOf("writeups/") === 0 || raw === "writeups" ? [] : currentVirtualPath().split("/").filter(Boolean);
      raw.split("/").filter(Boolean).forEach(function (part) {
        if (part === ".") return;
        if (part === "..") parts.pop(); else parts.push(part);
      });
      return parts.join("/");
    }
    function directoryEntries(target) {
      var targetPath = resolveVirtualPath(target);
      if (targetPath === "") return { kind: "root" };
      if (targetPath === "writeups") return { kind: "writeups" };
      if (targetPath.indexOf("writeups/") === 0) {
        var remainder = targetPath.slice("writeups/".length), parts = remainder.split("/");
        var category = categories().find(function (value) { return value.toLowerCase() === parts[0].toLowerCase(); });
        if (category && parts.length === 1) return { kind: "category", category: category };
        if (category && parts.length > 1) {
          var itemPath = category + "/" + parts.slice(1).join("/");
          var item = items.find(function (entry) { return entry.path.toLowerCase() === itemPath.toLowerCase(); });
          if (item) return { kind: "writeup", category: category, item: item };
        }
      }
      return { kind: "missing" };
    }
    function quotePath(value) { return /\s/.test(value) ? '"' + value.replace(/"/g, '\\"') + '"' : value; }
    function commandButton(label, command, className) {
      var button = document.createElement("button"); button.type = "button";
      button.className = className || "shell__link shell__file-link";
      button.dataset.terminalCommand = command; button.textContent = label; activeResult.appendChild(button); return button;
    }
    function listDirectory(target, showAll) {
      var dir = directoryEntries(target);
      if (dir.kind === "missing") { line("ls: cannot access '" + target + "': No such directory", "error"); return; }
      if (dir.kind === "root") {
        if (showAll) line("total 3", "meta");
        commandButton((showAll ? "-rw-r--r--  " : "") + "README.md", "cat README.md");
        commandButton((showAll ? "-rw-r--r--  " : "") + "about.txt", "cat about.txt");
        commandButton((showAll ? "drwxr-xr-x  " : "") + "writeups/", "ls writeups/");
        return;
      }
      if (dir.kind === "writeups") {
        line("DIRECTORY: writeups/", "meta");
        categories().forEach(function (category) { var count = items.filter(function (item) { return item.path.split("/")[0] === category; }).length; commandButton("  " + category + "/  (" + count + " writeups)", "ls writeups/" + category + "/", "shell__link shell__dir shell__file-link"); });
        if (!categories().length) line("No writeups indexed.", "meta");
        return;
      }
      if (dir.kind === "writeup") {
        line("DIRECTORY: writeups/" + dir.item.path + "/", "meta");
        commandButton("  writeup.md", "cat " + quotePath(pathFor(dir.item)));
        return;
      }
      var found = items.filter(function (item) { return item.path.split("/")[0].toLowerCase() === dir.category.toLowerCase(); });
      line("DIRECTORY: writeups/" + dir.category + "/", "meta");
      found.forEach(function (item) {
        var button = document.createElement("button");
        button.type = "button"; button.className = "shell__link shell__dir shell__file-link";
        button.dataset.terminalCommand = "cat " + quotePath(pathFor(item));
        button.textContent = "  " + baseName(item) + "/  [" + (item.difficulty || "Medium") + "] — " + item.title;
        activeResult.appendChild(button);
      });
      line(found.length + " writeup" + (found.length === 1 ? "" : "s") + " indexed.", "meta");
    }
    function appendResolvedUrls(container, base) {
      container.querySelectorAll("[src]").forEach(function (node) {
        var src = node.getAttribute("src");
        if (src) { try { node.setAttribute("src", new URL(src, base).href); } catch (_) {} }
      });
      container.querySelectorAll("a[href]").forEach(function (anchor) {
        var href = anchor.getAttribute("href");
        if (href && href.charAt(0) !== "#" && !/^(?:https?:|mailto:|tel:|data:|javascript:)/i.test(href)) { try { anchor.setAttribute("href", new URL(href, base).href); } catch (_) {} }
      });
    }
    function articleTemplate(doc, selector) {
      var template = doc.querySelector(selector);
      if (!template) return null;
      var fragment = template.content.cloneNode(true);
      return fragment;
    }
    function prefixAnchors(container, id) {
      var ids = new Map();
      container.querySelectorAll("[id]").forEach(function (node) { var old = node.id, next = "entry-" + id + "-" + old; ids.set(old, next); node.id = next; });
      container.querySelectorAll("a[href^='#']").forEach(function (anchor) { var old = anchor.getAttribute("href").slice(1); if (ids.has(old)) anchor.setAttribute("href", "#" + ids.get(old)); });
    }
    function prepareArticle(fragment, item, id) {
      if (!fragment) return null;
      var article = fragment.querySelector(".terminal-writeup");
      if (!article) return null;
      appendResolvedUrls(article, item.href);
      prefixAnchors(article, id);
      item.searchText = article.textContent || "";
      return article;
    }
    function getWriteup(item, id, signal) {
      var currentTemplate = document.querySelector("#terminal-writeup-template");
      if (currentTemplate && new URL(item.href).pathname === location.pathname) return Promise.resolve(prepareArticle(currentTemplate.content.cloneNode(true), item, id));
      return fetch(item.href, { credentials: "same-origin", signal: signal }).then(function (response) {
        if (!response.ok) throw new Error("HTTP " + response.status);
        return response.text();
      }).then(function (html) {
        var doc = new DOMParser().parseFromString(html, "text/html");
        return prepareArticle(articleTemplate(doc, "#terminal-writeup-template"), item, id);
      });
    }
    function getAbout(id, signal) {
      var current = document.querySelector("#terminal-about-template");
      if (current) { var currentFragment = current.content.cloneNode(true); appendResolvedUrls(currentFragment, location.href); prefixAnchors(currentFragment, id); return Promise.resolve(currentFragment); }
      var aboutUrl = new URL("about/", siteBase);
      return fetch(aboutUrl.href, { credentials: "same-origin", signal: signal }).then(function (response) {
        if (!response.ok) throw new Error("HTTP " + response.status);
        return response.text();
      }).then(function (html) {
        var doc = new DOMParser().parseFromString(html, "text/html");
        var template = doc.querySelector("#terminal-about-template");
        if (!template) throw new Error("About content unavailable");
        var fragment = template.content.cloneNode(true); appendResolvedUrls(fragment, aboutUrl.href); prefixAnchors(fragment, id); return fragment;
      });
    }
    function showWriteup(item, entry) {
      setStatus("reading writeup…");
      return getWriteup(item, entry.dataset.entryId, activeCommandController && activeCommandController.signal).then(function (article) {
        if (!article) { line("cat: writeup content could not be loaded.", "error"); return; }
        entry.querySelector(".shell__result").appendChild(article);
      }).catch(function (error) { line(error && error.name === "AbortError" ? "^C" : "cat: unable to load writeup content.", error && error.name === "AbortError" ? "meta" : "error"); });
    }
    function showAbout(entry) {
      setStatus("reading profile…");
      return getAbout(entry.dataset.entryId, activeCommandController && activeCommandController.signal).then(function (fragment) { entry.querySelector(".shell__result").appendChild(fragment); }).catch(function (error) { if (error && error.name === "AbortError") { line("^C", "meta"); return; } line("NAME: Siddharth Mathur", "meta"); line(root.dataset.siteDescription || "CTF research writeups and notes."); });
    }
    function help() {
      line("Commands", "meta");
      line("  help                         show commands and usage");
      line("  whoami | pwd | date          session and system context");
      line("  ls [-la] [path]              browse the virtual filesystem");
      line("  cd [directory]               change the simulated directory");
      line("  cat about.txt                read the researcher profile");
      line("  cat README.md                read the workspace introduction");
      line("  cat writeups/<path>          display a complete writeup inline");
      line("  open <writeup>               find and display a writeup inline");
      line("  search <term>                search writeup metadata and loaded text");
      line("  history | clear | github     session history and utilities");
    }
    function cd(target) {
      var destination = resolveVirtualPath(target), dir = directoryEntries(destination);
      if (dir.kind === "missing") { line("cd: no such directory: " + target, "error"); return; }
      cwd = destination ? "~/" + destination : "~";
      cwdLabel.textContent = cwd;
    }
    function findSearch(term) {
      var q = normalize(term);
      if (!q) { line("Usage: search <term>", "warning"); return; }
      var found = items.filter(function (item) { return normalize([item.title, item.category, item.tags, item.description, item.searchText].join(" ")).includes(q); });
      if (!found.length) { line("No writeups found for: " + term, "warning"); return; }
      line(found.length + " result" + (found.length === 1 ? "" : "s") + " for “" + term + "”:", "meta");
      found.forEach(function (item) {
        var button = document.createElement("button"); button.type = "button"; button.className = "shell__link shell__file-link";
        button.dataset.terminalCommand = "cat " + quotePath(pathFor(item)); button.textContent = "  " + item.title + "  [" + (item.category || item.path.split("/")[0]) + "]"; activeResult.appendChild(button);
      });
    }
    function dispatch(command, entry) {
      var parts = command.match(/(?:[^\s"']+|"[^\"]*"|'[^']*')+/g) || [];
      var cmd = (parts.shift() || "").toLowerCase(), arg = parts.join(" ").replace(/^['"]|['"]$/g, "").trim();
      var argLower = arg.toLowerCase();
      if (cmd === "help") help();
      else if (cmd === "whoami") { line("Siddharth Mathur"); line("Computer Science Student · CTF Player · Cybersecurity Researcher", "meta"); }
      else if (cmd === "pwd") line("/home/siddharth/research" + (cwd === "~" ? "" : "/" + cwd.slice(2)));
      else if (cmd === "ls" || cmd === "dir") {
        var target = arg.replace(/(?:^|\s)-[a-z]*a[a-z]*(?=\s|$)/ig, "").trim();
        if (!target && cwd !== "~") target = currentVirtualPath();
        listDirectory(target, /(^|\s)-[a-z]*a[a-z]*(\s|$)/i.test(arg));
      }
      else if (cmd === "cd") cd(arg);
      else if (cmd === "cat" && argLower === "about.txt" || cmd === "about") return showAbout(entry);
      else if (cmd === "cat" && argLower === "readme.md") { line(root.dataset.siteDescription || "CTF writeups and cybersecurity research notes."); line("Browse the virtual writeups directory with 'ls writeups/'.", "meta"); }
      else if (cmd === "cat" && argLower === "welcome.txt") { line("Welcome to CTF-LAB."); line("Cybersecurity research, CTF writeups, reverse engineering, cryptography, and technical experimentation."); line("Type 'help' to see available commands.", "meta"); }
      else if (cmd === "cat" || cmd === "open") {
        var writeupPath = arg;
        if (cmd === "cat" && cwd !== "~" && !/^writeups\//i.test(writeupPath)) writeupPath = currentVirtualPath() + "/" + writeupPath;
        var targetName = writeupPath.replace(/^writeups\//i, "").replace(/\/writeup\.md$/i, "");
        var item = resolveItem(targetName);
        if (!item) { line("cat: file not found: " + arg, "error"); return; }
        line("WRITEUP: " + item.title + "  |  " + (item.category || item.path.split("/")[0]) + "  |  " + (item.difficulty || "Medium"), "meta");
        return showWriteup(item, entry);
      }
      else if (cmd === "search") findSearch(arg);
      else if (cmd === "history") {
        if (!commandHistory.length) line("No commands in this session.", "meta");
        commandHistory.slice(-30).forEach(function (value, index, slice) { line(String(commandHistory.length - slice.length + index + 1).padStart(3, " ") + "  " + value); });
      }
      else if (cmd === "clear" || cmd === "cls") { output.querySelectorAll(".shell__entry,.shell__intro").forEach(function (node) { node.remove(); }); }
      else if (cmd === "date") line(new Date().toLocaleString());
      else if (cmd === "github") {
        var row = document.createElement("div"); row.className = "shell__line";
        row.appendChild(document.createTextNode("GitHub: "));
        var link = document.createElement("a"); link.className = "shell__link"; link.href = "https://github.com/SiddharthMathur01"; link.textContent = "github.com/SiddharthMathur01"; link.rel = "noopener"; row.appendChild(link); activeResult.appendChild(row);
      }
      else if (cmd === "tree") { line("writeups/"); categories().forEach(function (category) { line("└── " + category + "/", "dir"); items.filter(function (item) { return item.path.startsWith(category + "/"); }).forEach(function (item) { line("    ├── " + baseName(item) + "/  " + item.title); }); }); }
      else line("bash: " + cmd + ": command not found", "error");
    }
    function runOne(task, preparedEntry) {
      var command = String(task.command || "").trim();
      if (!command) { processQueue(); return; }
      var entryState = preparedEntry ? { entry: preparedEntry, wasAtBottom: preparedEntry.dataset.keepScroll === "true" } : addEntry(command);
      var entry = entryState.entry, wasAtBottom = entryState.wasAtBottom;
      var result = entry.querySelector(".shell__result");
      if (!result) { result = document.createElement("div"); result.className = "shell__result"; entry.appendChild(result); }
      entry.dataset.status = "running";
      commandHistory.push(command); historyIndex = commandHistory.length;
      activeResult = result;
      activeCommandController = window.AbortController ? new AbortController() : null;
      var commandController = activeCommandController;
      var finished = false;
      function done() {
        if (finished) return; finished = true;
        activeResult = null; if (activeCommandController === commandController) activeCommandController = null;
        entry.dataset.keepScroll = String(wasAtBottom); completeEntry(entry); busy = false;
        if (queue.length) {
          queueTimer = setTimeout(function () { queueTimer = null; processQueue(); }, task.pauseAfterMs == null ? 90 : task.pauseAfterMs);
        } else processQueue();
      }
      try {
        var result = dispatch(command, entry);
        if (result && typeof result.then === "function") { busy = true; result.then(done, function () { line("Command failed.", "error"); done(); }); }
        else done();
      } catch (error) { line("Command failed: " + error.message, "error"); done(); }
    }
    function processQueue() {
      if (busy || introActive || queueTimer || !queue.length) return;
      var task = queue.shift();
      if (!task.animated || reduced) { runOne(task); return; }
      typeCommand(task.command, function (entry) { runOne(task, entry); }, task.speed);
    }
    function enqueue(command, animated) {
      queue.push({ command: command, animated: !!animated }); processQueue();
    }
    function typeCommand(command, done, speed) {
      var profile = speed || (/^whoami$/i.test(command) ? { min: 55, max: 92 } : /^cat writeups\//i.test(command) ? { min: 58, max: 98 } : { min: 52, max: 88 });
      var index = 0, cancelled = false, localTimers = [];
      input.value = ""; input.disabled = true; updateCursor();
      function finish(execute) {
        if (cancelled) return;
        cancelled = true; localTimers.forEach(clearTimeout); activeTyping = null;
        if (skip) skip.hidden = true;
        var typedCommand = execute ? command : input.value;
        input.disabled = false; input.value = typedCommand; updateCursor();
        var state = addEntry(typedCommand);
        input.value = ""; updateCursor(); input.focus({ preventScroll: true });
        if (execute) done(state.entry);
        else {
          activeResult = state.result; line("^C", "meta"); activeResult = null;
          completeEntry(state.entry); busy = false; processQueue();
        }
      }
      activeTyping = { cancel: finish };
      if (skip) { skip.textContent = "skip typing"; skip.hidden = false; }
      function step() {
        if (cancelled) return;
        if (index >= command.length) { localTimers.push(setTimeout(function () { finish(true); }, 360 + Math.random() * 240)); return; }
        var character = command.charAt(index++); input.value += character; updateCursor(); keySound();
        scrollToEnd(nearBottom());
        var pause = /[,;:]/.test(character) ? 130 + Math.random() * 100 : (character === "/" || character === ".") ? 70 + Math.random() * 55 : character === " " ? 45 + Math.random() * 35 : 0;
        localTimers.push(setTimeout(step, profile.min + Math.random() * (profile.max - profile.min) + pause));
      }
      busy = true; step();
    }
    function welcome() {
      if (welcomed) return;
      welcomed = true;
      queue.unshift({ command: "cat welcome.txt", animated: true, pauseAfterMs: 360 });
      queue.unshift({ command: "whoami", animated: true, pauseAfterMs: 700 });
      processQueue();
    }
    function updateCursor() {
      var text = input.value.slice(0, input.selectionStart || 0), measure = document.createElement("span");
      measure.style.cssText = "position:absolute;visibility:hidden;white-space:pre;font:inherit;letter-spacing:inherit"; measure.textContent = text;
      input.parentNode.appendChild(measure); root.querySelector(".shell__cursor").style.setProperty("--cursor-x", Math.max(0, measure.getBoundingClientRect().width - input.scrollLeft) + "px"); measure.remove();
    }
    function finishIntro(skipped) {
      if (!introActive) return;
      introActive = false; timers.forEach(clearTimeout); timers = [];
      root.classList.remove("shell--intro-typing");
      if (intro) { var activeLine = intro.querySelector(".shell__intro-line--active"); if (activeLine) activeLine.classList.remove("shell__intro-line--active"); }
      if (intro) { intro.hidden = false; intro.setAttribute("aria-hidden", "false"); }
      if (skip) skip.hidden = true;
      welcome();
    }
    function startIntro() {
      if (reduced) { welcome(); return; }
      introActive = true; intro.hidden = false; skip.hidden = false;
      root.classList.add("shell--intro-typing");
      intro.setAttribute("aria-hidden", "false");
      var rows = ["CTF-LAB // RESEARCH WORKSPACE"];
      var rowIndex = 0, charIndex = 0, node = null;
      function step() {
        if (!introActive) return;
        if (rowIndex >= rows.length) {
          skip.hidden = true;
          timers.push(setTimeout(function () {
            if (!introActive) return;
            introActive = false;
            if (node) node.classList.remove("shell__intro-line--active");
            root.classList.remove("shell--intro-typing");
            welcome();
          }, 650));
          return;
        }
        if (!node) { node = document.createElement("div"); node.className = "shell__intro-line shell__intro-line--active"; intro.appendChild(node); }
        if (charIndex < rows[rowIndex].length) { node.textContent += rows[rowIndex].charAt(charIndex++); keySound(); timers.push(setTimeout(step, 34 + Math.random() * 24)); }
        else { rowIndex++; charIndex = 0; if (rowIndex < rows.length) node = null; timers.push(setTimeout(step, 300)); }
      }
      timers.push(setTimeout(step, 220));
    }
    function directRouteCommand() {
      var aboutPath = new URL("about/", siteBase).pathname;
      if (location.pathname === aboutPath) { enqueue("cat about.txt", false); return; }
      var categoryPath = new URL("picoCTF/", siteBase).pathname;
      if (location.pathname === categoryPath) { enqueue("ls writeups/picoCTF/", false); return; }
      var item = items.find(function (candidate) { return new URL(candidate.href).pathname === location.pathname; });
      if (item) enqueue("cat " + quotePath(pathFor(item)), false);
    }

    form.addEventListener("submit", function (event) {
      event.preventDefault();
      var value = input.value; input.value = ""; updateCursor();
      if (value.trim()) enqueue(value, false);
      input.focus();
    });
    input.addEventListener("input", updateCursor);
    input.addEventListener("click", updateCursor);
    input.addEventListener("keyup", updateCursor);
    input.addEventListener("keydown", function (event) {
      if (event.key === "Backspace") keySound(true);
      else if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) keySound();
      if (event.key === "ArrowUp") { event.preventDefault(); if (historyIndex > 0) input.value = commandHistory[--historyIndex]; updateCursor(); }
      else if (event.key === "ArrowDown") { event.preventDefault(); if (historyIndex < commandHistory.length - 1) input.value = commandHistory[++historyIndex]; else { historyIndex = commandHistory.length; input.value = ""; } updateCursor(); }
      else if (event.ctrlKey && event.key.toLowerCase() === "l") { event.preventDefault(); output.querySelectorAll(".shell__entry,.shell__intro").forEach(function (node) { node.remove(); }); }
    });
    document.addEventListener("keydown", function (event) {
      if (!root.contains(event.target)) return;
      if (!event.ctrlKey || event.key.toLowerCase() !== "c" || event.defaultPrevented) return;
      if (window.getSelection && String(window.getSelection())) return;
      if (event.target.closest && event.target.closest("button,a,.md-clipboard")) return;
      event.preventDefault();
      if (introActive) finishIntro(true);
      else if (activeTyping) activeTyping.cancel(false);
      else if (busy && activeCommandController) activeCommandController.abort();
    });
    root.addEventListener("click", function (event) {
      var shortcut = event.target.closest && event.target.closest("[data-terminal-command]");
      if (shortcut) { event.preventDefault(); event.stopPropagation(); enqueue(shortcut.dataset.terminalCommand, true); input.focus({ preventScroll: true }); return; }
    });
    root.addEventListener("click", function (event) {
      if (event.target.closest && event.target.closest("button,a,input,textarea,select,summary,[role='button']")) return;
      if (window.getSelection && String(window.getSelection())) return;
      if (!input.disabled) input.focus({ preventScroll: true });
    });
    output.addEventListener("click", function (event) {
      var copy = event.target.closest && event.target.closest(".md-clipboard");
      if (copy) {
        event.preventDefault(); var pre = copy.parentElement && copy.parentElement.querySelector("pre code");
        if (pre && navigator.clipboard) navigator.clipboard.writeText(pre.innerText).then(function () { copy.setAttribute("title", "Copied"); }).catch(function () {});
        return;
      }
      var anchor = event.target.closest && event.target.closest("a[href]");
      if (!anchor) return;
      var target = new URL(anchor.href, document.baseURI);
      if (target.origin !== location.origin || target.hash && target.pathname === location.pathname) return;
      var aboutPath = new URL("about/", siteBase).pathname, categoryPath = new URL("picoCTF/", siteBase).pathname;
      var item = items.find(function (candidate) { return new URL(candidate.href).pathname === target.pathname; });
      if (item || target.pathname === aboutPath || target.pathname === categoryPath || target.pathname === siteBase.pathname) {
        event.preventDefault();
        enqueue(item ? "cat " + quotePath(pathFor(item)) : target.pathname === aboutPath ? "cat about.txt" : target.pathname === categoryPath ? "ls writeups/picoCTF/" : "pwd", true);
      }
    });
    if (skip) skip.addEventListener("click", function () { if(activeTyping)activeTyping.cancel(true);else finishIntro(true); input.focus({ preventScroll: true }); });
    root._ctfLabSession = {
      runCommand: function (command, animated) {
        enqueue(String(command || ""), animated !== false);
        input.focus({ preventScroll: true });
      },
      focus: function () { input.focus({ preventScroll: true }); },
      history: commandHistory
    };
    window.CTFLAB = window.CTFLAB || {};
    window.CTFLAB.initSession = initShell;
    window.CTFLAB.writeups = items;
    window.CTFLAB.runCommand = function (command, animated, targetRoot) {
      var target = targetRoot || document.querySelector('.desktop-window[data-focused="true"] .shell') || document.getElementById("shell");
      if (target && target._ctfLabSession) target._ctfLabSession.runCommand(command, animated);
    };
    if (!options.newSession) { startIntro(); directRouteCommand(); }
    input.focus({ preventScroll: true }); updateCursor(); updateSoundButtons();
    return root._ctfLabSession;
  }

  function initDefaultShell() { initShell(document.getElementById("shell")); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initDefaultShell); else initDefaultShell();
  if (window.document$) window.document$.subscribe(initDefaultShell);
})();
