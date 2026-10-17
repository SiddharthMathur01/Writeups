(function () {
  "use strict";
  function initDirectory() {
    var filter = document.getElementById("directory-filter");
    var sort = document.getElementById("directory-sort");
    var tbody = document.getElementById("directory-rows");
    if (!filter || !sort || !tbody || tbody.dataset.ready) return;
    tbody.dataset.ready = "1";
    var rows = Array.prototype.slice.call(tbody.querySelectorAll(".directory-row"));
    var empty = document.getElementById("directory-empty-filter");
    var count = document.getElementById("directory-count");
    var total = document.getElementById("directory-total");
    function update() {
      var query = filter.value.trim().toLowerCase();
      var visible = 0;
      rows.forEach(function (row) {
        var text = ["name", "platform", "category", "difficulty", "date", "tags", "description"].map(function (key) { return row.dataset[key] || ""; }).join(" ");
        row.hidden = !!query && text.indexOf(query) === -1;
        if (!row.hidden) visible++;
      });
      if (empty) empty.hidden = visible !== 0;
      if (count) count.textContent = visible + " / " + rows.length + " entries";
      if (total) total.textContent = rows.length + " writeup" + (rows.length === 1 ? "" : "s") + " indexed";
    }
    function order() {
      var key = sort.value;
      rows.sort(function (a, b) {
        var av = a.dataset[key] || "", bv = b.dataset[key] || "";
        if (key === "date") return bv.localeCompare(av) || a.dataset.name.localeCompare(b.dataset.name);
        return av.localeCompare(bv, undefined, { sensitivity: "base", numeric: true });
      });
      rows.forEach(function (row) { tbody.insertBefore(row, empty || null); });
      update();
    }
    filter.addEventListener("input", update);
    sort.addEventListener("change", order);
    filter.addEventListener("keydown", function (event) { if (event.key === "Escape") { filter.value = ""; update(); } });
    update();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initDirectory); else initDirectory();
  if (window.document$) window.document$.subscribe(initDirectory);
})();
