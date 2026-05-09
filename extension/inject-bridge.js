// inject-bridge.js — persistent ProseMirror bridge in MAIN world
// Handles: selection/cursor reading
(function () {
  if (window.__CC_BRIDGE_READY__) return;
  window.__CC_BRIDGE_READY__ = true;

  function getEditor() {
    try { return window.APP && APP.core && APP.core.editor; } catch (_) { return null; }
  }

  function post(type, data) {
    data.type = type;
    window.postMessage(data, "*");
  }

  // Save cursor state so we know where the user was editing
  var savedSel = null;
  function saveSel() {
    try {
      var editor = getEditor();
      if (!editor || !editor.state) return;
      var sel = editor.selection || editor.state.selection;
      if (sel) savedSel = { from: sel.from, to: sel.to };
    } catch (_) {}
  }
  document.addEventListener("selectionchange", saveSel, true);

  window.addEventListener("message", function (e) {
    if (!e.data || typeof e.data !== "object") return;

    if (e.data.type === "__CC_READ_SEL__") {
      try {
        var editor = getEditor();
        if (!editor || !editor.state) {
          return post("__CC_SEL__", { text: "", from: 0, to: 0, isCursor: true, cursorContext: null });
        }
        var state = editor.state;
        var sel = editor.selection || state.selection;
        var from = sel ? sel.from : 0;
        var to = sel ? sel.to : 0;
        var text = "";
        if (from !== to && state.doc) {
          text = state.doc.textBetween(from, to, "\n") || "";
        }

        var ctx = null;
        try {
          var $pos = state.doc.resolve(from);
          var parentStart = $pos.start($pos.depth);
          var parentEnd = $pos.end($pos.depth);
          ctx = {
            nodeName: $pos.parent.type ? $pos.parent.type.name : "unknown",
            depth: $pos.depth,
            parentText: state.doc.textBetween(parentStart, Math.min(parentEnd, parentStart + 200), "\n"),
          };
        } catch (_) {}

        savedSel = { from: from, to: to };
        post("__CC_SEL__", { text: text, from: from, to: to, isCursor: from === to, cursorContext: ctx });
      } catch (x) {
        post("__CC_SEL__", { text: "", from: 0, to: 0, isCursor: true, cursorContext: null });
      }
    }
  });

  post("__CC_BRIDGE_READY__", {});
})();
