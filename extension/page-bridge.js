// page-bridge.js — 运行在页面主世界（MAIN world），可以访问 APP.core.editor
// 通过 postMessage 把 WPS 编辑器选区文本传给 content script

(function () {
  function getSelectedText() {
    try {
      const editor = window.APP?.core?.editor;
      if (!editor) return "";
      const sel = editor.selection;
      if (!sel || sel.from === sel.to) return "";
      return editor.state?.doc?.textBetween?.(sel.from, sel.to, "\n")?.trim() || "";
    } catch (_) {
      return "";
    }
  }

  function postSelection() {
    const text = getSelectedText();
    window.postMessage({ type: "__CC_WPS_SELECTION__", text }, "*");
  }

  // 鼠标选中后读取
  document.addEventListener("mouseup", () => setTimeout(postSelection, 50), true);

  // 键盘选中（Shift+方向键）
  document.addEventListener("keyup", (e) => {
    if (e.shiftKey || e.key === "Shift") postSelection();
  }, true);

  // content script 可以主动请求当前选区
  window.addEventListener("message", (e) => {
    if (e.data?.type === "__CC_REQUEST_SELECTION__") {
      postSelection();
    }
  });
})();
