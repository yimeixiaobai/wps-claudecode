// Claude Code for WPS — 控制台一键注入版
// 在 WPS协作 的 DevTools Console 中粘贴运行

// CSS
(function(){var s=document.createElement("style");s.textContent="/* Claude Code for WPS 365 */\n\n@import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,wght@0,400;0,500;0,600;0,700;1,400&family=JetBrains+Mono:wght@400;500&display=swap');\n\n:root {\n  /* Surface palette — clean light base */\n  --cc-surface-0: #f5f5f5;\n  --cc-surface-1: #ffffff;\n  --cc-surface-2: #f9f9fa;\n  --cc-surface-3: #e8e8eb;\n  --cc-surface-4: #d5d5da;\n\n  /* Text hierarchy */\n  --cc-text-primary: #1a1a1e;\n  --cc-text-secondary: #5a5a63;\n  --cc-text-muted: #8a8a95;\n  --cc-text-ghost: #b0b0ba;\n\n  /* Claude orange accent */\n  --cc-ember: #D97757;\n  --cc-ember-hover: #c4684a;\n  --cc-ember-glow: rgba(217, 119, 87, 0.2);\n  --cc-ember-dim: rgba(217, 119, 87, 0.08);\n\n  /* Semantic */\n  --cc-success: #5cb87a;\n  --cc-error: #e05c5c;\n  --cc-error-bg: rgba(224, 92, 92, 0.1);\n\n  /* Radii & type */\n  --cc-r: 12px;\n  --cc-r-sm: 8px;\n  --cc-font: 'DM Sans', -apple-system, 'PingFang SC', 'Microsoft YaHei', sans-serif;\n  --cc-mono: 'JetBrains Mono', 'SF Mono', ui-monospace, monospace;\n}\n\n/* ────────────────── FAB ────────────────── */\n.cc-fab {\n  position: fixed;\n  right: 24px;\n  bottom: 24px;\n  width: 46px;\n  height: 46px;\n  border-radius: 50%;\n  background: var(--cc-ember);\n  color: #fff;\n  display: flex;\n  align-items: center;\n  justify-content: center;\n  cursor: pointer;\n  box-shadow:\n    0 3px 14px rgba(217,119,87,0.35),\n    0 1px 3px rgba(0,0,0,0.1);\n  z-index: 99999;\n  user-select: none;\n  border: none;\n  outline: none;\n  padding: 0;\n  overflow: visible;\n  transition: box-shadow 0.25s ease, transform 0.15s ease;\n}\n.cc-fab:hover {\n  box-shadow:\n    0 5px 22px rgba(217,119,87,0.45),\n    0 1px 4px rgba(0,0,0,0.1);\n  transform: translateY(-1px);\n}\n.cc-fab:active { transform: scale(0.94); }\n.cc-fab.cc-streaming {\n  animation: cc-pulse 2s ease-in-out infinite;\n}\n.cc-fab.cc-streaming:hover { animation: none; }\n@keyframes cc-pulse {\n  0%, 100% { box-shadow: 0 3px 14px rgba(217,119,87,0.35), 0 1px 3px rgba(0,0,0,0.1); }\n  50% { box-shadow: 0 3px 22px rgba(217,119,87,0.65), 0 1px 3px rgba(0,0,0,0.1), 0 0 12px rgba(217,119,87,0.25); }\n}\n.cc-fab svg {\n  width: 20px; height: 20px;\n  fill: none; stroke: currentColor; stroke-width: 1.8;\n}\n\n/* Hover ring */\n.cc-fab::after {\n  content: '';\n  position: absolute;\n  inset: -5px;\n  border-radius: 50%;\n  border: 1.5px solid var(--cc-ember);\n  opacity: 0;\n  pointer-events: none;\n  transition: opacity 0.3s ease, transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);\n  transform: scale(0.9);\n}\n.cc-fab:hover::after {\n  opacity: 0.4;\n  transform: scale(1.15);\n}\n\n/* Status dot */\n.cc-status-dot {\n  position: absolute;\n  top: -1px;\n  right: -1px;\n  width: 9px;\n  height: 9px;\n  border-radius: 50%;\n  background: var(--cc-text-ghost);\n  border: 2px solid #fff;\n  transition: background 0.3s ease;\n  z-index: 1;\n}\n.cc-status-dot.cc-online { background: var(--cc-success); }\n.cc-status-dot.cc-offline { background: var(--cc-error); }\n\n/* Update dot */\n.cc-update-dot {\n  position: absolute;\n  top: -3px;\n  left: -3px;\n  width: 10px;\n  height: 10px;\n  border-radius: 50%;\n  background: var(--cc-error);\n  border: 2px solid #fff;\n  z-index: 2;\n  display: none;\n  animation: cc-update-ping 2s ease-in-out 3;\n}\n.cc-update-dot.cc-update-available { display: block; }\n@keyframes cc-update-ping {\n  0%, 100% { transform: scale(1); }\n  50% { transform: scale(1.3); }\n}\n\n/* ────────────────── UPDATE BANNER ────────────────── */\n.cc-update-banner {\n  display: none;\n  align-items: center;\n  gap: 6px;\n  padding: 6px 12px;\n  background: linear-gradient(135deg, rgba(217,119,87,0.1), rgba(217,119,87,0.05));\n  border-bottom: 1px solid var(--cc-surface-3);\n  font-size: 11px;\n  color: var(--cc-text-secondary);\n  flex-shrink: 0;\n}\n.cc-update-icon {\n  width: 18px;\n  height: 18px;\n  border-radius: 50%;\n  background: var(--cc-ember);\n  color: #fff;\n  display: flex;\n  align-items: center;\n  justify-content: center;\n  font-size: 11px;\n  font-weight: 700;\n  flex-shrink: 0;\n}\n.cc-update-text {\n  flex: 1;\n  min-width: 0;\n  white-space: nowrap;\n  overflow: hidden;\n  text-overflow: ellipsis;\n}\n.cc-update-text strong { color: var(--cc-ember); font-weight: 600; }\n.cc-update-link {\n  flex-shrink: 0;\n  color: var(--cc-ember);\n  text-decoration: none;\n  font-weight: 500;\n  font-size: 11px;\n  transition: opacity 0.12s;\n}\n.cc-update-link:hover { opacity: 0.8; text-decoration: underline; }\n.cc-update-now-btn {\n  flex-shrink: 0;\n  background: var(--cc-ember);\n  color: #fff;\n  border: none;\n  border-radius: 4px;\n  padding: 2px 10px;\n  font-family: var(--cc-font);\n  font-size: 11px;\n  font-weight: 500;\n  cursor: pointer;\n  transition: opacity 0.12s;\n}\n.cc-update-now-btn:hover:not(:disabled) { opacity: 0.85; }\n.cc-update-now-btn:disabled { opacity: 0.5; cursor: not-allowed; }\n.cc-update-dismiss {\n  flex-shrink: 0;\n  background: none;\n  border: none;\n  color: var(--cc-text-muted);\n  font-size: 14px;\n  cursor: pointer;\n  padding: 0 2px;\n  line-height: 1;\n}\n.cc-update-dismiss:hover { color: var(--cc-text-primary); }\n\n/* ────────────────── PANEL ────────────────── */\n.cc-panel {\n  position: fixed;\n  right: 24px;\n  bottom: 82px;\n  width: 390px;\n  height: 530px;\n  min-width: 320px;\n  min-height: 340px;\n  max-width: 600px;\n  max-height: 80vh;\n  background: var(--cc-surface-1);\n  border: 1px solid var(--cc-surface-3);\n  border-radius: var(--cc-r);\n  box-shadow:\n    0 12px 40px rgba(0,0,0,0.12),\n    0 2px 6px rgba(0,0,0,0.06);\n  z-index: 99999;\n  display: none;\n  flex-direction: column;\n  font-family: var(--cc-font);\n  font-size: 13px;\n  color: var(--cc-text-primary);\n  overflow: hidden;\n  contain: layout style paint;\n}\n.cc-panel.cc-visible {\n  display: flex;\n  animation: cc-emerge 0.22s cubic-bezier(0.16, 1, 0.3, 1);\n}\n@keyframes cc-emerge {\n  from { opacity: 0; transform: translateY(8px) scale(0.97); }\n  to   { opacity: 1; transform: none; }\n}\n\n/* ────────────────── HEADER ────────────────── */\n.cc-header {\n  display: flex;\n  justify-content: space-between;\n  align-items: center;\n  padding: 10px 14px;\n  border-bottom: 1px solid var(--cc-surface-3);\n  cursor: grab;\n  user-select: none;\n  flex-shrink: 0;\n  background: var(--cc-surface-1);\n}\n.cc-header:active { cursor: grabbing; }\n\n.cc-title {\n  font-weight: 600;\n  font-size: 13px;\n  display: flex;\n  align-items: center;\n  gap: 7px;\n  color: var(--cc-text-primary);\n  letter-spacing: -0.01em;\n}\n.cc-title svg { width: 14px; height: 14px; color: var(--cc-ember); }\n\n.cc-header-actions { display: flex; align-items: center; gap: 2px; }\n.cc-header-btn {\n  background: none;\n  border: none;\n  width: 26px;\n  height: 26px;\n  border-radius: 6px;\n  display: flex;\n  align-items: center;\n  justify-content: center;\n  cursor: pointer;\n  color: var(--cc-text-muted);\n  padding: 0;\n  transition: background 0.12s, color 0.12s;\n}\n.cc-header-btn svg { width: 13px; height: 13px; }\n.cc-header-btn:hover {\n  background: var(--cc-surface-3);\n  color: var(--cc-text-secondary);\n}\n\n/* Context bar hidden — selection now shown in input area */\n\n/* ────────────────── SESSION LIST ────────────────── */\n.cc-session-list {\n  display: none;\n  flex-direction: column;\n  max-height: 200px;\n  overflow-y: auto;\n  border-bottom: 1px solid var(--cc-surface-3);\n  background: var(--cc-surface-0);\n}\n.cc-session-list.cc-sl-visible { display: flex; }\n.cc-sl-empty {\n  padding: 12px;\n  text-align: center;\n  color: var(--cc-text-ghost);\n  font-size: 12px;\n}\n.cc-sl-item {\n  display: flex;\n  align-items: center;\n  padding: 7px 12px;\n  gap: 8px;\n  cursor: pointer;\n  transition: background 0.1s;\n  border-bottom: 1px solid var(--cc-surface-2);\n}\n.cc-sl-item:last-child { border-bottom: none; }\n.cc-sl-item:hover { background: var(--cc-surface-2); }\n.cc-sl-item.cc-sl-active {\n  background: var(--cc-ember-dim);\n  border-left: 3px solid var(--cc-ember);\n  padding-left: 9px;\n}\n.cc-sl-info { flex: 1; min-width: 0; }\n.cc-sl-title {\n  font-size: 12px;\n  font-weight: 500;\n  color: var(--cc-text-primary);\n  white-space: nowrap;\n  overflow: hidden;\n  text-overflow: ellipsis;\n}\n.cc-sl-time {\n  font-size: 10px;\n  color: var(--cc-text-ghost);\n  margin-top: 1px;\n}\n.cc-sl-del {\n  flex-shrink: 0;\n  background: none;\n  border: none;\n  color: var(--cc-text-ghost);\n  font-size: 16px;\n  cursor: pointer;\n  padding: 0 4px;\n  line-height: 1;\n  opacity: 0;\n  transition: opacity 0.1s, color 0.1s;\n}\n.cc-sl-item:hover .cc-sl-del { opacity: 1; }\n.cc-sl-del:hover { color: var(--cc-error); }\n\n/* Session list tabs */\n.cc-sl-tabs {\n  display: flex;\n  border-bottom: 1px solid var(--cc-surface-3);\n  flex-shrink: 0;\n}\n.cc-sl-tab {\n  flex: 1;\n  text-align: center;\n  padding: 7px 0;\n  font-size: 11px;\n  color: var(--cc-text-muted);\n  cursor: pointer;\n  transition: color 0.12s, border-color 0.12s;\n  border-bottom: 2px solid transparent;\n}\n.cc-sl-tab:hover { color: var(--cc-text-primary); }\n.cc-sl-tab-active {\n  color: var(--cc-ember);\n  border-bottom-color: var(--cc-ember);\n  font-weight: 500;\n}\n.cc-sl-list-wrap {\n  overflow-y: auto;\n  max-height: 170px;\n}\n\n/* Import items */\n.cc-sl-lastq {\n  font-size: 10px;\n  color: var(--cc-ember);\n  margin-top: 1px;\n  white-space: nowrap;\n  overflow: hidden;\n  text-overflow: ellipsis;\n  opacity: 0.8;\n}\n.cc-sl-meta {\n  font-size: 10px;\n  color: var(--cc-text-ghost);\n  margin-top: 1px;\n}\n.cc-sl-summary {\n  font-size: 10px;\n  color: var(--cc-text-muted);\n  margin-top: 2px;\n  display: -webkit-box;\n  -webkit-line-clamp: 2;\n  -webkit-box-orient: vertical;\n  overflow: hidden;\n  line-height: 1.3;\n}\n.cc-sl-import-btn {\n  flex-shrink: 0;\n  background: var(--cc-ember);\n  color: #fff;\n  border: none;\n  border-radius: 4px;\n  padding: 3px 10px;\n  font-size: 11px;\n  cursor: pointer;\n  font-family: var(--cc-font);\n  transition: opacity 0.12s;\n}\n.cc-sl-import-btn:hover { opacity: 0.85; }\n\n/* Import notice */\n.cc-import-notice {\n  text-align: center;\n  padding: 16px;\n  color: var(--cc-text-secondary);\n  font-size: 12px;\n  line-height: 1.6;\n  background: var(--cc-ember-dim);\n  border-radius: var(--cc-r-sm);\n  margin: 8px;\n}\n.cc-import-notice strong {\n  color: var(--cc-ember);\n  font-size: 13px;\n}\n.cc-text-muted { color: var(--cc-text-ghost); }\n\n/* ────────────────── MESSAGES ────────────────── */\n.cc-messages-wrap {\n  flex: 1;\n  position: relative;\n  overflow: hidden;\n  min-height: 0;\n}\n.cc-messages {\n  position: absolute;\n  inset: 0;\n  overflow-y: auto;\n  padding: 14px;\n  display: flex;\n  flex-direction: column;\n  gap: 10px;\n  user-select: text;\n}\n.cc-messages::-webkit-scrollbar { width: 4px; }\n.cc-messages::-webkit-scrollbar-track { background: transparent; }\n.cc-messages::-webkit-scrollbar-thumb {\n  background: var(--cc-surface-4);\n  border-radius: 2px;\n}\n\n/* Welcome */\n.cc-welcome {\n  display: flex;\n  flex-direction: column;\n  align-items: center;\n  justify-content: center;\n  height: 100%;\n  gap: 10px;\n  color: var(--cc-text-muted);\n  text-align: center;\n  padding: 24px;\n}\n.cc-welcome-title {\n  font-size: 15px;\n  font-weight: 600;\n  color: var(--cc-text-primary);\n  letter-spacing: -0.02em;\n}\n.cc-welcome-hint {\n  font-size: 12px;\n  line-height: 1.7;\n  color: var(--cc-text-muted);\n  max-width: 260px;\n}\n.cc-welcome-shortcuts {\n  display: flex;\n  gap: 14px;\n  margin-top: 4px;\n  font-size: 11px;\n  color: var(--cc-text-ghost);\n}\n.cc-welcome-shortcuts kbd {\n  background: var(--cc-surface-3);\n  border: 1px solid var(--cc-surface-4);\n  border-radius: 4px;\n  padding: 1px 5px;\n  font-family: var(--cc-mono);\n  font-size: 10px;\n  color: var(--cc-text-muted);\n}\n\n/* ────────────────── BUBBLES ────────────────── */\n.cc-msg {\n  max-width: 88%;\n  animation: cc-msg-in 0.2s cubic-bezier(0.16, 1, 0.3, 1);\n}\n@keyframes cc-msg-in {\n  from { opacity: 0; transform: translateY(4px); }\n  to   { opacity: 1; transform: none; }\n}\n\n/* No separate label — bubbles are self-evident by alignment */\n\n.cc-msg-user { align-self: flex-end; }\n.cc-msg-user .cc-msg-body {\n  background: var(--cc-ember);\n  color: #fff;\n  border-radius: var(--cc-r-sm) var(--cc-r-sm) 3px var(--cc-r-sm);\n  padding: 9px 13px;\n  line-height: 1.5;\n  font-size: 13px;\n  white-space: pre-wrap;\n  word-break: break-word;\n}\n\n.cc-msg-assistant { align-self: flex-start; }\n.cc-msg-assistant .cc-msg-body {\n  background: var(--cc-surface-2);\n  color: var(--cc-text-primary);\n  border-radius: var(--cc-r-sm) var(--cc-r-sm) var(--cc-r-sm) 3px;\n  padding: 10px 13px;\n  line-height: 1.6;\n  font-size: 13px;\n  word-break: break-word;\n  border: 1px solid var(--cc-surface-3);\n}\n\n/* ────────────────── ACTIVITY STEPS ────────────────── */\n.cc-activity { margin-bottom: 6px; }\n.cc-step {\n  display: flex;\n  align-items: center;\n  gap: 6px;\n  padding: 3px 0;\n  font-size: 11px;\n  color: var(--cc-text-muted);\n  line-height: 1.3;\n}\n.cc-step-icon {\n  flex-shrink: 0;\n  width: 15px;\n  height: 15px;\n  display: flex;\n  align-items: center;\n  justify-content: center;\n  font-size: 10px;\n}\n.cc-step-icon.cc-spinning {\n  animation: cc-spin 1s linear infinite;\n}\n@keyframes cc-spin { to { transform: rotate(360deg); } }\n.cc-step-text { flex: 1; min-width: 0; }\n.cc-step-detail {\n  font-size: 10px;\n  color: var(--cc-text-ghost);\n  margin-top: 1px;\n  white-space: nowrap;\n  overflow: hidden;\n  text-overflow: ellipsis;\n  line-height: 1.3;\n}\n\n/* Streaming cursor */\n.cc-cursor {\n  display: inline-block;\n  width: 1.5px;\n  height: 14px;\n  background: var(--cc-ember);\n  margin-left: 1px;\n  vertical-align: text-bottom;\n  animation: cc-blink 0.8s step-end infinite;\n}\n@keyframes cc-blink { 50% { opacity: 0; } }\n\n/* ────────────────── THOUGHT (intermediate text) ────────────────── */\n.cc-thought {\n  font-size: 11px;\n  color: var(--cc-text-muted);\n  padding: 2px 0 2px 22px;\n  line-height: 1.4;\n  word-break: break-word;\n}\n\n/* ────────────────── COLLAPSED ACTIVITY SUMMARY ────────────────── */\n.cc-activity-summary {\n  font-size: 11px;\n  color: var(--cc-text-muted);\n  padding: 4px 8px;\n  cursor: pointer;\n  border-radius: 4px;\n  display: flex;\n  align-items: center;\n  gap: 5px;\n  transition: background 0.12s;\n}\n.cc-activity-summary:hover {\n  background: var(--cc-surface-2);\n  color: var(--cc-text-secondary);\n}\n.cc-summary-toggle {\n  font-size: 9px;\n  color: var(--cc-text-ghost);\n  width: 12px;\n  text-align: center;\n}\n.cc-activity-details {\n  padding: 4px 0 4px 6px;\n  border-left: 2px solid var(--cc-surface-3);\n  margin-left: 5px;\n  margin-top: 4px;\n}\n\n/* ────────────────── INPUT ────────────────── */\n.cc-input-area {\n  flex-shrink: 0;\n  border-top: 1px solid var(--cc-surface-3);\n  padding: 10px 14px;\n  background: var(--cc-surface-1);\n}\n\n/* Selection quote bar above input */\n.cc-selection-bar {\n  display: none;\n  align-items: center;\n  gap: 6px;\n  padding: 5px 10px;\n  margin-bottom: 8px;\n  background: var(--cc-ember-dim);\n  border-left: 3px solid var(--cc-ember);\n  border-radius: 0 6px 6px 0;\n  font-size: 11px;\n  color: var(--cc-text-secondary);\n  line-height: 1.4;\n}\n.cc-sel-quote {\n  color: var(--cc-ember);\n  flex-shrink: 0;\n  display: flex;\n  align-items: center;\n}\n.cc-sel-quote svg { width: 13px; height: 13px; }\n.cc-sel-text {\n  flex: 1;\n  min-width: 0;\n  white-space: nowrap;\n  overflow: hidden;\n  text-overflow: ellipsis;\n}\n.cc-sel-clear {\n  flex-shrink: 0;\n  background: none;\n  border: none;\n  color: var(--cc-text-muted);\n  font-size: 14px;\n  cursor: pointer;\n  padding: 0 2px;\n  line-height: 1;\n}\n.cc-sel-clear:hover { color: var(--cc-text-primary); }\n.cc-input-wrapper {\n  display: flex;\n  align-items: center;\n  gap: 8px;\n  background: var(--cc-surface-0);\n  border: 1px solid var(--cc-surface-3);\n  border-radius: var(--cc-r-sm);\n  padding: 6px 10px;\n  min-height: 36px;\n  transition: border-color 0.15s, box-shadow 0.15s;\n}\n.cc-input-wrapper:focus-within {\n  border-color: var(--cc-ember);\n  box-shadow: 0 0 0 2px var(--cc-ember-dim);\n}\n.cc-input {\n  flex: 1;\n  border: none;\n  background: transparent;\n  resize: none;\n  font-family: var(--cc-font);\n  font-size: 13px;\n  outline: none;\n  color: var(--cc-text-primary);\n  line-height: 20px;\n  max-height: 120px;\n  min-height: 20px;\n  height: 20px;\n  padding: 0;\n  margin: 0;\n  vertical-align: middle;\n}\n.cc-input::placeholder { color: var(--cc-text-ghost); }\n\n.cc-send-btn {\n  flex-shrink: 0;\n  width: 30px;\n  height: 30px;\n  border-radius: var(--cc-r-sm);\n  border: none;\n  background: var(--cc-ember);\n  color: #fff;\n  cursor: pointer;\n  display: flex;\n  align-items: center;\n  justify-content: center;\n  padding: 0;\n  transition: background 0.12s, opacity 0.1s;\n}\n.cc-send-btn svg {\n  width: 14px; height: 14px;\n  fill: none; stroke: currentColor; stroke-width: 2;\n}\n.cc-send-btn:hover:not(:disabled) { background: var(--cc-ember-hover); }\n.cc-send-btn:active:not(:disabled) { opacity: 0.8; }\n.cc-send-btn:disabled { opacity: 0.3; cursor: not-allowed; }\n\n.cc-input-footer {\n  display: flex;\n  justify-content: space-between;\n  align-items: center;\n  margin-top: 6px;\n  padding: 0 2px;\n}\n.cc-checkbox {\n  font-size: 11px;\n  color: var(--cc-text-muted);\n  display: flex;\n  align-items: center;\n  gap: 4px;\n  cursor: pointer;\n  user-select: none;\n}\n.cc-checkbox input[type=\"checkbox\"] {\n  width: 13px; height: 13px;\n  accent-color: var(--cc-ember);\n  margin: 0;\n}\n.cc-input-hint {\n  font-size: 10px;\n  color: var(--cc-text-ghost);\n  display: flex;\n  align-items: center;\n  gap: 3px;\n}\n.cc-input-hint kbd {\n  background: var(--cc-surface-3);\n  border: 1px solid var(--cc-surface-4);\n  border-radius: 3px;\n  padding: 0 4px;\n  font-family: var(--cc-mono);\n  font-size: 9px;\n  color: var(--cc-text-muted);\n}\n\n/* ────────────────── STOP BUTTON ────────────────── */\n.cc-stop-btn {\n  display: none;\n  align-items: center;\n  justify-content: center;\n  gap: 4px;\n  background: transparent;\n  border: 1px solid var(--cc-surface-4);\n  border-radius: 6px;\n  padding: 3px 10px;\n  font-family: var(--cc-font);\n  font-size: 11px;\n  color: var(--cc-text-muted);\n  cursor: pointer;\n  transition: background 0.12s, color 0.12s, border-color 0.12s;\n  margin: 0 auto 6px;\n}\n.cc-stop-btn:hover {\n  background: var(--cc-error-bg);\n  color: var(--cc-error);\n  border-color: var(--cc-error);\n}\n.cc-stop-btn.cc-active { display: inline-flex; }\n\n/* ────────────────── MESSAGE ACTIONS ────────────────── */\n.cc-msg-actions {\n  display: flex;\n  gap: 6px;\n  padding: 4px 0 0;\n}\n.cc-action-btn {\n  display: inline-flex;\n  align-items: center;\n  gap: 3px;\n  background: none;\n  border: 1px solid var(--cc-surface-3);\n  border-radius: 4px;\n  padding: 2px 8px;\n  font-family: var(--cc-font);\n  font-size: 10px;\n  color: var(--cc-text-muted);\n  cursor: pointer;\n  transition: background 0.12s, color 0.12s, border-color 0.12s;\n}\n.cc-action-btn:hover {\n  background: var(--cc-surface-2);\n  color: var(--cc-text-secondary);\n  border-color: var(--cc-surface-4);\n}\n.cc-action-btn svg { width: 11px; height: 11px; }\n\n/* ────────────────── QUICK ACTIONS ────────────────── */\n.cc-quick-actions {\n  display: flex;\n  gap: 6px;\n  padding-bottom: 8px;\n  flex-wrap: wrap;\n}\n.cc-quick-btn {\n  background: var(--cc-surface-2);\n  border: 1px solid var(--cc-surface-3);\n  border-radius: 12px;\n  padding: 3px 10px;\n  font-family: var(--cc-font);\n  font-size: 11px;\n  color: var(--cc-text-muted);\n  cursor: pointer;\n  transition: background 0.12s, color 0.12s, border-color 0.12s;\n  white-space: nowrap;\n}\n.cc-quick-btn:hover {\n  background: var(--cc-ember-dim);\n  color: var(--cc-ember);\n  border-color: var(--cc-ember);\n}\n\n/* ────────────────── LINKED DOCS ────────────────── */\n.cc-linked-docs { padding-bottom: 6px; }\n.cc-link-header {\n  display: flex; align-items: center; gap: 4px;\n  font-size: 10px; color: var(--cc-text-ghost); margin-bottom: 3px;\n}\n.cc-link-header svg { width: 10px; height: 10px; }\n.cc-link-item {\n  display: flex; align-items: center; gap: 4px;\n  padding: 3px 8px; background: var(--cc-ember-dim);\n  border-radius: 4px; margin-bottom: 2px; font-size: 11px;\n  border-left: 2px solid var(--cc-ember);\n}\n.cc-link-title {\n  flex: 1; min-width: 0;\n  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;\n  color: var(--cc-text-secondary);\n}\n.cc-link-rm {\n  flex-shrink: 0; background: none; border: none;\n  color: var(--cc-text-ghost); font-size: 14px;\n  cursor: pointer; padding: 0 2px; line-height: 1;\n}\n.cc-link-rm:hover { color: var(--cc-error); }\n\n/* Toggle button */\n.cc-link-toggle {\n  display: inline-flex;\n  align-items: center;\n  gap: 4px;\n  background: none;\n  border: 1px dashed var(--cc-surface-4);\n  border-radius: 6px;\n  padding: 3px 10px;\n  font-family: var(--cc-font);\n  font-size: 11px;\n  color: var(--cc-text-muted);\n  cursor: pointer;\n  transition: background 0.12s, color 0.12s, border-color 0.12s;\n}\n.cc-link-toggle:hover {\n  background: var(--cc-ember-dim);\n  color: var(--cc-ember);\n  border-color: var(--cc-ember);\n}\n.cc-link-toggle svg { width: 11px; height: 11px; }\n.cc-link-toggle-arrow {\n  font-size: 8px;\n  margin-left: 2px;\n}\n\n/* Search input */\n.cc-link-search-wrap { position: relative; }\n.cc-link-search {\n  width: 100%; box-sizing: border-box;\n  border: 1px solid var(--cc-surface-3);\n  border-radius: 6px;\n  padding: 4px 8px;\n  font-family: var(--cc-font);\n  font-size: 11px;\n  color: var(--cc-text-primary);\n  background: var(--cc-surface-0);\n  outline: none;\n  transition: border-color 0.12s;\n}\n.cc-link-search:focus { border-color: var(--cc-ember); }\n.cc-link-search::placeholder { color: var(--cc-text-ghost); }\n.cc-link-results {\n  max-height: 130px;\n  overflow-y: auto;\n  border: 1px solid var(--cc-surface-3);\n  border-top: none;\n  border-radius: 0 0 6px 6px;\n  background: var(--cc-surface-1);\n  display: none;\n}\n.cc-link-search:focus ~ .cc-link-results,\n.cc-link-results:hover { display: block; }\n.cc-link-results:empty { display: none; }\n.cc-link-loading {\n  padding: 8px; text-align: center;\n  font-size: 11px; color: var(--cc-text-ghost);\n}\n.cc-link-result {\n  display: flex; align-items: center; justify-content: space-between;\n  padding: 5px 8px; cursor: pointer;\n  transition: background 0.1s;\n}\n.cc-link-result:hover { background: var(--cc-surface-2); }\n.cc-link-result-name {\n  font-size: 11px; color: var(--cc-text-primary);\n  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;\n  flex: 1; min-width: 0;\n}\n.cc-link-result-meta {\n  font-size: 10px; color: var(--cc-text-ghost);\n  flex-shrink: 0; margin-left: 8px;\n}\n\n/* ────────────────── MARKDOWN ────────────────── */\n.cc-md { font-size: 13px; line-height: 1.65; }\n.cc-md p { margin: 0 0 8px; }\n.cc-md p:last-child { margin-bottom: 0; }\n.cc-md h1,.cc-md h2,.cc-md h3,.cc-md h4,.cc-md h5,.cc-md h6 {\n  font-weight: 600; margin: 12px 0 4px; line-height: 1.3;\n  color: var(--cc-text-primary);\n}\n.cc-md h1 { font-size: 16px; }\n.cc-md h2 { font-size: 15px; }\n.cc-md h3 { font-size: 14px; }\n.cc-md h4,.cc-md h5,.cc-md h6 { font-size: 13px; }\n.cc-md h1:first-child,.cc-md h2:first-child,.cc-md h3:first-child { margin-top: 0; }\n.cc-md strong { font-weight: 600; color: var(--cc-text-primary); }\n.cc-md em { font-style: italic; }\n.cc-md code {\n  font-family: var(--cc-mono);\n  font-size: 11.5px;\n  background: var(--cc-surface-3);\n  padding: 1.5px 5px;\n  border-radius: 4px;\n  color: var(--cc-text-primary);\n}\n.cc-md pre {\n  background: #1e1e2e;\n  border: 1px solid var(--cc-surface-3);\n  color: #cdd6f4;\n  padding: 10px 12px;\n  border-radius: var(--cc-r-sm);\n  overflow-x: auto;\n  margin: 8px 0;\n  font-size: 12px;\n  line-height: 1.5;\n}\n.cc-md pre code {\n  background: none;\n  padding: 0;\n  font-size: inherit;\n  color: inherit;\n  border-radius: 0;\n}\n.cc-md ul,.cc-md ol { padding-left: 18px; margin: 4px 0; }\n.cc-md li { margin: 2px 0; line-height: 1.5; }\n.cc-md blockquote {\n  border-left: 2px solid var(--cc-ember);\n  padding: 3px 10px;\n  margin: 6px 0;\n  color: var(--cc-text-secondary);\n  background: var(--cc-ember-dim);\n  border-radius: 0 4px 4px 0;\n}\n.cc-md a { color: var(--cc-ember); text-decoration: none; }\n.cc-md a:hover { text-decoration: underline; }\n.cc-md hr { border: none; border-top: 1px solid var(--cc-surface-3); margin: 10px 0; }\n.cc-md table { width: 100%; border-collapse: collapse; margin: 6px 0; font-size: 12px; }\n.cc-md th,.cc-md td {\n  border: 1px solid var(--cc-surface-3);\n  padding: 5px 8px;\n  text-align: left;\n}\n.cc-md th { background: var(--cc-surface-2); font-weight: 600; }\n\n/* ────────────────── ERROR ────────────────── */\n.cc-error {\n  color: var(--cc-error);\n  padding: 8px 10px;\n  background: var(--cc-error-bg);\n  border-radius: var(--cc-r-sm);\n  line-height: 1.5;\n  font-size: 12px;\n  border: 1px solid rgba(224, 92, 92, 0.15);\n}\n.cc-retry-btn {\n  display: inline-block;\n  margin-top: 8px;\n  padding: 4px 14px;\n  border: 1px solid var(--cc-error);\n  border-radius: 6px;\n  background: transparent;\n  color: var(--cc-error);\n  font-family: var(--cc-font);\n  font-size: 12px;\n  cursor: pointer;\n  transition: background 0.12s, color 0.12s;\n}\n.cc-retry-btn:hover {\n  background: var(--cc-error);\n  color: #fff;\n}\n.cc-error code {\n  background: rgba(224,92,92,0.1);\n  padding: 1px 4px;\n  border-radius: 3px;\n  font-family: var(--cc-mono);\n  font-size: 11px;\n}\n\n/* ────────────────── STOPPED ────────────────── */\n.cc-stopped {\n  font-size: 11px;\n  color: var(--cc-text-muted);\n  padding: 4px 0;\n  margin-top: 4px;\n}\n\n/* ────────────────── RESIZE HANDLE ────────────────── */\n.cc-resize-handle {\n  position: absolute;\n  right: 0;\n  bottom: 0;\n  width: 16px;\n  height: 16px;\n  cursor: nwse-resize;\n  z-index: 1;\n}\n.cc-resize-handle::after {\n  content: '';\n  position: absolute;\n  right: 4px;\n  bottom: 4px;\n  width: 6px;\n  height: 6px;\n  border-right: 2px solid var(--cc-surface-4);\n  border-bottom: 2px solid var(--cc-surface-4);\n  opacity: 0.4;\n  transition: opacity 0.15s;\n}\n.cc-panel:hover .cc-resize-handle::after {\n  opacity: 0.7;\n}\n\n/* ────────────────── DARK MODE ────────────────── */\n@media (prefers-color-scheme: dark) {\n  :root {\n    --cc-surface-0: #1a1a1c;\n    --cc-surface-1: #222224;\n    --cc-surface-2: #2a2a2d;\n    --cc-surface-3: #333337;\n    --cc-surface-4: #3e3e43;\n    --cc-text-primary: #ececef;\n    --cc-text-secondary: #a0a0a8;\n    --cc-text-muted: #6c6c75;\n    --cc-text-ghost: #4a4a52;\n    --cc-ember-glow: rgba(217, 119, 87, 0.18);\n    --cc-ember-dim: rgba(217, 119, 87, 0.1);\n  }\n  .cc-status-dot { border-color: var(--cc-surface-0); }\n  .cc-update-dot { border-color: var(--cc-surface-0); }\n  .cc-msg-user .cc-msg-body { background: var(--cc-ember); color: #fff; }\n  .cc-md pre { background: #0d0d14; border-color: var(--cc-surface-3); color: #cdd6f4; }\n}\n";document.head.appendChild(s)})();

