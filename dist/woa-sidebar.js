// WOA 悬浮注入 — 在 WPS协作 DevTools 控制台粘贴运行
// 再次运行可关闭
(function(){
  var fabId='cc-woa-fab', frameId='cc-float-frame';
  // Toggle: if already injected, remove everything
  if(document.getElementById(fabId)){
    document.getElementById(fabId)?.remove();
    document.getElementById(frameId)?.remove();
    document.getElementById('cc-woa-style')?.remove();
    return;
  }
  // Extract doc info
  var docUrl='', activeSpan=document.querySelector('[class*=active] span');
  var docTitle=activeSpan?activeSpan.textContent.trim():'';
  var wvs=[...document.querySelectorAll('webview')];
  for(var i=wvs.length-1;i>=0;i--){
    var s=wvs[i].src||'';
    if(s.match(/365\.kdocs\.cn\/l\/[A-Za-z0-9]+/)){docUrl=s.split('?')[0];break;}
  }
  if(!docUrl){var links=document.body.innerHTML.match(/https:\/\/365\.kdocs\.cn\/l\/[A-Za-z0-9]+/g);if(links)docUrl=links[links.length-1];}
  // Inject styles
  var style=document.createElement('style');style.id='cc-woa-style';
  style.textContent=`
    #${fabId}{position:fixed;right:24px;bottom:24px;width:46px;height:46px;border-radius:50%;background:#D97757;color:#fff;display:flex;align-items:center;justify-content:center;cursor:pointer;box-shadow:0 3px 14px rgba(217,119,87,0.35);z-index:99999;border:none;outline:none;transition:box-shadow 0.2s,transform 0.15s;overflow:visible;}
    #${fabId}:hover{box-shadow:0 5px 22px rgba(217,119,87,0.45);transform:translateY(-1px);}
    #${fabId}:active{transform:scale(0.94);}
    #${fabId} svg{width:20px;height:20px;fill:none;stroke:currentColor;stroke-width:1.8;}
    #${fabId}::after{content:'';position:absolute;inset:-5px;border-radius:50%;border:1.5px solid #D97757;opacity:0;pointer-events:none;transition:opacity 0.3s,transform 0.4s cubic-bezier(0.34,1.56,0.64,1);transform:scale(0.9);}
    #${fabId}:hover::after{opacity:0.4;transform:scale(1.15);}
    #${frameId}{position:fixed;right:16px;bottom:80px;width:420px;height:560px;border:none;z-index:99998;border-radius:12px;box-shadow:0 12px 40px rgba(0,0,0,0.12);display:none;}
    #${frameId}.cc-show{display:block;}
  `;
  document.head.appendChild(style);
  // FAB button (native DOM, no iframe, no CSP issue)
  var fab=document.createElement('div');fab.id=fabId;
  fab.innerHTML='<svg viewBox="0 0 24 24"><path d="M12 2L14.5 9.5L22 12L14.5 14.5L12 22L9.5 14.5L2 12L9.5 9.5L12 2Z"/></svg>';
  document.body.appendChild(fab);
  // Panel iframe
  var frame=document.createElement('iframe');frame.id=frameId;
  frame.src='http://localhost:5174/panel?mode=sidebar&docUrl='+encodeURIComponent(docUrl)+'&docTitle='+encodeURIComponent(docTitle);
  frame.allow='clipboard-write';
  document.body.appendChild(frame);
  // Toggle panel
  fab.addEventListener('click',function(){
    frame.classList.toggle('cc-show');
  });
})();
