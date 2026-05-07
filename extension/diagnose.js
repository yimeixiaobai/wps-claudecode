// 在 WPS 365 文档页面的浏览器控制台里运行这段代码
// 先选中一些文档文本，然后粘贴运行

(function diagnose() {
  console.log("========== WPS Selection Diagnostic ==========\n");

  // 1. Standard selection API
  const sel = window.getSelection();
  console.log("1. window.getSelection():");
  console.log("   toString:", JSON.stringify(sel?.toString()));
  console.log("   rangeCount:", sel?.rangeCount);
  console.log("   type:", sel?.type);
  if (sel?.rangeCount > 0) {
    const range = sel.getRangeAt(0);
    console.log("   range.startContainer:", range.startContainer?.nodeName, range.startContainer);
    console.log("   range.endContainer:", range.endContainer?.nodeName, range.endContainer);
  }

  // 2. Check iframes
  const iframes = document.querySelectorAll("iframe");
  console.log("\n2. Iframes found:", iframes.length);
  iframes.forEach((f, i) => {
    try {
      const src = f.src || f.getAttribute("src") || "(none)";
      const origin = new URL(f.src || location.href).origin;
      console.log(`   [${i}] src=${src.slice(0, 100)}  origin=${origin}`);
      try {
        const iframeSel = f.contentWindow.getSelection();
        console.log(`   [${i}] selection: "${iframeSel?.toString()?.slice(0, 80)}"`);
      } catch (e) {
        console.log(`   [${i}] cross-origin, cannot access selection`);
      }
    } catch (e) {
      console.log(`   [${i}] error: ${e.message}`);
    }
  });

  // 3. Check contenteditable elements
  const editables = document.querySelectorAll("[contenteditable=true]");
  console.log("\n3. ContentEditable elements:", editables.length);
  editables.forEach((el, i) => {
    console.log(`   [${i}] tag=${el.tagName} class="${el.className?.slice(0, 80)}" id="${el.id}"`);
  });

  // 4. Check for editor-like DOM structures
  console.log("\n4. Editor DOM inspection:");
  const candidates = [
    ".editor-container", ".doc-editor", "#editor", ".ql-editor",
    "[data-editor]", ".ProseMirror", ".ce-block", ".tox-edit-area",
    ".kso-editor", ".kso-doc", ".editor", "#app-editor",
    ".view-content", ".doc-body", ".page-content",
  ];
  candidates.forEach(sel => {
    const els = document.querySelectorAll(sel);
    if (els.length) console.log(`   Found ${sel}: ${els.length} element(s)`, els[0]);
  });

  // 5. Check for global editor APIs
  console.log("\n5. Global editor APIs:");
  const apiKeys = Object.keys(window).filter(k => {
    const lower = k.toLowerCase();
    return lower.includes("editor") || lower.includes("wps") || lower.includes("kso")
      || lower.includes("kdocs") || lower.includes("airpage") || lower.includes("doc")
      || lower.includes("lingxi") || lower.includes("selection");
  });
  if (apiKeys.length) {
    apiKeys.forEach(k => console.log(`   window.${k}:`, typeof window[k], window[k]));
  } else {
    console.log("   (none found by name pattern)");
  }

  // 6. Check shadow DOMs
  console.log("\n6. Shadow DOM elements:");
  let shadowCount = 0;
  document.querySelectorAll("*").forEach(el => {
    if (el.shadowRoot) {
      shadowCount++;
      if (shadowCount <= 5) {
        console.log(`   tag=${el.tagName} class="${el.className?.toString().slice(0, 60)}"`);
        const innerEditables = el.shadowRoot.querySelectorAll("[contenteditable=true]");
        if (innerEditables.length) console.log(`     → contains ${innerEditables.length} contenteditable(s)`);
      }
    }
  });
  console.log(`   Total elements with shadowRoot: ${shadowCount}`);

  // 7. Listen for selection events (10 second window)
  console.log("\n7. Listening for selection events (10s)...");
  console.log("   → Please select some text in the document NOW");
  let eventLog = [];
  const handler = (e) => {
    const sel = window.getSelection();
    const text = sel?.toString() || "";
    eventLog.push({ type: e.type, text: text.slice(0, 50), target: e.target?.tagName });
  };
  document.addEventListener("selectionchange", handler);
  document.addEventListener("mouseup", (e) => {
    const sel = window.getSelection();
    console.log("   mouseup → selection:", JSON.stringify(sel?.toString()?.slice(0, 100)));
  }, { once: true });

  setTimeout(() => {
    document.removeEventListener("selectionchange", handler);
    console.log("\n   Selection events captured:", eventLog.length);
    eventLog.forEach((e, i) => {
      if (i < 20) console.log(`   ${e.type}: target=${e.target} text="${e.text}"`);
    });
    console.log("\n========== Diagnostic Complete ==========");
  }, 10000);

  console.log("\n(waiting 10s for you to select text...)\n");
})();
