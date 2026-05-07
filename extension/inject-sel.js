// inject-sel.js — one-shot script injected into MAIN world to read WPS editor selection
(function () {
  try {
    var e = window.APP && APP.core && APP.core.editor;
    if (!e) return window.postMessage({ type: "__CC_SEL__", text: "" }, "*");
    var s = e.selection;
    if (!s || s.from === s.to) return window.postMessage({ type: "__CC_SEL__", text: "" }, "*");
    var t = e.state && e.state.doc && e.state.doc.textBetween(s.from, s.to, "\n");
    window.postMessage({ type: "__CC_SEL__", text: t || "" }, "*");
  } catch (x) {
    window.postMessage({ type: "__CC_SEL__", text: "" }, "*");
  }
})();
