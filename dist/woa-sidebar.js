// ═══════════════════════════════════════════════════════════════
// Claude Code for WPS协作 (WOA) — Webview 中继模式
//
// 安装方法:
//   1. 在 WOA 中按 F12 打开 DevTools
//   2. 切到 Sources（源代码）→ Snippets（代码段）
//   3. 点 + New snippet，命名为 "Claude Code"
//   4. 粘贴此文件全部内容，Ctrl+S 保存
//   5. 右键 snippet → Run（或 Ctrl+Enter）即可启动
//
// 使用：运行后右下角出现橘色按钮，点击打开面板。
//       再次运行 snippet 可关闭。
//       需要先启动 Bridge（双击 install.command 或手动 cd bridge && npm start）
// ═══════════════════════════════════════════════════════════════

(function () {
  'use strict';

  var BRIDGE = 'http://localhost:5174';
  var fabId = 'cc-woa-fab';
  var frameId = 'cc-float-frame';
  var styleId = 'cc-woa-style';
  var relayKey = '__cc_woa_relay__';

  // ── Toggle: 已注入则关闭 ──
  if (document.getElementById(fabId)) {
    document.getElementById(fabId)?.remove();
    document.getElementById(frameId)?.remove();
    document.getElementById(styleId)?.remove();
    if (window[relayKey]) {
      window[relayKey].forEach(clearInterval);
      delete window[relayKey];
    }
    if (window.__cc_woa_msg_handler__) {
      window.removeEventListener('message', window.__cc_woa_msg_handler__);
      delete window.__cc_woa_msg_handler__;
    }
    console.log('[CC] 已关闭');
    return;
  }

  // ── 状态 ──
  var activeWv = null;
  var docUrl = '';
  var docTitle = '';
  var bridgeInjectedWvs = new WeakSet();

  // ── 标题占位符过滤 ──
  var TITLE_PLACEHOLDERS = ['文档详情', 'WPS协作', 'WPS 365', ''];

  // ── Webview 桥接代码（注入到 webview 内部）──
  var bridgeCode = [
    '(function(){',
    '  if(window.__CC_WV_BRIDGE__)return;',
    '  window.__CC_WV_BRIDGE__=true;',
    '  window.__CC_SEL_DATA__={text:"",from:0,to:0,isCursor:true,cursorContext:null,docTitle:document.title||""};',
    '  function u(){',
    '    try{',
    '      var e=window.APP&&APP.core&&APP.core.editor;',
    '      if(!e||!e.state)return;',
    '      var st=e.state;',
    '      var sel=e.selection||st.selection;',
    '      var from=sel?sel.from:0,to=sel?sel.to:0;',
    '      var text="";',
    '      if(from!==to&&st.doc)text=st.doc.textBetween(from,to,"\\n")||"";',
    '      var ctx=null;',
    '      try{',
    '        var p=st.doc.resolve(from);',
    '        var ps=p.start(p.depth),pe=p.end(p.depth);',
    '        ctx={nodeName:p.parent.type?p.parent.type.name:"unknown",depth:p.depth,',
    '          parentText:st.doc.textBetween(ps,Math.min(pe,ps+200),"\\n")};',
    '      }catch(_){}',
    '      window.__CC_SEL_DATA__={text:text,from:from,to:to,isCursor:from===to,cursorContext:ctx,docTitle:document.title||""};',
    '    }catch(_){}',
    '  }',
    '  document.addEventListener("selectionchange",u,true);',
    '  document.addEventListener("mouseup",function(){setTimeout(u,50)},true);',
    '  document.addEventListener("keyup",function(e){if(e.shiftKey||e.key==="Shift")u()},true);',
    '  u();',
    '})()'
  ].join('\n');

  // ── 向 webview 注入桥接（幂等）──
  function injectBridge(wv) {
    if (!wv || bridgeInjectedWvs.has(wv)) return;
    bridgeInjectedWvs.add(wv);
    wv.executeJavaScript(bridgeCode)
      .then(function () { console.log('[CC] 桥接已注入:', (wv.src || '').slice(0, 60)); })
      .catch(function () {});
    wv.addEventListener('did-finish-load', function () {
      wv.executeJavaScript(bridgeCode).catch(function () {});
    });
  }

  // ── 获取当前可见的文档 webview（通过 CSS visibility）──
  function getVisibleDocWebview() {
    var wvs = [].slice.call(document.querySelectorAll('webview'));
    for (var i = 0; i < wvs.length; i++) {
      var wv = wvs[i];
      if (!(wv.src || '').match(/365\.kdocs\.cn\/l\//)) continue;
      if (getComputedStyle(wv).visibility === 'visible') return wv;
    }
    return null;
  }

  // ── 获取活跃 tab 标题（从 tab 栏 DOM 读取，过滤占位符）──
  function getActiveTabTitle() {
    var el = document.querySelector('.tab-item-renderer.active');
    var t = el ? el.textContent.trim() : '';
    return TITLE_PLACEHOLDERS.indexOf(t) === -1 ? t : '';
  }

  // ── 同步活跃 webview 状态，检测 tab 切换 ──
  function syncActiveWebview() {
    var visible = getVisibleDocWebview();
    var fab = document.getElementById(fabId);
    var frame = document.getElementById(frameId);

    if (!visible) {
      if (fab) fab.style.display = 'none';
      if (frame) frame.classList.remove('cc-show');
      return;
    }

    if (fab) fab.style.display = '';

    if (visible !== activeWv) {
      activeWv = visible;
      docUrl = (activeWv.src || '').split('?')[0];
      docTitle = getActiveTabTitle();
      injectBridge(activeWv);

      // 重载 iframe 让 inject-console.js 用新 docId 初始化会话隔离
      var frame = document.getElementById(frameId);
      if (frame) {
        var wasOpen = frame.classList.contains('cc-show');
        frame.src = BRIDGE + '/panel?mode=sidebar' +
          '&docUrl=' + encodeURIComponent(docUrl) +
          '&docTitle=' + encodeURIComponent(docTitle);
        if (wasOpen) frame.classList.add('cc-show');
      }

      console.log('[CC] 活跃文档切换 →', docTitle || '(标题加载中…)', docUrl);
    }
  }

  // ── 状态点由 iframe 内的检测结果驱动（外壳 file:// 无法直接 fetch Bridge）──
  window.addEventListener('message', function (e) {
    if (!e.data || typeof e.data !== 'object') return;
    if (e.data.type === '__CC_HEALTH__') {
      var dot = document.querySelector('#' + fabId + ' .cc-status-dot');
      if (dot) dot.className = 'cc-status-dot ' + (e.data.online ? 'cc-online' : 'cc-offline');
    }
    if (e.data.type === '__CC_UPDATE__') {
      var dot = document.querySelector('#' + fabId + ' .cc-update-dot');
      if (dot && e.data.hasUpdate) dot.classList.add('cc-update-available');
      else if (dot) dot.classList.remove('cc-update-available');
    }
  });

  // ── 从活跃 webview 读选区并推送给 iframe ──
  function relaySelection(frame) {
    if (!activeWv || !frame || !frame.contentWindow) return;
    var currentDocUrl = (activeWv.src || '').split('?')[0];
    activeWv.executeJavaScript('window.__CC_SEL_DATA__')
      .then(function (data) {
        if (data && frame.contentWindow) {
          data.type = '__CC_SEL__';
          data.docUrl = currentDocUrl;
          var wvTitle = data.docTitle || '';
          if (wvTitle && TITLE_PLACEHOLDERS.indexOf(wvTitle) === -1) docTitle = wvTitle;
          else { var t = getActiveTabTitle(); if (t) docTitle = t; }
          data.docTitle = docTitle;
          frame.contentWindow.postMessage(data, '*');
        }
      })
      .catch(function () {});
  }

  // ── 初始化 ──
  (function init() {
    syncActiveWebview();
    createUI();
    startRelay();
    console.log(
      '[CC] ✅ Claude Code 已注入！' +
      (docUrl ? ' 文档: ' + docUrl : ' (未检测到文档)') +
      (activeWv ? '' : ' ⚠ 未找到 webview，选区功能不可用')
    );
  })();

  // ── 创建 UI（FAB + iframe 面板）──
  function createUI() {
    var style = document.createElement('style');
    style.id = styleId;
    style.textContent = [
      '#' + fabId + '{position:fixed;right:24px;bottom:24px;width:46px;height:46px;border-radius:50%;background:#D97757;color:#fff;display:flex;align-items:center;justify-content:center;cursor:pointer;box-shadow:0 3px 14px rgba(217,119,87,0.35);z-index:99999;border:none;outline:none;transition:box-shadow 0.2s,transform 0.15s;overflow:visible}',
      '#' + fabId + ':hover{box-shadow:0 5px 22px rgba(217,119,87,0.45);transform:translateY(-1px)}',
      '#' + fabId + ':active{transform:scale(0.94)}',
      '#' + fabId + ' svg{width:20px;height:20px;fill:none;stroke:currentColor;stroke-width:1.8}',
      '#' + fabId + '::after{content:"";position:absolute;inset:-5px;border-radius:50%;border:1.5px solid #D97757;opacity:0;pointer-events:none;transition:opacity 0.3s,transform 0.4s cubic-bezier(0.34,1.56,0.64,1);transform:scale(0.9)}',
      '#' + fabId + ':hover::after{opacity:0.4;transform:scale(1.15)}',
      '#' + fabId + ' .cc-status-dot{position:absolute;top:-1px;right:-1px;width:9px;height:9px;border-radius:50%;background:#b0b0ba;border:2px solid #fff;z-index:1;transition:background 0.3s;box-sizing:border-box}',
      '#' + fabId + ' .cc-status-dot.cc-online{background:#5cb87a}',
      '#' + fabId + ' .cc-status-dot.cc-offline{background:#e05c5c}',
      '#' + fabId + ' .cc-update-dot{position:absolute;top:-1px;left:-1px;width:9px;height:9px;border-radius:50%;background:#e05c5c;border:2px solid #fff;z-index:2;display:none;box-sizing:border-box}',
      '#' + fabId + ' .cc-update-dot.cc-update-available{display:block}',
      '#' + frameId + '{position:fixed;right:16px;bottom:80px;width:420px;height:560px;border:none;z-index:99998;border-radius:12px;box-shadow:0 12px 40px rgba(0,0,0,0.12);display:none}',
      '#' + frameId + '.cc-show{display:block}'
    ].join('\n');
    document.head.appendChild(style);

    var fab = document.createElement('div');
    fab.id = fabId;
    fab.title = 'Claude Code';
    fab.innerHTML = '<svg viewBox="0 0 24 24"><path d="M12 2L14.5 9.5L22 12L14.5 14.5L12 22L9.5 14.5L2 12L9.5 9.5L12 2Z"/></svg>' +
      '<span class="cc-status-dot"></span><span class="cc-update-dot"></span>';
    document.body.appendChild(fab);

    var frame = document.createElement('iframe');
    frame.id = frameId;
    frame.src = BRIDGE + '/panel?mode=sidebar' +
      '&docUrl=' + encodeURIComponent(docUrl) +
      '&docTitle=' + encodeURIComponent(docTitle);
    frame.allow = 'clipboard-write';
    document.body.appendChild(frame);

    fab.addEventListener('click', function () {
      frame.classList.toggle('cc-show');
    });

    // ── 快捷键：Alt+J 切换面板，Esc 关闭 ──
    window.addEventListener('keydown', function (e) {
      if (e.altKey && (e.key === 'j' || e.key === 'J')) {
        e.preventDefault();
        frame.classList.toggle('cc-show');
      }
      if (e.key === 'Escape' && frame.classList.contains('cc-show')) {
        frame.classList.remove('cc-show');
      }
    });

    // ── 面板拖拽（按住顶部 30px 区域拖动）──
    (function () {
      var dragging = false, sx, sy, sl, st;
      frame.addEventListener('mousedown', function (e) {
        var rect = frame.getBoundingClientRect();
        if (e.clientY - rect.top > 30) return;
        dragging = true;
        sx = e.clientX; sy = e.clientY;
        sl = rect.left; st = rect.top;
        frame.style.right = 'auto'; frame.style.bottom = 'auto';
        frame.style.left = sl + 'px'; frame.style.top = st + 'px';
        frame.style.pointerEvents = 'none';
        document.body.style.userSelect = 'none';
        e.preventDefault();
      });
      window.addEventListener('mousemove', function (e) {
        if (!dragging) return;
        frame.style.left = Math.max(0, Math.min(innerWidth - 100, sl + e.clientX - sx)) + 'px';
        frame.style.top = Math.max(0, Math.min(innerHeight - 100, st + e.clientY - sy)) + 'px';
      });
      window.addEventListener('mouseup', function () {
        if (dragging) {
          dragging = false;
          frame.style.pointerEvents = '';
          document.body.style.userSelect = '';
        }
      });
    })();

    // ── 面板缩放（右下角拖拽手柄）──
    (function () {
      var handle = document.createElement('div');
      handle.style.cssText = 'position:fixed;width:16px;height:16px;cursor:nwse-resize;z-index:99999;display:none;';
      document.body.appendChild(handle);

      function positionHandle() {
        if (!frame.classList.contains('cc-show')) { handle.style.display = 'none'; return; }
        var r = frame.getBoundingClientRect();
        handle.style.left = (r.right - 16) + 'px';
        handle.style.top = (r.bottom - 16) + 'px';
        handle.style.display = 'block';
      }

      var resizing = false, rsx, rsy, rsw, rsh;
      handle.addEventListener('mousedown', function (e) {
        resizing = true;
        var rect = frame.getBoundingClientRect();
        rsx = e.clientX; rsy = e.clientY; rsw = rect.width; rsh = rect.height;
        frame.style.pointerEvents = 'none';
        document.body.style.userSelect = 'none';
        e.preventDefault(); e.stopPropagation();
      });
      window.addEventListener('mousemove', function (e) {
        if (!resizing) return;
        frame.style.width = Math.max(320, Math.min(600, rsw + e.clientX - rsx)) + 'px';
        frame.style.height = Math.max(340, Math.min(innerHeight * 0.9, rsh + e.clientY - rsy)) + 'px';
        positionHandle();
      });
      window.addEventListener('mouseup', function () {
        if (resizing) {
          resizing = false;
          frame.style.pointerEvents = '';
          document.body.style.userSelect = '';
        }
      });

      var observer = new MutationObserver(positionHandle);
      observer.observe(frame, { attributes: true, attributeFilter: ['class'] });
    })();
  }

  // ── 启动选区/光标中继 ──
  function startRelay() {
    var frame = document.getElementById(frameId);
    var timers = [];
    var tick = 0;

    var selRelay = setInterval(function () {
      if (!frame || !frame.contentWindow) return;
      tick++;

      if (tick % 3 === 0) syncActiveWebview();

      if (!activeWv || !frame.classList.contains('cc-show')) return;

      relaySelection(frame);
    }, 300);
    timers.push(selRelay);

    var msgHandler = function (e) {
      if (e.data && e.data.type === '__CC_READ_SEL__') {
        syncActiveWebview();
        relaySelection(frame);
      }
    };
    window.addEventListener('message', msgHandler);
    window.__cc_woa_msg_handler__ = msgHandler;

    window[relayKey] = timers;
  }
})();
