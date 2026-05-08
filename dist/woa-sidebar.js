// WOA 侧栏注入 — 在 WPS协作 DevTools 控制台粘贴运行
// 再次运行可关闭侧栏
(function(){var id='cc-sidebar-frame';var f=document.getElementById(id);if(f){f.remove();document.body.style.marginRight='';return;}f=document.createElement('iframe');f.id=id;f.src='http://localhost:5174/panel';f.style.cssText='position:fixed;right:0;top:0;width:400px;height:100vh;border:none;z-index:99999;box-shadow:-2px 0 12px rgba(0,0,0,0.08);';document.body.appendChild(f);document.body.style.marginRight='400px';})();
