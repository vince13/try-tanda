/**
 * Floating AI shopping assistant.
 * - Public / non-admin: POST /api/commerce/assistant/search/ (parity with Flutter).
 * - Tanda web admins: POST /api/commerce/assistant/chat/ — multi-turn, market/state-aware plans.
 *
 * Depends on `js/super-affiliate-api.js` (global SuperAffiliateAPI).
 */
(function () {
  'use strict';

  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function siteRoot() {
    if (typeof SuperAffiliateAPI !== 'undefined' && SuperAffiliateAPI.getPathToSiteRoot) {
      return SuperAffiliateAPI.getPathToSiteRoot();
    }
    return '';
  }

  function productThumbUrl(p) {
    if (!p || !p.images || !p.images.length) return '';
    const im = p.images[0];
    return (im && (im.image || im.url || im.file || im.image_url)) || '';
  }

  function formatPrice(v) {
    if (v == null || v === '') return '—';
    const n = Number(v);
    if (Number.isFinite(n)) {
      try {
        return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(n);
      } catch (_) {
        return `₦${Math.round(n)}`;
      }
    }
    return escapeHtml(String(v));
  }

  function formatPlanBits(plan) {
    if (!plan || typeof plan !== 'object') return '';
    const bits = [];
    if (plan.intent === 'context_qa') {
      if (plan.context_qa_topic) bits.push('Mode: ' + plan.context_qa_topic);
      if (plan.ship_to_state) bits.push('Ship-to: ' + plan.ship_to_state);
      if (plan.keywords && plan.keywords.length) bits.push('Context: ' + plan.keywords.join(', '));
      return bits.join(' · ');
    }
    if (plan.keywords && plan.keywords.length) bits.push('Keywords: ' + plan.keywords.join(', '));
    if (plan.category_hint) bits.push('Category: ' + plan.category_hint);
    if (plan.price_min || plan.price_max) {
      bits.push('Budget: ' + [plan.price_min || '—', plan.price_max || '—'].join(' – '));
    }
    if (plan.sort) bits.push('Sort: ' + plan.sort);
    if (plan.market_state) bits.push('State: ' + plan.market_state);
    if (plan.market_name_hint) bits.push('Market hint: ' + plan.market_name_hint);
    if (plan.local_market_slug) bits.push('Market slug: ' + plan.local_market_slug);
    if (plan.local_market_only) bits.push('Local-market listings only');
    return bits.join(' · ');
  }

  function renderProductGridHtml(products) {
    const list = Array.isArray(products) ? products : [];
    if (!list.length) {
      return '<p class="tanda-sa-msg tanda-sa-msg--inline">No product cards for this turn.</p>';
    }
    const rootHref = siteRoot();
    const cards = list.map((p) => {
      const id = p && p.id;
      const href = id ? `${rootHref}product-detail.html?id=${encodeURIComponent(id)}` : '#';
      const thumb = productThumbUrl(p);
      const imgTag = thumb
        ? `<img src="${escapeHtml(thumb)}" alt="" loading="lazy" />`
        : '<div style="aspect-ratio:1;background:#222;"></div>';
      return `<a class="tanda-sa-card" href="${href}">
            ${imgTag}
            <div class="meta">
              <div class="name">${escapeHtml((p && p.name) || 'Product')}</div>
              <div class="price">${formatPrice(p && p.price)}</div>
            </div>
          </a>`;
    }).join('');
    return `<div class="tanda-sa-grid">${cards}</div>`;
  }

  function injectStyles() {
    if (document.getElementById('tanda-shopping-assistant-styles')) return;
    const st = document.createElement('style');
    st.id = 'tanda-shopping-assistant-styles';
    st.textContent = `
      #tanda-shopping-assistant-root { font-family: Inter, system-ui, sans-serif; }
      .tanda-sa-fab {
        position: fixed;
        right: max(16px, env(safe-area-inset-right));
        bottom: max(20px, env(safe-area-inset-bottom));
        width: 56px;
        height: 56px;
        border-radius: 50%;
        border: none;
        cursor: pointer;
        z-index: 10055;
        background: linear-gradient(135deg, #ff0050, #00f2ea);
        color: #fff;
        box-shadow: 0 8px 28px rgba(0,0,0,0.45);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 1.35rem;
        transition: transform 0.15s ease;
      }
      .tanda-sa-fab:hover { transform: scale(1.05); }
      .tanda-sa-fab:focus-visible { outline: 2px solid #00f2ea; outline-offset: 3px; }
      .tanda-sa-backdrop {
        position: fixed; inset: 0; background: rgba(0,0,0,0.55);
        z-index: 10051; opacity: 0; pointer-events: none; transition: opacity 0.2s;
      }
      .tanda-sa-backdrop.tanda-sa-open { opacity: 1; pointer-events: auto; }
      .tanda-sa-panel {
        position: fixed;
        right: max(12px, env(safe-area-inset-right));
        bottom: max(88px, calc(env(safe-area-inset-bottom) + 72px));
        width: min(420px, calc(100vw - 24px));
        max-height: min(78vh, 640px);
        z-index: 10052;
        background: rgba(18, 18, 22, 0.97);
        border: 1px solid rgba(255,255,255,0.12);
        border-radius: 18px;
        box-shadow: 0 24px 60px rgba(0,0,0,0.6);
        display: flex;
        flex-direction: column;
        overflow: hidden;
        transform: translateY(12px); opacity: 0;
        pointer-events: none; transition: opacity 0.2s, transform 0.2s;
      }
      .tanda-sa-panel.tanda-sa-open { opacity: 1; transform: translateY(0); pointer-events: auto; }
      .tanda-sa-head {
        padding: 1rem 1rem 0.75rem;
        border-bottom: 1px solid rgba(255,255,255,0.08);
      }
      .tanda-sa-head-row {
        display: flex; align-items: flex-start; justify-content: space-between; gap: 0.5rem;
      }
      .tanda-sa-head h3 {
        margin: 0; font-size: 1.05rem; font-weight: 700;
        background: linear-gradient(90deg, #ff0050, #00f2ea);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        background-clip: text;
      }
      .tanda-sa-role-pill {
        flex-shrink: 0;
        font-size: 0.62rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em;
        padding: 0.25rem 0.45rem; border-radius: 6px;
        background: rgba(0, 242, 234, 0.15); color: #7ffaf4; border: 1px solid rgba(0,242,234,0.35);
      }
      .tanda-sa-head p { margin: 0.35rem 0 0; font-size: 0.8rem; color: rgba(255,255,255,0.55); }
      .tanda-sa-body { flex: 1; overflow: auto; padding: 0.75rem 1rem 1rem; display: flex; flex-direction: column; min-height: 0; }
      .tanda-sa-body--admin .tanda-sa-thread-wrap {
        flex: 1; min-height: 140px; max-height: min(38vh, 320px); overflow: hidden;
        display: flex; flex-direction: column; margin-bottom: 0.5rem;
      }
      .tanda-sa-thread {
        flex: 1; overflow: auto; padding-right: 4px;
        display: flex; flex-direction: column; gap: 0.65rem;
      }
      .tanda-sa-thread-intro {
        margin: 0; font-size: 0.78rem; color: rgba(255,255,255,0.5); line-height: 1.45;
        padding: 0.35rem 0.25rem;
      }
      .tanda-sa-bubble-row { display: flex; width: 100%; }
      .tanda-sa-bubble-row--user { justify-content: flex-end; }
      .tanda-sa-bubble-row--assistant { justify-content: flex-start; }
      .tanda-sa-bubble {
        max-width: 92%; border-radius: 14px; padding: 0.55rem 0.7rem; font-size: 0.86rem; line-height: 1.4;
      }
      .tanda-sa-bubble--user {
        background: rgba(255, 0, 80, 0.22); border: 1px solid rgba(255,0,80,0.35); color: #fff;
      }
      .tanda-sa-bubble--assistant {
        background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); color: rgba(255,255,255,0.92);
      }
      .tanda-sa-reply { margin: 0 0 0.5rem; }
      .tanda-sa-plan--bubble { margin-bottom: 0.55rem; font-size: 0.72rem; }
      .tanda-sa-admin-actions {
        display: flex; justify-content: flex-end; margin-bottom: 0.45rem;
      }
      .tanda-sa-admin-actions button {
        background: transparent; border: 1px solid rgba(255,255,255,0.2); color: rgba(255,255,255,0.65);
        border-radius: 8px; padding: 0.28rem 0.55rem; font-size: 0.72rem; cursor: pointer;
      }
      .tanda-sa-admin-actions button:hover { border-color: rgba(0,242,234,0.45); color: #fff; }
      .tanda-sa-form { display: flex; gap: 0.5rem; margin-bottom: 0.75rem; flex-shrink: 0; }
      .tanda-sa-form input {
        flex: 1; border-radius: 10px; border: 1px solid rgba(255,255,255,0.15);
        background: rgba(0,0,0,0.35); color: #fff; padding: 0.65rem 0.85rem; font-size: 0.95rem;
      }
      .tanda-sa-form button {
        border: none; border-radius: 10px; padding: 0 1rem; font-weight: 600; cursor: pointer;
        background: linear-gradient(135deg, #ff0050, #00f2ea); color: #fff; white-space: nowrap;
      }
      .tanda-sa-form button:disabled { opacity: 0.55; cursor: not-allowed; }
      .tanda-sa-plan {
        font-size: 0.78rem; color: rgba(255,255,255,0.65);
        background: rgba(255,255,255,0.04); border-radius: 10px; padding: 0.6rem 0.75rem;
        margin-bottom: 0.75rem; line-height: 1.45;
      }
      .tanda-sa-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0.6rem; }
      @media (max-width: 360px) { .tanda-sa-grid { grid-template-columns: 1fr; } }
      .tanda-sa-card {
        border-radius: 12px; overflow: hidden;
        background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1);
        text-decoration: none; color: inherit; display: block;
      }
      .tanda-sa-card img { width: 100%; aspect-ratio: 1; object-fit: cover; background: #111; display: block; }
      .tanda-sa-card .meta { padding: 0.5rem 0.6rem 0.65rem; }
      .tanda-sa-card .name { font-size: 0.8rem; font-weight: 600; line-height: 1.25; color: #fff;
        display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
      .tanda-sa-card .price { font-size: 0.75rem; color: #00f2ea; margin-top: 0.25rem; }
      .tanda-sa-msg { font-size: 0.85rem; color: rgba(255,255,255,0.55); text-align: center; padding: 1.25rem 0.5rem; }
      .tanda-sa-msg--inline { text-align: left; padding: 0.35rem 0; font-size: 0.78rem; }
      .tanda-sa-err { color: #ff8a8a; font-size: 0.85rem; padding: 0.5rem 0; }
      @media (min-width: 1024px) {
        body.tanda-desktop-sidebar-on #tanda-shopping-assistant-root .tanda-sa-fab {
          right: calc(260px + 16px + env(safe-area-inset-right, 0px));
        }
        body.tanda-desktop-sidebar-on #tanda-shopping-assistant-root .tanda-sa-panel {
          right: calc(260px + 12px + env(safe-area-inset-right, 0px));
        }
      }
    `;
    document.head.appendChild(st);
  }

  function mount(opts) {
    if (document.getElementById('tanda-shopping-assistant-root')) return;
    if (typeof SuperAffiliateAPI === 'undefined') return;

    injectStyles();

    const pageLabel = (opts && opts.pageLabel) || document.body.dataset.tandaPageLabel || '';
    const isAdminMode = !!(opts && opts.isAdmin);

    const root = document.createElement('div');
    root.id = 'tanda-shopping-assistant-root';
    root.setAttribute('aria-live', 'polite');
    if (isAdminMode) root.dataset.tandaAssistantMode = 'admin';

    const sub =
      pageLabel ||
      (isAdminMode
        ? 'Admin preview — follow-ups, local markets & states, cheapest sorting from live catalog.'
        : 'Ask in plain language – we search live catalog picks.');

    root.innerHTML = `
      <button type="button" class="tanda-sa-fab" id="tandaSaFab" aria-expanded="false" aria-label="${
        isAdminMode ? 'Open admin shopping assistant' : 'Open shopping assistant'
      }" title="${isAdminMode ? 'AI shopping assistant (admin)' : 'AI shopping assistant'}">
        <i class="fas fa-wand-magic-sparkles" aria-hidden="true"></i>
      </button>
      <div class="tanda-sa-backdrop" id="tandaSaBackdrop" hidden></div>
      <div class="tanda-sa-panel" id="tandaSaPanel" role="dialog" aria-label="Shopping assistant" hidden>
        <div class="tanda-sa-head">
          <div class="tanda-sa-head-row">
            <h3>AI shopping assistant</h3>
            ${isAdminMode ? '<span class="tanda-sa-role-pill" title="Not shown to shoppers until release">Admin</span>' : ''}
          </div>
          <p>${escapeHtml(sub)}</p>
        </div>
        <div class="tanda-sa-body ${isAdminMode ? 'tanda-sa-body--admin' : ''}" id="tandaSaBody">
          <div id="tandaSaThreadWrap" class="tanda-sa-thread-wrap" ${isAdminMode ? '' : 'hidden'}>
            <div class="tanda-sa-admin-actions" id="tandaSaAdminActions" ${isAdminMode ? '' : 'hidden'}>
              <button type="button" id="tandaSaClearChat">Clear chat</button>
            </div>
            <div class="tanda-sa-thread" id="tandaSaThread" aria-label="Conversation"></div>
          </div>
          <form class="tanda-sa-form" id="tandaSaForm">
            <input type="search" id="tandaSaInput" maxlength="500" autocomplete="off"
              placeholder="${
                isAdminMode ? 'e.g. cheapest rice in Ebonyi, then follow up…' : 'e.g. men’s sneakers under 25k'
              }" aria-label="Shopping question" />
            <button type="submit" id="tandaSaSubmit">${isAdminMode ? 'Send' : 'Ask'}</button>
          </form>
          <div id="tandaSaPlan"></div>
          <div id="tandaSaOut"></div>
        </div>
      </div>
    `;

    document.body.appendChild(root);

    const fab = root.querySelector('#tandaSaFab');
    const backdrop = root.querySelector('#tandaSaBackdrop');
    const panel = root.querySelector('#tandaSaPanel');
    const form = root.querySelector('#tandaSaForm');
    const input = root.querySelector('#tandaSaInput');
    const submitBtn = root.querySelector('#tandaSaSubmit');
    const planEl = root.querySelector('#tandaSaPlan');
    const outEl = root.querySelector('#tandaSaOut');
    const threadEl = root.querySelector('#tandaSaThread');
    const clearChatBtn = root.querySelector('#tandaSaClearChat');

    const conversation = [];
    let lastAdminContextProductIds = [];

    function threadIntroHtml() {
      return `<p class="tanda-sa-thread-intro">
        <strong>Admin mode.</strong> Ask a question, then refine (e.g. “cheapest?” or “same in Lagos?”).
        Ask <strong>shipping</strong> follow-ups (“Can it ship to Enugu?”) after you have result cards — answers use seller shipping zones on file.
        The assistant maps your thread to catalog filters for searches, or to the <em>last results</em> for product/shipping Q&amp;A.
      </p>`;
    }

    if (isAdminMode && threadEl) {
      threadEl.innerHTML = threadIntroHtml();
    }
    if (!isAdminMode) {
      planEl.style.display = '';
      outEl.style.display = '';
    } else {
      planEl.style.display = 'none';
      outEl.style.display = 'none';
    }

    function scrollThread() {
      if (!threadEl) return;
      requestAnimationFrame(() => {
        threadEl.scrollTop = threadEl.scrollHeight;
      });
    }

    function appendUserBubble(text) {
      const row = document.createElement('div');
      row.className = 'tanda-sa-bubble-row tanda-sa-bubble-row--user';
      row.innerHTML = `<div class="tanda-sa-bubble tanda-sa-bubble--user">${escapeHtml(text)}</div>`;
      threadEl.appendChild(row);
      scrollThread();
      return row;
    }

    function appendAdminTurn(reply, plan, products) {
      const row = document.createElement('div');
      row.className = 'tanda-sa-bubble-row tanda-sa-bubble-row--assistant';
      const planBits = formatPlanBits(plan);
      const planHtml = planBits
        ? `<div class="tanda-sa-plan tanda-sa-plan--bubble">${escapeHtml(planBits)}</div>`
        : '';
      const gridHtml = renderProductGridHtml(products);
      row.innerHTML = `<div class="tanda-sa-bubble tanda-sa-bubble--assistant">
        <p class="tanda-sa-reply">${escapeHtml(reply || '')}</p>
        ${planHtml}
        ${gridHtml}
      </div>`;
      threadEl.appendChild(row);
      scrollThread();
    }

    function appendAssistantError(msg) {
      const row = document.createElement('div');
      row.className = 'tanda-sa-bubble-row tanda-sa-bubble-row--assistant';
      row.innerHTML = `<div class="tanda-sa-bubble tanda-sa-bubble--assistant"><p class="tanda-sa-err" style="margin:0;">${escapeHtml(msg)}</p></div>`;
      threadEl.appendChild(row);
      scrollThread();
    }

    if (clearChatBtn) {
      clearChatBtn.addEventListener('click', () => {
        conversation.length = 0;
        lastAdminContextProductIds = [];
        if (threadEl) {
          threadEl.innerHTML = threadIntroHtml();
        }
      });
    }

    function setOpen(open) {
      fab.setAttribute('aria-expanded', open ? 'true' : 'false');
      backdrop.hidden = !open;
      panel.hidden = !open;
      backdrop.classList.toggle('tanda-sa-open', open);
      panel.classList.toggle('tanda-sa-open', open);
      if (open) {
        setTimeout(() => input.focus(), 50);
      }
    }

    fab.addEventListener('click', () => {
      const open = !panel.classList.contains('tanda-sa-open');
      setOpen(open);
    });
    backdrop.addEventListener('click', () => setOpen(false));

    form.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const q = (input.value || '').trim();
      if (q.length < 2) {
        if (isAdminMode) {
          appendAssistantError('Please enter at least 2 characters.');
        } else {
          outEl.innerHTML = '<p class="tanda-sa-err">Please enter at least 2 characters.</p>';
        }
        return;
      }

      if (isAdminMode) {
        if (typeof SuperAffiliateAPI.shoppingAssistantChat !== 'function') {
          appendAssistantError('Admin chat API is not available (update site scripts).');
          return;
        }
        conversation.push({ role: 'user', content: q });
        const userRow = appendUserBubble(q);
        input.value = '';
        submitBtn.disabled = true;
        try {
          const data = await SuperAffiliateAPI.shoppingAssistantChat(conversation, 12, {
            productIds: lastAdminContextProductIds,
          });
          const reply = (data && data.reply) || '';
          conversation.push({ role: 'assistant', content: reply });
          const prods = (data && data.products) || [];
          lastAdminContextProductIds = prods.map((p) => p && p.id).filter(Boolean).slice(0, 8);
          appendAdminTurn(reply, data && data.plan, prods);
        } catch (e) {
          conversation.pop();
          if (userRow && userRow.parentNode) userRow.remove();
          const rd = e && e.responseData;
          let msg = (e && e.message) ? String(e.message) : 'Something went wrong.';
          if (rd && rd.error) {
            msg = String(rd.error);
          } else if (/403|forbidden/i.test(msg)) {
            msg = 'Admin assistant is restricted to Tanda staff/admin accounts.';
          }
          appendAssistantError(msg);
        } finally {
          submitBtn.disabled = false;
        }
        return;
      }

      planEl.innerHTML = '';
      outEl.innerHTML = '<p class="tanda-sa-msg"><i class="fas fa-spinner fa-spin"></i> Searching…</p>';
      submitBtn.disabled = true;
      try {
        const data = await SuperAffiliateAPI.shoppingAssistantSearch(q, 12);
        const plan = data && data.plan;
        if (plan && typeof plan === 'object') {
          const bits = [];
          if (plan.keywords && plan.keywords.length) bits.push('Keywords: ' + plan.keywords.join(', '));
          if (plan.category_hint) bits.push('Category: ' + plan.category_hint);
          if (plan.price_min || plan.price_max) {
            bits.push('Budget: ' + [plan.price_min || '—', plan.price_max || '—'].join(' – '));
          }
          if (plan.sort) bits.push('Sort: ' + plan.sort);
          planEl.innerHTML = bits.length ? `<div class="tanda-sa-plan">${escapeHtml(bits.join(' · '))}</div>` : '';
        }

        const products = (data && data.products) || [];
        if (!products.length) {
          outEl.innerHTML = '<p class="tanda-sa-msg">No matches yet – try broader terms.</p>';
          return;
        }

        outEl.innerHTML = renderProductGridHtml(products);
      } catch (e) {
        const msg = (e && e.message) ? String(e.message) : 'Something went wrong.';
        outEl.innerHTML = `<p class="tanda-sa-err">${escapeHtml(msg)}</p>`;
      } finally {
        submitBtn.disabled = false;
      }
    });

    document.addEventListener('keydown', (ev) => {
      if (ev.key === 'Escape' && panel.classList.contains('tanda-sa-open')) {
        setOpen(false);
      }
    });
  }

  async function autoMount() {
    if (!document.body || document.body.dataset.tandaNoShoppingAssistant === '1') return;
    const label = document.body.dataset.tandaPageLabel || '';
    let isAdmin = false;
    if (typeof SuperAffiliateAPI !== 'undefined' && SuperAffiliateAPI.isAuthenticated()) {
      try {
        const u = await SuperAffiliateAPI.getCurrentUser();
        isAdmin = SuperAffiliateAPI.isTandaWebAdmin(u);
      } catch (_) {
        isAdmin = false;
      }
    }
    mount({ pageLabel: label, isAdmin });
  }

  window.TandaShoppingAssistant = { mount, autoMount };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', autoMount);
  } else {
    autoMount();
  }
})();
