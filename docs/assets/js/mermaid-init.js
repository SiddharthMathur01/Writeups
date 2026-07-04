/* Initializes Mermaid diagrams to match the monochrome CTF theme and
   re-renders when the color scheme is toggled. */

(function () {
  "use strict";

  function isDark() {
    var scheme = document.body.getAttribute("data-md-color-scheme");
    return scheme === "ctf-dark";
  }

  function configure() {
    if (typeof mermaid === "undefined") return;

    mermaid.initialize({
      startOnLoad: false,
      theme: "base",
      themeVariables: isDark()
        ? {
            background: "#0B0B0C",
            primaryColor: "#141416",
            primaryTextColor: "#F3F3F4",
            primaryBorderColor: "#34343A",
            lineColor: "#9C9CA1",
            fontFamily: "Public Sans, sans-serif",
          }
        : {
            background: "#FFFFFF",
            primaryColor: "#FFFFFF",
            primaryTextColor: "#0A0A0A",
            primaryBorderColor: "#DADADA",
            lineColor: "#68686B",
            fontFamily: "Public Sans, sans-serif",
          },
    });
  }

  function render() {
    if (typeof mermaid === "undefined") return;
    var nodes = document.querySelectorAll(".mermaid");
    if (!nodes.length) return;
    configure();
    try {
      mermaid.run({ nodes: nodes });
    } catch (e) {
      /* older mermaid fallback */
      if (mermaid.init) mermaid.init(undefined, nodes);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", render);
  } else {
    render();
  }

  if (window.document$) {
    window.document$.subscribe(render);
  }
})();