// ProseMirror bridge (selection reading + cursor + direct doc write)
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


// Main
// content.js — WPS 365 Claude Code 浮动面板（会话管理 + 流式）
(function () {
  

  const isMac = /Mac|iPhone|iPad|iPod/.test(navigator.platform);
  const MOD_KEY = isMac ? "⌥" : "Alt";
  const LOG = (...args) => console.log("[CC]", ...args);
  const BRIDGE = "http://localhost:5174";


  function getDocUrl() { return window.__CC_DOC_URL__ || location.href; }
  function getDocTitle() { return window.__CC_DOC_TITLE__ || document.title; }
  const MAX_SESSIONS = 20;

  let cachedSelection = "";
  let dismissedSelection = "";
  let isStreaming = false;
  let bridgeOnline = false;
  let abortController = null;
  let cachedCursorFrom = 0;
  let cachedCursorTo = 0;
  let cachedCursorCtx = null;

  // ========== DOCUMENT ID (for per-document conversation isolation) ==========
  const docId = (() => {
    const url = window.__CC_DOC_URL__ || location.href;
    const m = url.match(/\/l\/([A-Za-z0-9]+)/);
    if (m) return m[1];
    const m2 = url.match(/\/(\d+)\//);
    if (m2) return m2[1];
    return url.replace(/[^a-zA-Z0-9]/g, "_").slice(0, 40);
  })();
  const STORAGE_KEY = "cc_convs_" + docId;
  LOG("doc isolation key:", docId);

  // ========== CONVERSATION STATE ==========
  // Each conversation: { id, claudeSessionId, title, container (DOM element), createdAt }
  let convs = [];
  let activeConvId = null;

  function getConv(id) { return convs.find(c => c.id === id); }
  function activeConv() { return getConv(activeConvId); }

  // ========== ICONS ==========
  const ICON = {
    sparkle: `<svg viewBox="0 0 24 24" width="18" height="18"><path d="M12 2L14.5 9.5L22 12L14.5 14.5L12 22L9.5 14.5L2 12L9.5 9.5L12 2Z" stroke="currentColor" fill="none" stroke-width="1.5"/></svg>`,
    send: `<svg viewBox="0 0 24 24" width="16" height="16"><path d="M22 2L11 13" stroke="currentColor" fill="none" stroke-width="2" stroke-linecap="round"/><path d="M22 2L15 22L11 13L2 9L22 2Z" stroke="currentColor" fill="none" stroke-width="2" stroke-linejoin="round"/></svg>`,
    close: `<svg viewBox="0 0 24 24" width="16" height="16"><path d="M18 6L6 18M6 6l12 12" stroke="currentColor" fill="none" stroke-width="2" stroke-linecap="round"/></svg>`,
    clear: `<svg viewBox="0 0 24 24" width="16" height="16"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" stroke="currentColor" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    stop: `<svg viewBox="0 0 24 24" width="12" height="12"><rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor"/></svg>`,
    claude: `<svg viewBox="0 0 24 24" width="12" height="12"><path d="M12 2L14.5 9.5L22 12L14.5 14.5L12 22L9.5 14.5L2 12L9.5 9.5L12 2Z" stroke="currentColor" fill="none" stroke-width="2"/></svg>`,
    plus: `<svg viewBox="0 0 24 24" width="14" height="14"><path d="M12 5v14M5 12h14" stroke="currentColor" fill="none" stroke-width="2" stroke-linecap="round"/></svg>`,
    list: `<svg viewBox="0 0 24 24" width="14" height="14"><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" stroke="currentColor" fill="none" stroke-width="2" stroke-linecap="round"/></svg>`,
    link: `<svg viewBox="0 0 24 24" width="12" height="12"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" stroke="currentColor" fill="none" stroke-width="2" stroke-linecap="round"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" stroke="currentColor" fill="none" stroke-width="2" stroke-linecap="round"/></svg>`,
    copy: `<svg viewBox="0 0 24 24" width="12" height="12"><rect x="9" y="9" width="13" height="13" rx="2" stroke="currentColor" fill="none" stroke-width="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" stroke="currentColor" fill="none" stroke-width="2"/></svg>`,
    docWrite: `<svg viewBox="0 0 24 24" width="12" height="12"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" stroke="currentColor" fill="none" stroke-width="2"/><path d="M12 18v-6M9 15l3 3 3-3" stroke="currentColor" fill="none" stroke-width="2"/></svg>`,
    quote: `<svg viewBox="0 0 16 16" width="13" height="13"><path d="M4 2v3a6 6 0 006 6h2" stroke="currentColor" fill="none" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M10 9l2 2-2 2" stroke="currentColor" fill="none" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  };

  // ========== FAB ==========
  const fab = document.createElement("div");
  fab.className = "cc-fab";
  fab.title = `Claude Code (${MOD_KEY}+J)`;
  fab.innerHTML = ICON.sparkle + `<span class="cc-status-dot"></span><span class="cc-update-dot"></span>`;
  document.body.appendChild(fab);
  const statusDot = fab.querySelector(".cc-status-dot");
  const updateDot = fab.querySelector(".cc-update-dot");

  // ========== PANEL ==========
  const panel = document.createElement("div");
  panel.className = "cc-panel";
  panel.innerHTML = `
    <div class="cc-header">
      <span class="cc-title">${ICON.claude} Claude Code</span>
      <div class="cc-header-actions">
        <button class="cc-header-btn cc-sessions-btn" title="会话列表">${ICON.list}</button>
        <button class="cc-header-btn cc-new-btn" title="新建会话">${ICON.plus}</button>
        <button class="cc-header-btn cc-close-btn" title="关闭 (Esc)">${ICON.close}</button>
      </div>
    </div>
    <div class="cc-update-banner"></div>
    <div class="cc-session-list"></div>
    <div class="cc-messages-wrap"></div>
    <button class="cc-stop-btn">${ICON.stop} 停止生成</button>
    <div class="cc-input-area">
      <div class="cc-quick-actions"></div>
      <div class="cc-linked-docs"></div>
      <div class="cc-selection-bar"></div>
      <div class="cc-input-wrapper">
        <textarea class="cc-input" rows="1" placeholder="输入你的请求…"></textarea>
        <button class="cc-send-btn" title="发送 (Enter)">${ICON.send}</button>
      </div>
      <div class="cc-input-footer">
        <span class="cc-input-hint"><kbd>↵</kbd> 发送 · <kbd>Shift</kbd>+<kbd>↵</kbd> 换行</span>
      </div>
    </div>
  `;
  document.body.appendChild(panel);

  const inputEl = panel.querySelector(".cc-input");
  const sendBtn = panel.querySelector(".cc-send-btn");
  const stopBtn = panel.querySelector(".cc-stop-btn");
  const msgsWrap = panel.querySelector(".cc-messages-wrap");
  const selectionBar = panel.querySelector(".cc-selection-bar");
  const linkedDocsEl = panel.querySelector(".cc-linked-docs");
  let linkedDocs = []; // [{ url, title }]
  const sessionListEl = panel.querySelector(".cc-session-list");

  // ========== CONVERSATION MANAGEMENT (DOM-based, no innerHTML swap) ==========
  function createConvContainer() {
    const el = document.createElement("div");
    el.className = "cc-messages";
    el.innerHTML = getWelcomeHTML();
    return el;
  }

  function makeConv(title) {
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const container = createConvContainer();
    return { id, claudeSessionId: null, claudeCwd: null, isImported: false, originSessionId: null, title: title || "新会话", container, createdAt: Date.now() };
  }

  function showConv(id) {
    // Hide all, show target
    convs.forEach(c => { c.container.style.display = "none"; });
    const conv = getConv(id);
    if (!conv) return;
    if (!conv.container.parentElement) msgsWrap.appendChild(conv.container);
    conv.container.style.display = "flex";
    activeConvId = id;
    hideSessionList();
  }

  function newConversation() {
    const conv = makeConv();
    convs.unshift(conv);
    if (convs.length > MAX_SESSIONS) {
      const old = convs.pop();
      old.container.remove();
    }
    msgsWrap.appendChild(conv.container);
    showConv(conv.id);
    persistIndex();
    return conv;
  }

  function switchToConv(id) {
    if (id === activeConvId) { hideSessionList(); return; }
    showConv(id);
    persistIndex();
  }

  function deleteConv(id) {
    const conv = getConv(id);
    if (conv) conv.container.remove();
    convs = convs.filter(c => c.id !== id);
    if (activeConvId === id) {
      if (convs.length > 0) showConv(convs[0].id);
      else newConversation();
    }
    persistIndex();
    renderSessionList();
  }

  // ========== PERSISTENCE (index only — DOM containers are ephemeral) ==========
  function persistIndex() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(convs.map(c => ({
        id: c.id, claudeSessionId: c.claudeSessionId, claudeCwd: c.claudeCwd, isImported: c.isImported, originSessionId: c.originSessionId, title: c.title, createdAt: c.createdAt,
        html: c.container.innerHTML,
      }))));
    } catch (_) {}
  }

  function rebindContainerEvents(container) {
    container.querySelectorAll(".cc-activity-summary").forEach(summary => {
      const wrap = summary.nextElementSibling;
      if (!wrap || !wrap.classList.contains("cc-activity-details")) return;
      summary.addEventListener("click", () => {
        const open = wrap.style.display !== "none";
        wrap.style.display = open ? "none" : "block";
        summary.querySelector(".cc-summary-toggle").textContent = open ? "▶" : "▼";
      });
    });
    container.querySelectorAll(".cc-msg-assistant").forEach(msg => {
      const replyEl = msg.querySelector(".cc-reply");
      const actionsEl = msg.querySelector(".cc-msg-actions");
      if (replyEl && actionsEl && actionsEl.querySelector(".cc-copy-btn")) {
        addMsgActions(actionsEl, replyEl);
      }
    });
  }

  async function restoreIndex() {
    try {
      let saved = []; try { saved = JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; } catch(_) {}
      saved.forEach(s => {
        const container = createConvContainer();
        if (s.html) container.innerHTML = s.html;
        rebindContainerEvents(container);
        container.style.display = "none";
        msgsWrap.appendChild(container);
        convs.push({ id: s.id, claudeSessionId: s.claudeSessionId, claudeCwd: s.claudeCwd || null, isImported: !!s.isImported, originSessionId: s.originSessionId || null, title: s.title, container, createdAt: s.createdAt });
      });
    } catch (_) {}
    if (convs.length > 0) showConv(convs[0].id);
    else newConversation();
  }

  // ========== SESSION LIST UI ==========
  let showingImport = false;

  function renderSessionList() {
    sessionListEl.innerHTML = "";

    // Tab bar: 插件会话 / 导入本地
    const tabs = document.createElement("div");
    tabs.className = "cc-sl-tabs";
    tabs.innerHTML = `<span class="cc-sl-tab ${showingImport ? "" : "cc-sl-tab-active"}" data-tab="local">插件会话</span><span class="cc-sl-tab ${showingImport ? "cc-sl-tab-active" : ""}" data-tab="import">导入本地 Claude</span>`;
    tabs.querySelector('[data-tab="local"]').addEventListener("click", () => { showingImport = false; renderSessionList(); });
    tabs.querySelector('[data-tab="import"]').addEventListener("click", () => { showingImport = true; renderSessionList(); loadLocalSessions(); });
    sessionListEl.appendChild(tabs);

    const listWrap = document.createElement("div");
    listWrap.className = "cc-sl-list-wrap";
    sessionListEl.appendChild(listWrap);

    if (showingImport) {
      listWrap.innerHTML = `<div class="cc-sl-empty">加载中…</div>`;
      return;
    }

    // Plugin conversations
    if (convs.length === 0) { listWrap.innerHTML = `<div class="cc-sl-empty">暂无会话</div>`; return; }
    convs.forEach(c => {
      const item = document.createElement("div");
      item.className = "cc-sl-item" + (c.id === activeConvId ? " cc-sl-active" : "");
      const t = new Date(c.createdAt);
      item.innerHTML = `<div class="cc-sl-info"><div class="cc-sl-title">${esc(c.title)}</div><div class="cc-sl-time">${t.getMonth()+1}/${t.getDate()} ${t.getHours()}:${String(t.getMinutes()).padStart(2,"0")}</div></div><button class="cc-sl-del" title="删除">×</button>`;
      item.querySelector(".cc-sl-info").addEventListener("click", () => switchToConv(c.id));
      item.querySelector(".cc-sl-del").addEventListener("click", (e) => { e.stopPropagation(); deleteConv(c.id); });
      listWrap.appendChild(item);
    });
  }

  async function loadLocalSessions() {
    const listWrap = sessionListEl.querySelector(".cc-sl-list-wrap");
    if (!listWrap) return;
    try {
      const excludeIds = [...new Set(convs.flatMap(c => [c.claudeSessionId, c.originSessionId]).filter(Boolean))];
      const r = await fetch(BRIDGE + "/local-sessions?exclude=" + encodeURIComponent(excludeIds.join(",")));
      const d = await r.json();
      if (!d.ok || !d.sessions?.length) { listWrap.innerHTML = `<div class="cc-sl-empty">未找到本地 Claude 会话</div>`; return; }
      listWrap.innerHTML = "";
      d.sessions.forEach(s => {
        const item = document.createElement("div");
        item.className = "cc-sl-item cc-sl-import";
        const t = new Date(s.updatedAt);
        item.innerHTML = `
          <div class="cc-sl-info">
            <div class="cc-sl-title">${esc(s.title)}</div>
            <div class="cc-sl-meta">${s.turns}轮 · ${esc(s.project)}</div>
            ${s.summary ? `<div class="cc-sl-summary">${esc(s.summary)}</div>` : ""}
          </div>
          <button class="cc-sl-import-btn">导入</button>
        `;
        item.querySelector(".cc-sl-import-btn").addEventListener("click", (e) => {
          e.stopPropagation();
          importLocalSession(s);
        });
        listWrap.appendChild(item);
      });
    } catch (err) {
      listWrap.innerHTML = `<div class="cc-sl-empty">无法连接 Bridge</div>`;
    }
  }

  function importLocalSession(s) {
    // Create a new conversation linked to the local Claude session
    const conv = makeConv(s.title);
    conv.claudeSessionId = s.sessionId;
    conv.claudeCwd = s.cwd || null;
    conv.isImported = true;
    conv.originSessionId = s.sessionId;
    convs.unshift(conv);
    if (convs.length > MAX_SESSIONS) { const old = convs.pop(); old.container.remove(); }
    msgsWrap.appendChild(conv.container);

    // Show a welcome-like message indicating this is imported
    const w = conv.container.querySelector(".cc-welcome");
    if (w) w.remove();
    const notice = document.createElement("div");
    notice.className = "cc-import-notice";
    notice.innerHTML = `<strong>已导入本地会话</strong><br/>${esc(s.title)}<br/><span class="cc-text-muted">${s.turns}轮对话 · ${esc(s.project)}</span>`;
    conv.container.appendChild(notice);

    showConv(conv.id);
    persistIndex();
    showingImport = false;
    LOG("imported local session:", s.sessionId);
  }

  function toggleSessionList() { const v = sessionListEl.classList.contains("cc-sl-visible"); if (v) hideSessionList(); else { showingImport = false; renderSessionList(); sessionListEl.classList.add("cc-sl-visible"); } }
  function hideSessionList() { sessionListEl.classList.remove("cc-sl-visible"); }

  // ========== PANEL ==========
  function showPanel() { panel.classList.add("cc-visible"); requestSelection(); inputEl.focus(); checkHealth(); try { window.parent.postMessage({type:"__CC_PANEL__",open:true}, "*"); } catch(_) {} }
  function hidePanel() { panel.classList.remove("cc-visible"); hideSessionList(); try { window.parent.postMessage({type:"__CC_PANEL__",open:false}, "*"); } catch(_) {} }
  fab.addEventListener("click", () => panel.classList.contains("cc-visible") ? hidePanel() : showPanel());
  panel.querySelector(".cc-close-btn").addEventListener("click", hidePanel);
  panel.querySelector(".cc-sessions-btn").addEventListener("click", toggleSessionList);
  panel.querySelector(".cc-new-btn").addEventListener("click", () => newConversation());

  // ========== KEYBOARD ==========
  window.addEventListener("keydown", (e) => {
    if (e.altKey && (e.key === "j" || e.key === "J")) { e.preventDefault(); panel.classList.contains("cc-visible") ? hidePanel() : showPanel(); }
    if (e.key === "Escape" && panel.classList.contains("cc-visible")) hidePanel();
  });
  let inputHistory = [];
  let historyIdx = -1;

  inputEl.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey && !e.ctrlKey && !e.metaKey) { e.preventDefault(); send(); return; }
    // ↑ key recall last input (only when input is empty or at start)
    if (e.key === "ArrowUp" && inputEl.selectionStart === 0 && inputHistory.length > 0) {
      e.preventDefault();
      historyIdx = Math.min(historyIdx + 1, inputHistory.length - 1);
      inputEl.value = inputHistory[historyIdx];
      inputEl.style.height = "auto"; inputEl.style.height = Math.min(inputEl.scrollHeight, 120) + "px";
    }
    if (e.key === "ArrowDown" && historyIdx >= 0) {
      historyIdx--;
      inputEl.value = historyIdx >= 0 ? inputHistory[historyIdx] : "";
      inputEl.style.height = "auto"; inputEl.style.height = Math.min(inputEl.scrollHeight, 120) + "px";
    }
  });
  sendBtn.addEventListener("click", send);
  stopBtn.addEventListener("click", () => { if (abortController) { abortController.abort(); abortController = null; } });
  inputEl.addEventListener("input", () => { inputEl.style.height = "auto"; inputEl.style.height = Math.min(inputEl.scrollHeight, 120) + "px"; });

  // Quick action buttons (dynamic based on selection)
  updateQuickActions();
  updatePlaceholder();

  

  function requestSelection() { window.postMessage({ type: "__CC_READ_SEL__" }, "*"); }
  function waitForSelection() {
    return new Promise(resolve => {
      requestSelection();
      const t = setTimeout(() => resolve(cachedSelection), 200);
      function onMsg(e) {
        if (e.data?.type === "__CC_SEL__") {
          clearTimeout(t); window.removeEventListener("message", onMsg);
          cachedSelection = (e.data.text || "").trim();
          cachedCursorFrom = e.data.from || 0;
          cachedCursorTo = e.data.to || 0;
          cachedCursorCtx = e.data.cursorContext || null;
          resolve(cachedSelection);
        }
      }
      window.addEventListener("message", onMsg);
    });
  }
  window.addEventListener("message", (e) => {
    if (e.data?.type === "__CC_SEL__") {
      const text = (e.data.text || "").trim();
      if (text && text === dismissedSelection) return;
      dismissedSelection = "";
      cachedSelection = text;
      cachedCursorFrom = e.data.from || 0;
      cachedCursorTo = e.data.to || 0;
      cachedCursorCtx = e.data.cursorContext || null;
      if (panel.classList.contains("cc-visible")) updateSelectionBar();
    }
  });
  document.addEventListener("mouseup", () => { if (panel.classList.contains("cc-visible")) setTimeout(requestSelection, 50); }, true);
  document.addEventListener("keyup", (e) => { if (panel.classList.contains("cc-visible") && (e.shiftKey || e.key === "Shift")) requestSelection(); }, true);

  function updateSelectionBar() {
    if (cachedSelection) {
      const p = cachedSelection.length > 60 ? cachedSelection.slice(0, 60) + "…" : cachedSelection;
      selectionBar.innerHTML = `<span class="cc-sel-quote">${ICON.quote}</span><span class="cc-sel-text">${esc(p)}</span><button class="cc-sel-clear">×</button>`;
      selectionBar.style.display = "flex";
      selectionBar.querySelector(".cc-sel-clear").addEventListener("click", () => { dismissedSelection = cachedSelection; cachedSelection = ""; updateSelectionBar(); });
    } else { selectionBar.innerHTML = ""; selectionBar.style.display = "none"; }
    updateQuickActions();
    updatePlaceholder();
  }

  function updateQuickActions() {
    const quickEl = panel.querySelector(".cc-quick-actions");
    const actions = cachedSelection
      ? [{ label: "解释选中", prompt: "解释一下选中的这段内容" }, { label: "改写润色", prompt: "帮我改写润色选中的这段文字，使其更通顺、专业" }, { label: "扩写这段", prompt: "基于选中的内容，在文档中扩展补充这一段" }]
      : [{ label: "总结全文", prompt: "总结整篇文档要点" }, { label: "提改进建议", prompt: "对这篇文档提出改进建议" }, { label: "调研补充", prompt: "根据文档主题，搜索相关资料并补充到文档中" }];
    quickEl.innerHTML = actions.map(a => `<button class="cc-quick-btn" data-prompt="${esc(a.prompt)}">${a.label}</button>`).join("");
    quickEl.querySelectorAll(".cc-quick-btn").forEach(btn => {
      btn.addEventListener("click", () => { if (!isStreaming) { inputEl.value = btn.dataset.prompt; send(); } });
    });
  }

  function updatePlaceholder() {
    inputEl.placeholder = cachedSelection ? "对选中的内容做什么…" : "告诉我想对文档做什么…";
  }

  // ========== LINKED DOCS (with search) ==========
  let linkSearchTimer = null;
  let linkExpanded = false;

  function renderLinkedDocs() {
    linkedDocsEl.innerHTML = "";
    const toggleBtn = document.createElement("button");
    toggleBtn.className = "cc-link-toggle";
    toggleBtn.innerHTML = linkedDocs.length > 0
      ? `${ICON.link} 关联文档 (${linkedDocs.length}) <span class="cc-link-toggle-arrow">${linkExpanded ? "▼" : "▶"}</span>`
      : `${ICON.plus} 关联文档`;
    toggleBtn.addEventListener("click", () => { linkExpanded = !linkExpanded; renderLinkedDocs(); });
    linkedDocsEl.appendChild(toggleBtn);
    if (!linkExpanded) return;

    linkedDocs.forEach((doc, i) => {
      const item = document.createElement("div");
      item.className = "cc-link-item";
      item.innerHTML = `<span class="cc-link-title">${esc(doc.title || doc.url)}</span><button class="cc-link-rm">×</button>`;
      item.querySelector(".cc-link-rm").addEventListener("click", () => { linkedDocs.splice(i, 1); renderLinkedDocs(); });
      linkedDocsEl.appendChild(item);
    });

    const searchWrap = document.createElement("div");
    searchWrap.className = "cc-link-search-wrap";
    searchWrap.innerHTML = `<input class="cc-link-search" placeholder="搜索文档名称关联…" /><div class="cc-link-results"></div>`;
    linkedDocsEl.appendChild(searchWrap);
    const searchInput = searchWrap.querySelector(".cc-link-search");
    const resultsEl = searchWrap.querySelector(".cc-link-results");
    searchInput.addEventListener("focus", () => { if (!searchInput.value.trim()) searchDocs("", resultsEl); });
    searchInput.addEventListener("input", () => {
      clearTimeout(linkSearchTimer);
      linkSearchTimer = setTimeout(() => searchDocs(searchInput.value.trim(), resultsEl), 300);
    });
  }

  async function searchDocs(q, resultsEl) {
    resultsEl.innerHTML = `<div class="cc-link-loading">搜索中…</div>`;
    try {
      const r = await fetch(BRIDGE + "/search-docs?q=" + encodeURIComponent(q) + "&curUrl=" + encodeURIComponent(getDocUrl()));
      const d = await r.json();
      if (!d.ok || !d.docs?.length) { resultsEl.innerHTML = `<div class="cc-link-loading">${q ? "未找到" : "暂无最近文档"}</div>`; return; }
      resultsEl.innerHTML = "";
      d.docs.forEach(doc => {
        if (linkedDocs.some(ld => ld.url === doc.url)) return;
        const item = document.createElement("div");
        item.className = "cc-link-result";
        const t = doc.updatedAt ? new Date(doc.updatedAt) : null;
        const timeStr = t ? `${t.getMonth()+1}/${t.getDate()}` : "";
        item.innerHTML = `<span class="cc-link-result-name">${esc(doc.name)}</span><span class="cc-link-result-meta">${esc(doc.type)} ${timeStr}</span>`;
        item.addEventListener("click", () => {
          linkedDocs.push({ url: doc.url, title: doc.name });
          renderLinkedDocs();
        });
        resultsEl.appendChild(item);
      });
    } catch (e) {
      resultsEl.innerHTML = `<div class="cc-link-loading">连接失败</div>`;
    }
  }

  renderLinkedDocs();

  // ========== HEALTH ==========
  async function checkHealth() { try { const r = await fetch(BRIDGE + "/health", { signal: AbortSignal.timeout(3000) }); bridgeOnline = !!(await r.json()).ok; } catch (_) { bridgeOnline = false; } statusDot.className = "cc-status-dot " + (bridgeOnline ? "cc-online" : "cc-offline"); }

  // ========== HELPERS ==========
  function getWelcomeHTML() { return `<div class="cc-welcome"><div class="cc-welcome-title">Claude Code</div><div class="cc-welcome-hint">选中文档中的文字，然后告诉我你想做什么。</div><div class="cc-welcome-shortcuts"><span><kbd>${MOD_KEY}</kbd>+<kbd>J</kbd> 打开</span><span><kbd>↵</kbd> 发送</span></div></div>`; }

  function addUserMsg(container, text) {
    const w = container.querySelector(".cc-welcome"); if (w) w.remove();
    const m = document.createElement("div"); m.className = "cc-msg cc-msg-user";
    m.innerHTML = `<div class="cc-msg-body">${esc(text)}</div>`;
    container.appendChild(m);
  }

  function addAssistantMsg(container) {
    const w = container.querySelector(".cc-welcome"); if (w) w.remove();
    const m = document.createElement("div"); m.className = "cc-msg cc-msg-assistant";
    m.innerHTML = `<div class="cc-msg-body"><div class="cc-activity"></div><div class="cc-reply"></div></div><div class="cc-msg-actions"></div>`;
    container.appendChild(m);
    return { activityEl: m.querySelector(".cc-activity"), replyEl: m.querySelector(".cc-reply"), actionsEl: m.querySelector(".cc-msg-actions") };
  }

  function addMsgActions(actionsEl, replyEl) {
    actionsEl.innerHTML = `<button class="cc-action-btn cc-copy-btn" title="复制">${ICON.copy} 复制</button><button class="cc-action-btn cc-write-btn" title="融合至文档">${ICON.docWrite} 融合至文档</button>`;
    actionsEl.querySelector(".cc-copy-btn").addEventListener("click", () => {
      const text = replyEl.innerText || replyEl.textContent;
      navigator.clipboard.writeText(text).then(() => {
        const btn = actionsEl.querySelector(".cc-copy-btn");
        btn.textContent = "✓ 已复制"; setTimeout(() => { btn.innerHTML = `${ICON.copy} 复制`; }, 1500);
      });
    });
    actionsEl.querySelector(".cc-write-btn").addEventListener("click", () => {
      if (isStreaming) return;
      const text = replyEl.innerText || replyEl.textContent;
      const btn = actionsEl.querySelector(".cc-write-btn");
      btn.innerHTML = `${ICON.docWrite} 融合中…`; btn.disabled = true;
      inputEl.value = `将以下内容融合写入当前文档中合适的位置（根据光标位置和文档结构自行判断最佳插入点，保持原文，不要修改、总结或省略）：\n\n${text}`;
      send();
      setTimeout(() => { btn.innerHTML = `${ICON.docWrite} 融合至文档`; btn.disabled = false; }, 2000);
    });
  }

  function addStep(el, type, text, icon) {
    const s = document.createElement("div"); s.className = "cc-step";
    const spin = (type === "status" || type === "thinking" || type === "tool_start") ? " cc-spinning" : "";
    const icons = { status: "⚙", thinking: "💭", tool_start: "🔧" };
    s.innerHTML = `<span class="cc-step-icon${spin}">${icon || icons[type] || "•"}</span><span class="cc-step-text">${text}</span>`;
    s.dataset.type = type; el.appendChild(s); return s;
  }
  function updateStatus(el, msg) { const l = el.querySelector('.cc-step[data-type="status"]'); if (l) l.querySelector(".cc-step-text").textContent = msg; else addStep(el, "status", msg); }
  function clearSteps(el, type) { el.querySelectorAll(`.cc-step[data-type="${type}"]`).forEach(n => n.remove()); }
  function scrollContainer(container) { requestAnimationFrame(() => { container.scrollTop = container.scrollHeight; }); }

  function humanizeError(err) {
    if (!err) return "发生未知错误，请重试";
    if (err.includes("超时")) return "请求处理时间过长，已自动停止，请尝试简化请求后重试";
    if (/退出码\s*\d+/.test(err)) return "Claude 处理异常，请重试";
    if (err.includes("SIGTERM") || err.includes("SIGKILL")) return "请求已被终止";
    if (err.includes("无法启动")) return "无法启动 Claude，请确认 Bridge 正在运行";
    return err;
  }

  // ========== MARKDOWN ==========
  function renderMarkdown(text) {
    if (!text) return "";
    const cb = []; let p = text.replace(/```(\w*)\n?([\s\S]*?)```/g, (_, l, c) => { cb.push(`<pre><code class="lang-${esc(l)}">${esc(c.replace(/\n$/, ""))}</code></pre>`); return `%%CB${cb.length-1}%%`; });
    const ic = []; p = p.replace(/`([^`\n]+)`/g, (_, c) => { ic.push(`<code>${esc(c)}</code>`); return `%%IC${ic.length-1}%%`; });
    p = esc(p); p = p.replace(/%%CB(\d+)%%/g, (_, i) => cb[i]); p = p.replace(/%%IC(\d+)%%/g, (_, i) => ic[i]);
    p = p.replace(/^######\s+(.+)$/gm, "<h6>$1</h6>").replace(/^#####\s+(.+)$/gm, "<h5>$1</h5>").replace(/^####\s+(.+)$/gm, "<h4>$1</h4>");
    p = p.replace(/^###\s+(.+)$/gm, "<h3>$1</h3>").replace(/^##\s+(.+)$/gm, "<h2>$1</h2>").replace(/^#\s+(.+)$/gm, "<h1>$1</h1>");
    p = p.replace(/^---+$/gm, "<hr/>").replace(/\*\*\*(.+?)\*\*\*/g, "<strong><em>$1</em></strong>").replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
    p = p.replace(/\[([^\]]+)\]\(([^)]+)\)/g, `<a href="$2" target="_blank" rel="noopener">$1</a>`);
    p = p.replace(/^&gt;\s?(.+)$/gm, "<blockquote>$1</blockquote>");
    p = p.replace(/^(\|.+\|)\n(\|[\s:|-]+\|)\n((?:\|.+\|\n?)+)/gm, (_, h, _s, b) => { const hs = h.split("|").filter(Boolean).map(c => c.trim()); const rs = b.trim().split("\n").map(r => r.split("|").filter(Boolean).map(c => c.trim())); let t = "<table><thead><tr>" + hs.map(c => `<th>${c}</th>`).join("") + "</tr></thead><tbody>"; rs.forEach(r => { t += "<tr>" + r.map(c => `<td>${c}</td>`).join("") + "</tr>"; }); return t + "</tbody></table>"; });
    p = p.replace(/^[\s]*[-*]\s+(.+)$/gm, "<li>$1</li>").replace(/((?:<li>.*<\/li>\n?)+)/g, "<ul>$1</ul>");
    p = p.replace(/^[\s]*\d+\.\s+(.+)$/gm, "<oli>$1</oli>").replace(/((?:<oli>.*<\/oli>\n?)+)/g, m => "<ol>" + m.replace(/<\/?oli>/g, t => t.replace("oli", "li")) + "</ol>");
    const blocks = p.split(/\n{2,}/); p = blocks.map(b => { b = b.trim(); if (!b) return ""; if (/^<(h[1-6]|pre|ul|ol|table|blockquote|hr)/.test(b)) return b; return `<p>${b.replace(/\n/g, "<br/>")}</p>`; }).join("\n");
    return `<div class="cc-md">${p}</div>`;
  }

  // ========== SEND ==========
  async function send() {
    if (isStreaming) return;
    const text = inputEl.value.trim(); if (!text) return;
    const selection = await waitForSelection();

    // Ensure conversation exists
    if (!activeConvId || !activeConv()) newConversation();
    const conv = activeConv();
    if (conv.title === "新会话") { conv.title = text.length > 30 ? text.slice(0, 30) + "…" : text; }

    const targetConvId = conv.id;
    const container = conv.container;
    const targetClaudeSession = conv.claudeSessionId;
    const targetCwd = conv.claudeCwd;
    const needsFork = conv.isImported && !!targetClaudeSession;

    inputHistory.unshift(text); if (inputHistory.length > 20) inputHistory.pop(); historyIdx = -1;

    isStreaming = true; sendBtn.disabled = true; stopBtn.classList.add("cc-active"); fab.classList.add("cc-streaming");
    addUserMsg(container, text);
    const { activityEl, replyEl, actionsEl } = addAssistantMsg(container);
    inputEl.value = ""; inputEl.style.height = "auto";
    scrollContainer(container);

    let accumulated = "", gotContent = false, currentToolStep = null, sessionId = null, stopped = false, renderFrame = null;
    let stepCount = 0, startTime = Date.now();

    const LABELS = { "Bash": "执行命令", "Read": "读取文件", "Write": "写入文件", "Edit": "编辑文件", "Skill": "调用技能", "WebSearch": "搜索网络", "WebFetch": "获取网页" };
    function label(n) { return LABELS[n] || (/bash/i.test(n) ? "执行命令" : /read/i.test(n) ? "读取文件" : /search/i.test(n) ? "搜索网络" : /skill/i.test(n) ? "调用技能" : n); }
    function scroll() { scrollContainer(container); }

    function scheduleRender() { if (renderFrame) return; renderFrame = requestAnimationFrame(() => { renderFrame = null; replyEl.innerHTML = renderMarkdown(accumulated) + `<span class="cc-cursor"></span>`; scroll(); }); }

    function flushTextToStep() {
      if (!accumulated.trim()) return;
      const el = document.createElement("div"); el.className = "cc-thought";
      el.textContent = accumulated.trim().length > 120 ? accumulated.trim().slice(0, 120) + "…" : accumulated.trim();
      activityEl.appendChild(el); accumulated = "";
      if (renderFrame) { cancelAnimationFrame(renderFrame); renderFrame = null; } replyEl.innerHTML = ""; scroll();
    }

    function collapseActivity() {
      if (activityEl.children.length === 0) return;
      const elapsed = Math.round((Date.now() - startTime) / 1000);
      const timeStr = elapsed >= 60 ? `${Math.floor(elapsed/60)}分${elapsed%60}秒` : `${elapsed}秒`;
      const details = activityEl.innerHTML; activityEl.innerHTML = "";
      const summary = document.createElement("div"); summary.className = "cc-activity-summary";
      summary.innerHTML = `<span class="cc-summary-toggle">▶</span> 已完成 · ${stepCount}步 · ${timeStr}`;
      const wrap = document.createElement("div"); wrap.className = "cc-activity-details"; wrap.innerHTML = details; wrap.style.display = "none";
      summary.addEventListener("click", () => { const o = wrap.style.display !== "none"; wrap.style.display = o ? "none" : "block"; summary.querySelector(".cc-summary-toggle").textContent = o ? "▶" : "▼"; });
      activityEl.appendChild(summary); activityEl.appendChild(wrap);
    }

    function handleEvent(ev) {
      switch (ev.type) {
        case "claude_session": { const c = getConv(targetConvId); if (c) { c.claudeSessionId = ev.claudeSessionId; c.isImported = false; } LOG("claude session:", ev.claudeSessionId); break; }
        case "status": updateStatus(activityEl, ev.message); break;
        case "thinking_start": clearSteps(activityEl, "status"); if (!activityEl.querySelector('.cc-step[data-type="thinking"]')) addStep(activityEl, "thinking", "思考中…"); break;
        case "thinking": break;
        case "thinking_done": { const s = activityEl.querySelector('.cc-step[data-type="thinking"]'); if (s) s.remove(); break; }
        case "delta":
          if (!gotContent) { gotContent = true; clearSteps(activityEl, "status"); clearSteps(activityEl, "thinking"); }
          accumulated += ev.text; scheduleRender(); break;
        case "tool_start":
          stepCount++; clearSteps(activityEl, "status"); clearSteps(activityEl, "thinking");
          if (accumulated.trim()) flushTextToStep();
          if (currentToolStep) { currentToolStep.querySelector(".cc-step-icon").className = "cc-step-icon"; currentToolStep.querySelector(".cc-step-icon").textContent = "✅"; }
          currentToolStep = addStep(activityEl, "tool_start", label(ev.name)); break;
        case "tool_detail":
          if (currentToolStep && ev.text) {
            let d = currentToolStep.querySelector(".cc-step-detail");
            if (!d) { d = document.createElement("div"); d.className = "cc-step-detail"; currentToolStep.appendChild(d); }
            let t = ev.text; if (t.includes("/")) t = t.replace(/\/[\w./-]+\/([\w.-]+)/g, "…/$1");
            d.textContent = t.length > 80 ? t.slice(0, 80) + "…" : t;
          } break;
        case "tool_input": break;
        case "tool_result":
          if (currentToolStep) { const ic = currentToolStep.querySelector(".cc-step-icon"); ic.className = "cc-step-icon"; ic.textContent = ev.is_error ? "❌" : "✅"; currentToolStep = null; } break;
        case "done":
          clearSteps(activityEl, "status"); clearSteps(activityEl, "thinking");
          if (currentToolStep) { currentToolStep.querySelector(".cc-step-icon").className = "cc-step-icon"; currentToolStep.querySelector(".cc-step-icon").textContent = "✅"; }
          if (renderFrame) { cancelAnimationFrame(renderFrame); renderFrame = null; }
          collapseActivity(); replyEl.innerHTML = renderMarkdown(ev.result || accumulated);
          addMsgActions(actionsEl, replyEl); scroll(); persistIndex(); break;
        case "error": {
          clearSteps(activityEl, "status"); clearSteps(activityEl, "thinking");
          if (activityEl.children.length > 0) collapseActivity();
          const friendlyMsg = humanizeError(ev.error);
          const isTimeout = (ev.error || "").includes("超时");
          replyEl.innerHTML = `<div class="cc-error">${esc(friendlyMsg)}</div>`;
          if (isTimeout) { const btn = document.createElement("button"); btn.className = "cc-retry-btn"; btn.textContent = "重试"; btn.addEventListener("click", () => { container.removeChild(container.lastElementChild); container.removeChild(container.lastElementChild); inputEl.value = text; send(); }); replyEl.querySelector(".cc-error").appendChild(document.createElement("br")); replyEl.querySelector(".cc-error").appendChild(btn); }
          scroll(); persistIndex(); break;
        }
      }
    }

    abortController = { abort: async () => { stopped = true; if (sessionId) { try { await fetch(BRIDGE + "/stop/" + sessionId, { method: "POST" }); } catch (_) {} } } };

    try {
      const startRes = await fetch(BRIDGE + "/start", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ request: text, url: getDocUrl(), title: getDocTitle(), selection, linkedDocs, claudeSessionId: targetClaudeSession, claudeCwd: targetCwd, forkSession: needsFork, cursorPos: { from: cachedCursorFrom, to: cachedCursorTo, context: cachedCursorCtx } }),
      });
      const d = await startRes.json(); if (!d.ok) throw new Error(d.error || "启动失败");
      sessionId = d.sessionId; LOG("session:", sessionId);

      let cursor = 0, polls = 0, consecutiveErrors = 0;
      while (!stopped) {
        await sleep(200); if (stopped) break;
        try {
          const r = await fetch(BRIDGE + "/poll/" + sessionId + "?cursor=" + cursor);
          const p = await r.json(); if (!p.ok) break;
          polls++; consecutiveErrors = 0;

          for (const ev of p.events) {
            if (ev.type === "close" || ev.type === "done" || ev.type === "error") stopped = true;
            try { handleEvent(ev); } catch (e) { LOG("event error:", e); }
            if (stopped) break;
          }
          cursor = p.cursor; if (p.done || stopped) break;
        } catch (e) {
          consecutiveErrors++;
          LOG("poll error:", e.message, `(${consecutiveErrors}/5)`);
          if (consecutiveErrors >= 5) {
            // Bridge is down — show reconnect error
            clearSteps(activityEl, "status"); clearSteps(activityEl, "thinking");
            replyEl.innerHTML = `<div class="cc-error">Bridge 连接中断，请检查 bridge 是否在运行</div>`;
            const retryBtn = document.createElement("button");
            retryBtn.className = "cc-retry-btn"; retryBtn.textContent = "重试";
            retryBtn.addEventListener("click", () => {
              container.removeChild(container.lastElementChild);
              container.removeChild(container.lastElementChild);
              inputEl.value = text; send();
            });
            replyEl.querySelector(".cc-error").appendChild(document.createElement("br"));
            replyEl.querySelector(".cc-error").appendChild(retryBtn);
            stopped = true; scroll(); break;
          }
          await sleep(1000); // back off before retry
        }
      }
      LOG("stopped after", polls, "polls");
      activityEl.querySelectorAll(".cc-spinning").forEach(el => el.classList.remove("cc-spinning"));
      if (currentToolStep) {
        const ic = currentToolStep.querySelector(".cc-step-icon");
        if (ic) { ic.className = "cc-step-icon"; ic.textContent = "⏹"; }
        currentToolStep = null;
      }
      if (renderFrame) { cancelAnimationFrame(renderFrame); renderFrame = null; }
      if (!actionsEl.querySelector(".cc-action-btn")) {
        if (activityEl.children.length > 0 && !activityEl.querySelector(".cc-activity-summary")) {
          collapseActivity();
          const summary = activityEl.querySelector(".cc-activity-summary");
          if (summary) summary.innerHTML = summary.innerHTML.replace("已完成", "已停止");
        }
        if (accumulated) {
          replyEl.innerHTML = renderMarkdown(accumulated) + `<div class="cc-stopped">⏹ 已停止生成</div>`;
          addMsgActions(actionsEl, replyEl);
        } else if (!replyEl.querySelector(".cc-error")) {
          replyEl.innerHTML = `<div class="cc-stopped">⏹ 已停止生成</div>`;
        }
        persistIndex();
      }
    } catch (err) {
      replyEl.innerHTML = `<div class="cc-error">无法连接 Bridge，请确认已运行 <code>cd bridge && npm start</code></div>`;
    } finally {
      if (renderFrame) cancelAnimationFrame(renderFrame);
      isStreaming = false; sendBtn.disabled = false; stopBtn.classList.remove("cc-active"); fab.classList.remove("cc-streaming"); abortController = null;
      persistIndex();
    }
  }

  function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

  // ========== DRAG ==========
  (function () {
    const hdr = panel.querySelector(".cc-header"); let d = false, sx, sy, sl, st;
    hdr.addEventListener("mousedown", (e) => { if (e.target.closest(".cc-header-btn")) return; d = true; const r = panel.getBoundingClientRect(); sx = e.clientX; sy = e.clientY; sl = r.left; st = r.top; panel.style.right = "auto"; panel.style.bottom = "auto"; panel.style.left = r.left + "px"; panel.style.top = r.top + "px"; document.body.style.userSelect = "none"; e.preventDefault(); });
    window.addEventListener("mousemove", (e) => { if (!d) return; panel.style.left = Math.max(0, Math.min(innerWidth - 100, sl + e.clientX - sx)) + "px"; panel.style.top = Math.max(0, Math.min(innerHeight - 100, st + e.clientY - sy)) + "px"; });
    window.addEventListener("mouseup", () => { if (d) { d = false; document.body.style.userSelect = ""; } });
  })();

  // ========== RESIZE ==========
  (function () {
    const handle = document.createElement("div");
    handle.className = "cc-resize-handle";
    panel.appendChild(handle);
    let r = false, sx, sy, sw, sh;
    handle.addEventListener("mousedown", (e) => {
      r = true; const rect = panel.getBoundingClientRect();
      sx = e.clientX; sy = e.clientY; sw = rect.width; sh = rect.height;
      if (panel.style.right !== "auto") { panel.style.left = rect.left + "px"; panel.style.top = rect.top + "px"; panel.style.right = "auto"; panel.style.bottom = "auto"; }
      document.body.style.userSelect = "none"; e.preventDefault(); e.stopPropagation();
    });
    window.addEventListener("mousemove", (e) => { if (!r) return; panel.style.width = Math.max(320, Math.min(600, sw + e.clientX - sx)) + "px"; panel.style.height = Math.max(340, Math.min(innerHeight * 0.9, sh + e.clientY - sy)) + "px"; });
    window.addEventListener("mouseup", () => { if (r) { r = false; document.body.style.userSelect = ""; } });
  })();

  function esc(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }

  // ========== VERSION UPDATE CHECK ==========
  const UPDATE_CHECK_KEY = "cc_update_check";
  const UPDATE_CHECK_INTERVAL = 24 * 60 * 60 * 1000;
  const updateBanner = panel.querySelector(".cc-update-banner");
  let updateInfo = null;

  function showUpdateBanner(info) {
    updateDot.classList.add("cc-update-available");
    updateBanner.innerHTML = `
      <span class="cc-update-icon">↑</span>
      <span class="cc-update-text">新版本 <strong>v${esc(info.latestVersion)}</strong> 可用（当前 v${esc(info.localVersion)}）</span>
      <a class="cc-update-link" href="${esc(info.releaseUrl)}" target="_blank" rel="noopener">查看更新</a>
      <button class="cc-update-now-btn">立即更新</button>
      <button class="cc-update-dismiss">×</button>
    `;
    updateBanner.style.display = "flex";
    updateBanner.querySelector(".cc-update-now-btn").addEventListener("click", () => doSelfUpdate());
    updateBanner.querySelector(".cc-update-dismiss").addEventListener("click", () => {
      updateBanner.style.display = "none";
      updateDot.classList.remove("cc-update-available");
      chrome.storage.local.get(UPDATE_CHECK_KEY, (d) => {
        const data = d[UPDATE_CHECK_KEY] || {};
        data.dismissedVersion = info.latestVersion;
        chrome.storage.local.set({ [UPDATE_CHECK_KEY]: data });
      });
    });
  }

  async function doSelfUpdate() {
    const textEl = updateBanner.querySelector(".cc-update-text");
    const nowBtn = updateBanner.querySelector(".cc-update-now-btn");
    const linkEl = updateBanner.querySelector(".cc-update-link");
    const dismissEl = updateBanner.querySelector(".cc-update-dismiss");
    nowBtn.disabled = true;
    nowBtn.textContent = "更新中…";
    if (linkEl) linkEl.style.display = "none";
    if (dismissEl) dismissEl.style.display = "none";
    textEl.innerHTML = "正在下载并安装更新…";
    LOG("[update] starting self-update…");

    try {
      const r = await fetch(BRIDGE + "/self-update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: AbortSignal.timeout(60000),
      });
      const result = await r.json();
      if (!result.ok) throw new Error(result.error || "更新失败");

      LOG(`[update] self-update success, new version: v${result.version}`);
      textEl.innerHTML = `已更新到 <strong>v${esc(result.version)}</strong>，正在重启…`;
      nowBtn.style.display = "none";

      chrome.storage.local.remove(UPDATE_CHECK_KEY);
      // 通知 service worker 开始轮询，版本变化后自动 reload 扩展
      chrome.storage.local.set({ cc_self_update_pending: true });

      // 前端也轮询 bridge health，提示用户进度
      let retries = 0;
      const poll = setInterval(async () => {
        retries++;
        try {
          const h = await fetch(BRIDGE + "/health", { signal: AbortSignal.timeout(2000) });
          const hd = await h.json();
          if (hd.ok) {
            clearInterval(poll);
            LOG("[update] bridge restarted, extension will auto-reload via service worker");
            textEl.innerHTML = "更新完成，扩展即将自动重载…";
            // 兜底：如果 service worker 没有触发 reload，10 秒后提示手动刷新
            setTimeout(() => {
              if (updateBanner.style.display !== "none") {
                textEl.innerHTML = "更新完成！请刷新页面以加载新版扩展。";
                const refreshBtn = document.createElement("button");
                refreshBtn.className = "cc-update-now-btn";
                refreshBtn.textContent = "刷新页面";
                refreshBtn.addEventListener("click", () => location.reload());
                updateBanner.appendChild(refreshBtn);
              }
            }, 10000);
          }
        } catch (_) {}
        if (retries > 30) {
          clearInterval(poll);
          textEl.innerHTML = "Bridge 重启中，请稍后手动刷新页面";
        }
      }, 2000);
    } catch (e) {
      LOG("[update] self-update failed:", e.message);
      textEl.innerHTML = `更新失败：${esc(e.message)}`;
      nowBtn.textContent = "重试";
      nowBtn.disabled = false;
      if (linkEl) linkEl.style.display = "";
      if (dismissEl) dismissEl.style.display = "";
    }
  }

  function hideUpdateBanner() {
    updateBanner.style.display = "none";
    updateDot.classList.remove("cc-update-available");
  }

  async function checkForUpdate() {
    LOG("[update] starting version check…");
    try {
      const data = await new Promise(r => chrome.storage.local.get(UPDATE_CHECK_KEY, r));
      const cached = data[UPDATE_CHECK_KEY] || {};
      const now = Date.now();

      if (cached.lastCheck) {
        const ago = Math.round((now - cached.lastCheck) / 1000);
        LOG(`[update] last check: ${ago}s ago, cached: local=v${cached.localVersion || "?"} latest=v${cached.latestVersion || "?"} hasUpdate=${cached.hasUpdate} dismissed=${cached.dismissedVersion || "none"}`);
      } else {
        LOG("[update] no previous check found");
      }

      if (cached.hasUpdate && cached.dismissedVersion !== cached.latestVersion) {
        LOG(`[update] showing cached update banner: v${cached.latestVersion}`);
        updateInfo = cached;
        showUpdateBanner(cached);
      }

      if (cached.lastCheck && (now - cached.lastCheck) < UPDATE_CHECK_INTERVAL) {
        LOG(`[update] skipping fetch, next check in ${Math.round((UPDATE_CHECK_INTERVAL - (now - cached.lastCheck)) / 1000)}s`);
        return;
      }

      LOG("[update] fetching /check-update from bridge…");
      const r = await fetch(BRIDGE + "/check-update", { signal: AbortSignal.timeout(10000) });
      const result = await r.json();
      LOG("[update] bridge response:", JSON.stringify(result));

      if (!result.ok) {
        LOG("[update] bridge returned ok=false, aborting");
        return;
      }

      const store = {
        lastCheck: now,
        hasUpdate: result.hasUpdate,
        localVersion: result.localVersion,
        latestVersion: result.latestVersion || "",
        releaseUrl: result.releaseUrl || "",
        changelog: result.changelog || "",
        dismissedVersion: cached.dismissedVersion || null,
      };
      chrome.storage.local.set({ [UPDATE_CHECK_KEY]: store });

      if (result.hasUpdate && store.dismissedVersion !== result.latestVersion) {
        LOG(`[update] ✨ new version available: v${result.localVersion} → v${result.latestVersion}`);
        updateInfo = store;
        showUpdateBanner(store);
      } else if (result.hasUpdate) {
        LOG(`[update] update v${result.latestVersion} available but dismissed by user`);
        hideUpdateBanner();
      } else {
        LOG(`[update] already up to date (v${result.localVersion})`);
        hideUpdateBanner();
      }
    } catch (e) {
      LOG("[update] check failed:", e.message);
    }
  }

  // ========== INIT ==========
  restoreIndex();
  checkForUpdate();
})();

console.log("[CC] ✅ Claude Code 已注入！");
