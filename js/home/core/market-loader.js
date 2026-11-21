/* =========================================================
   Market Feed · 覆盖层（Overlay）控制器
   1) 点击 [data-market-open] → 打开 #market-layer（不跳页、不新增页面）
   2) 首次打开才 fetch html/market/market.html 注入并加载 market.js（懒加载）
   3) 打开时导航只保留 Home / EN·ZH / 主题 / Contact
   4) 关闭：左上返回键 / Esc / Home / 遮罩外点击
   5) 日志窗与音乐播放器属于全局 HUD，层级高于覆盖层，因此照常可用
   ========================================================= */
(function () {
    'use strict';

    var loaded = false;
    var layer, slot, btn, closeBound = false;

    function isOpen() { return document.body.classList.contains('market-open'); }

    /* ---------- 片段注入 ---------- */
    function applyLang(root) {
        if (document.documentElement.lang !== 'zh-CN') return;
        root.querySelectorAll('[data-en]').forEach(function (el) {
            var v = el.getAttribute('data-zh');
            if (v === null) return;
            var hasEl = false;
            el.childNodes.forEach(function (n) { if (n.nodeType === 1) hasEl = true; });
            if (hasEl) {
                el.childNodes.forEach(function (n) {
                    if (n.nodeType === 3 && n.textContent.trim()) n.textContent = v;
                });
            } else {
                el.textContent = v;
            }
        });
    }

    function revealAll(root) {
        root.querySelectorAll('.reveal').forEach(function (el) { el.classList.add('active'); });
    }

    function loadMarketJs(done) {
        if (document.getElementById('market-module-js')) { done(); return; }
        var s = document.createElement('script');
        s.id = 'market-module-js';
        s.src = 'js/home/core/market.js';
        s.onload = done;
        s.onerror = function () { console.warn('[market] market.js 加载失败'); done(); };
        document.body.appendChild(s);
    }

    function ensureContent(done) {
        if (loaded) { done(); return; }
        fetch(slot.getAttribute('data-include'), { cache: 'no-store' })
          .then(function (r) {
              if (!r.ok) throw new Error('HTTP ' + r.status);
              return r.text();
          })
          .then(function (html) {
              slot.innerHTML = html;
              applyLang(slot);
              loaded = true;
              loadMarketJs(function () { done(); });
          })
          .catch(function (err) {
              slot.innerHTML = '<p style="padding:80px 20px;font-family:monospace;color:var(--text-muted)">MARKET FEED 加载失败：' + err.message + '</p>';
              console.warn('[market] 片段注入失败：', err.message);
          });
    }

    /* ---------- 开关 ---------- */
    function open() {
        if (!layer) return;
        ensureContent(function () {
            layer.classList.add('is-open');
            layer.setAttribute('aria-hidden', 'false');
            document.body.classList.add('market-open');
            document.body.style.overflow = 'hidden';
            revealAll(layer);
            if (window.MarketFeed && window.MarketFeed.resume) window.MarketFeed.resume();
            layer.scrollTop = 0;
            // 关闭后焦点可回到触发点
            var backBtn = layer.querySelector('#mk-back');
            if (backBtn) backBtn.focus({ preventScroll: true });
        });
    }

    function close() {
        if (!layer || !isOpen()) return;
        layer.classList.remove('is-open');
        layer.setAttribute('aria-hidden', 'true');
        document.body.classList.remove('market-open');
        document.body.style.overflow = '';
        if (window.MarketFeed && window.MarketFeed.pause) window.MarketFeed.pause();
    }

    /* ---------- 事件 ---------- */
    function boot() {
        layer = document.getElementById('market-layer');
        slot = document.getElementById('market-slot');
        if (!layer || !slot) return;

        // 入口
        document.addEventListener('click', function (e) {
            var trigger = e.target.closest ? e.target.closest('[data-market-open]') : null;
            if (trigger) {
                e.preventDefault();
                // 收起移动菜单
                var menu = document.getElementById('mobile-menu');
                if (menu) { menu.classList.add('hidden'); menu.classList.remove('flex'); }
                var toggle = document.getElementById('menu-toggle');
                if (toggle) {
                    toggle.innerHTML = '<i class="fas fa-bars"></i>';
                    toggle.setAttribute('aria-expanded', 'false');
                }
                open();
                return;
            }
            // 返回键 / 遮罩空白区
            if (e.target.closest && e.target.closest('#mk-back')) {
                e.preventDefault();
                close();
                return;
            }
            // 打开状态下点击 Home 收起覆盖层
            if (isOpen() && e.target.closest) {
                var home = e.target.closest('a[href="#home"]');
                if (home) { e.preventDefault(); close(); }
            }
        });

        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape' && isOpen()) close();
        });

        // 关闭方式保持显式（返回键 / Esc / Home），避免滚动时误触关闭
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
    else boot();
})();
