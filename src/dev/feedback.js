// Dev-only feedback overlay. main.js loads this file only in dev mode, so players never get it.
// Open with ` (backtick) or the Feedback button. server.js saves items into feedback/, where the
// agent reads them (npm run feedback). Workflow: docs/FEEDBACK.md
(() => {
  const API = '/api/feedback';
  const SHOT_WIDTH = 960;
  const SHOT_HEIGHT = 540;
  const POLL_MS = 20000;
  const AREAS = ['General', 'Movement', 'Tutorial', 'Minimap', 'Inventory', 'Dialog & NPCs', 'Maps & buildings', 'Art & style', 'UI', 'Performance'];
  const TYPES = [['bug', 'Bug'], ['change', 'Change'], ['idea', 'Idea']];
  const PRIORITIES = [['low', 'Low'], ['normal', 'Normal'], ['high', 'High']];
  const STATUS_LABELS = {
    new: 'New',
    'needs-info': 'Question for you',
    answered: 'Answered',
    planned: 'Planned',
    'in-progress': 'In progress',
    fixed: 'Fixed - please check',
    verified: 'Verified',
    reopened: 'Reopened',
    'wont-fix': "Won't fix",
  };
  const WAITING_ON_OWNER = ['needs-info', 'fixed'];

  const state = { open: false, tab: 'new', items: [], capture: null, marker: null, shot: null, shotReady: Promise.resolve(), busy: false, build: null };

  function el(tag, props = {}, children = []) {
    const node = document.createElement(tag);
    for (const [key, value] of Object.entries(props)) {
      if (value === false || value == null) continue;
      if (key === 'class') node.className = value;
      else if (key === 'text') node.textContent = value;
      else if (key.startsWith('on')) node.addEventListener(key.slice(2), value);
      else node.setAttribute(key, value === true ? '' : value);
    }
    node.append(...[].concat(children).filter((child) => child != null && child !== false && child !== ''));
    return node;
  }

  // ---------- build the DOM ----------

  const badge = el('span', { class: 'dfb-badge', hidden: true });
  const launcher = el('button', { id: 'dev-feedback-button', class: 'dfb-launcher', type: 'button', title: 'Give feedback (O)', onclick: () => openPanel() }, [
    'Feedback',
    el('kbd', { text: 'O' }),
    badge,
  ]);

  const preview = el('canvas', { id: 'dfb-preview', class: 'dfb-preview', width: SHOT_WIDTH, height: SHOT_HEIGHT, title: 'Click to point at something' });
  const markerInfo = el('p', { id: 'dfb-marker-info', class: 'dfb-hint' });
  const contextInfo = el('p', { class: 'dfb-hint' });
  const typeGroup = el('fieldset', { class: 'dfb-segmented' }, [
    el('legend', { text: 'Type' }),
    ...TYPES.map(([value, label], i) =>
      el('label', {}, [el('input', { type: 'radio', name: 'dfb-type', value, checked: i === 0 }), el('span', { text: label })]),
    ),
  ]);
  const areaSelect = el('select', { id: 'dfb-area' }, AREAS.map((area) => el('option', { value: area, text: area })));
  const prioritySelect = el('select', { id: 'dfb-priority' }, PRIORITIES.map(([value, label]) => el('option', { value, text: label, selected: value === 'normal' })));
  const titleInput = el('input', { id: 'dfb-title', type: 'text', maxlength: 120, autocomplete: 'off', placeholder: 'e.g. The door is hard to walk into' });
  const detailsInput = el('textarea', { id: 'dfb-details', rows: 5, maxlength: 5000, placeholder: 'What happened, what you expected, or what you would like instead.' });
  const formStatus = el('p', { class: 'dfb-status', role: 'status' });
  const sendMore = el('button', { type: 'button', class: 'dfb-secondary', onclick: () => submit(false) }, 'Send & add another');
  const sendClose = el('button', { type: 'button', class: 'dfb-primary', onclick: () => submit(true) }, 'Send & close');

  const field = (label, control) => el('div', { class: 'dfb-field' }, [el('label', { for: control.id, text: label }), control]);

  const formView = el('section', { class: 'dfb-view' }, [
    el('div', { class: 'dfb-shot' }, [preview, el('button', { type: 'button', class: 'dfb-link-button', onclick: () => clearMarker() }, 'Clear point')]),
    markerInfo,
    contextInfo,
    typeGroup,
    el('div', { class: 'dfb-row' }, [field('Area', areaSelect), field('Priority', prioritySelect)]),
    field('Title', titleInput),
    field('Details', detailsInput),
    el('div', { class: 'dfb-actions' }, [sendMore, sendClose]),
    formStatus,
    el('p', { class: 'dfb-hint', text: 'Ctrl+Enter sends. Esc closes. The game is paused while this is open.' }),
  ]);

  const inboxList = el('div', { class: 'dfb-inbox' });
  const inboxView = el('section', { class: 'dfb-view', hidden: true }, [inboxList]);
  const tabNew = el('button', { type: 'button', role: 'tab', class: 'dfb-tab', onclick: () => showTab('new') }, 'New feedback');
  const tabInbox = el('button', { type: 'button', role: 'tab', class: 'dfb-tab', onclick: () => showTab('inbox') }, 'Inbox');

  const panel = el('aside', { id: 'dev-feedback', class: 'dfb-panel', hidden: true, 'aria-label': 'Developer feedback' }, [
    el('header', { class: 'dfb-header' }, [
      el('h2', { text: 'Feedback' }),
      el('span', { class: 'dfb-pill', text: 'DEV' }),
      el('button', { type: 'button', class: 'dfb-close', 'aria-label': 'Close feedback', onclick: () => closePanel() }, '×'),
    ]),
    el('nav', { class: 'dfb-tabs', role: 'tablist' }, [tabNew, tabInbox]),
    formView,
    inboxView,
  ]);

  document.body.append(launcher, panel);

  // ---------- open / close, pausing the game ----------

  const gameScenes = () => ['world', 'ui'].map((key) => window.game?.scene.getScene(key)).filter(Boolean);

  function openPanel() {
    const world = window.game?.scene.getScene('world');
    if (state.open || !world?.player) return;
    state.open = true;
    for (const scene of gameScenes()) {
      scene.input.keyboard.resetKeys(); // otherwise a held arrow key stays "down" until we come back
      scene.scene.pause();
    }
    game.input.keyboard.enabled = false;

    captureMoment();
    launcher.hidden = true;
    panel.hidden = false;
    setStatus('');
    showTab('new');
    titleInput.focus();
    refreshInbox();
  }

  function closePanel() {
    if (!state.open) return;
    state.open = false;
    panel.hidden = true;
    launcher.hidden = false;
    if (panel.contains(document.activeElement)) document.activeElement.blur();
    game.input.keyboard.enabled = true;
    for (const scene of gameScenes()) {
      scene.input.keyboard.resetKeys();
      scene.scene.resume();
    }
  }

  function showTab(tab) {
    state.tab = tab;
    formView.hidden = tab !== 'new';
    inboxView.hidden = tab !== 'inbox';
    tabNew.setAttribute('aria-selected', String(tab === 'new'));
    tabInbox.setAttribute('aria-selected', String(tab === 'inbox'));
    if (tab === 'inbox') renderInbox();
  }

  // O (or `, which isn't on every keyboard layout) opens and closes the panel; Esc closes it.
  // Keys go to the panel, never to the game, while it's open.
  const isToggleKey = (event) =>
    (event.code === 'KeyO' || event.code === 'Backquote' || event.key === '`') && !event.ctrlKey && !event.metaKey && !event.altKey;

  window.addEventListener(
    'keydown',
    (event) => {
      const typing = event.target instanceof Element && event.target.matches('input, textarea, select');
      if (!state.open) {
        if (isToggleKey(event) && !typing) {
          event.preventDefault();
          event.stopImmediatePropagation();
          openPanel();
        }
        return;
      }
      event.stopImmediatePropagation();
      if (event.key === 'Escape' || (isToggleKey(event) && !typing)) {
        event.preventDefault();
        closePanel();
      } else if (event.key === 'Enter' && (event.ctrlKey || event.metaKey) && state.tab === 'new') {
        event.preventDefault();
        submit(false);
      }
    },
    true,
  );

  // ---------- capture: game state + screenshot ----------

  function captureMoment() {
    const world = game.scene.getScene('world');
    const ui = game.scene.getScene('ui');
    const { player } = world;
    const view = world.cameras.main.worldView;
    const tile = { x: Math.floor(player.x / TILE), y: Math.floor(player.y / TILE) };

    state.capture = {
      view: { x: view.x, y: view.y, width: view.width, height: view.height },
      context: {
        map: world.mapKey,
        mapName: world.def.name,
        tile,
        pixel: { x: Math.round(player.x), y: Math.round(player.y) },
        facing: world.facing,
        inventory: GameState.inventory.slots.map((slot) => slot && { ...slot }),
        selectedSlot: GameState.inventory.selected,
        flags: { ...GameState.flags },
        collected: [...GameState.collected],
        tutorial: { stage: ui.tutorial.stage, completed: [...ui.tutorial.completed] },
        dialogOpen: ui.dialog.isOpen,
        build: state.build,
        url: location.href,
        window: { width: innerWidth, height: innerHeight },
        userAgent: navigator.userAgent,
        capturedAt: new Date().toISOString(),
      },
    };
    contextInfo.textContent = `${world.def.name} · tile ${tile.x},${tile.y} · build ${state.build || 'unknown'}`;

    state.marker = null;
    state.shot = null;
    updateMarkerInfo();
    drawPreview();
    state.shotReady = new Promise((resolve) => {
      const giveUp = setTimeout(resolve, 2000);
      try {
        game.renderer.snapshot((image) => {
          clearTimeout(giveUp);
          state.shot = image;
          drawPreview();
          resolve();
        }, 'image/png');
      } catch (err) {
        clearTimeout(giveUp);
        console.warn('Feedback screenshot failed', err);
        resolve();
      }
    });
  }

  function drawPreview() {
    const ctx = preview.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#0b0c12';
    ctx.fillRect(0, 0, SHOT_WIDTH, SHOT_HEIGHT);
    if (state.shot) ctx.drawImage(state.shot, 0, 0, SHOT_WIDTH, SHOT_HEIGHT);
    if (!state.marker) return;
    const { x, y } = state.marker.screen;
    for (const [width, color] of [[10, '#ffffff'], [5, '#ff3b3b']]) {
      ctx.lineWidth = width;
      ctx.strokeStyle = color;
      ctx.beginPath();
      ctx.arc(x, y, 28, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  preview.addEventListener('click', (event) => {
    if (!state.capture) return;
    const rect = preview.getBoundingClientRect();
    const sx = ((event.clientX - rect.left) / rect.width) * SHOT_WIDTH;
    const sy = ((event.clientY - rect.top) / rect.height) * SHOT_HEIGHT;
    const { view } = state.capture;
    const wx = view.x + (sx / SHOT_WIDTH) * view.width;
    const wy = view.y + (sy / SHOT_HEIGHT) * view.height;
    state.marker = {
      screen: { x: Math.round(sx), y: Math.round(sy) },
      world: { x: Math.round(wx), y: Math.round(wy) },
      tile: { x: Math.floor(wx / TILE), y: Math.floor(wy / TILE) },
    };
    drawPreview();
    updateMarkerInfo();
  });

  function clearMarker() {
    state.marker = null;
    drawPreview();
    updateMarkerInfo();
  }

  function updateMarkerInfo() {
    markerInfo.textContent = state.marker
      ? `Pointing at tile ${state.marker.tile.x},${state.marker.tile.y}.`
      : 'Click the picture to point at something.';
  }

  // ---------- send new feedback ----------

  async function submit(closeAfter) {
    if (state.busy) return;
    const title = titleInput.value.trim();
    if (!title) {
      setStatus('Add a short title first.', 'error');
      titleInput.focus();
      return;
    }

    state.busy = true;
    sendMore.disabled = sendClose.disabled = true;
    setStatus('Saving...');
    await state.shotReady;
    try {
      const item = await api('POST', API, {
        title,
        details: detailsInput.value.trim(),
        type: formView.querySelector('input[name="dfb-type"]:checked')?.value || 'bug',
        area: areaSelect.value,
        priority: prioritySelect.value,
        context: state.capture.context,
        marker: state.marker,
        screenshot: state.shot ? preview.toDataURL('image/jpeg', 0.85) : null,
      });
      titleInput.value = '';
      detailsInput.value = '';
      clearMarker();
      setStatus(`Saved as ${item.id}. Thank you!`, 'ok');
      refreshInbox();
      if (closeAfter) closePanel();
      else titleInput.focus();
    } catch (err) {
      setStatus(`Not saved: ${err.message}`, 'error');
    } finally {
      state.busy = false;
      sendMore.disabled = sendClose.disabled = false;
    }
  }

  function setStatus(message, kind = '') {
    formStatus.textContent = message;
    formStatus.className = `dfb-status${kind ? ` dfb-${kind}` : ''}`;
  }

  async function api(method, url, body) {
    let response;
    try {
      response = await fetch(url, {
        method,
        headers: body ? { 'Content-Type': 'application/json' } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
    } catch {
      throw new Error('the dev server is not reachable (is `npm start` running?)');
    }
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || `server replied ${response.status}`);
    return data;
  }

  // ---------- inbox: questions from the agent, fixes to check ----------

  async function refreshInbox() {
    try {
      state.items = await api('GET', API);
    } catch (err) {
      if (state.tab === 'inbox') inboxList.replaceChildren(el('p', { class: 'dfb-status dfb-error', text: err.message }));
      return;
    }
    const waiting = state.items.filter((item) => WAITING_ON_OWNER.includes(item.status)).length;
    badge.hidden = waiting === 0;
    badge.textContent = String(waiting);
    tabInbox.textContent = waiting ? `Inbox (${waiting})` : 'Inbox';
    renderInbox();
  }

  function renderInbox() {
    // Don't wipe an answer the owner is halfway through writing.
    if ([...inboxList.querySelectorAll('textarea')].some((input) => input.value.trim())) return;
    const rank = (item) => (WAITING_ON_OWNER.includes(item.status) ? 0 : 1);
    const items = [...state.items].sort((a, b) => rank(a) - rank(b) || b.id.localeCompare(a.id));
    inboxList.replaceChildren(
      ...(items.length
        ? items.map(renderItem)
        : [el('p', { class: 'dfb-hint', text: 'Nothing yet. Feedback you send shows up here, along with any questions from Claude.' })]),
    );
  }

  function renderItem(item) {
    const waiting = WAITING_ON_OWNER.includes(item.status);
    const children = [
      el('header', {}, [
        el('span', { class: 'dfb-id', text: item.id }),
        el('span', { class: `dfb-chip dfb-chip-${item.status}`, text: STATUS_LABELS[item.status] || item.status }),
      ]),
      el('h3', { text: item.title }),
      el('p', { class: 'dfb-meta', text: `${item.type} · ${item.area} · ${item.priority} priority · ${new Date(item.createdAt).toLocaleString()}` }),
      item.details && el('p', { class: 'dfb-details', text: item.details }),
      item.screenshot && el('a', { class: 'dfb-link', href: `${API}/${item.id}/screenshot`, target: '_blank', rel: 'noopener', text: 'Open screenshot' }),
      ...item.thread.map((message) =>
        el('div', { class: `dfb-message dfb-from-${message.author}` }, [
          el('strong', { text: message.author === 'agent' ? 'Claude' : 'You' }),
          el('p', { text: message.text }),
        ]),
      ),
      item.resolution &&
        el('p', {
          class: 'dfb-resolution',
          text: `Fixed${item.resolution.commit ? ` in ${item.resolution.commit}` : ''}. Covered by test: ${item.resolution.test}`,
        }),
    ];

    if (item.status === 'needs-info') {
      children.push(replyBox('Your answer', 'Send answer', (text) => act(item.id, 'reply', text)));
    }
    if (item.status === 'fixed') {
      children.push(el('div', { class: 'dfb-actions' }, [el('button', { type: 'button', class: 'dfb-primary', onclick: () => act(item.id, 'verify') }, 'It works')]));
      children.push(replyBox("What's still wrong?", 'Still not right', (text) => act(item.id, 'reopen', text)));
    }
    return el('article', { class: `dfb-item${waiting ? ' dfb-waiting' : ''}`, 'data-id': item.id }, children);
  }

  function replyBox(label, buttonText, onSend) {
    const input = el('textarea', { rows: 3, maxlength: 5000, 'aria-label': label, placeholder: label });
    const send = el('button', { type: 'button', class: 'dfb-secondary' }, buttonText);
    send.addEventListener('click', async () => {
      const text = input.value.trim();
      if (!text) return input.focus();
      send.disabled = true;
      input.value = '';
      await onSend(text);
      send.disabled = false;
    });
    return el('div', { class: 'dfb-reply' }, [input, send]);
  }

  async function act(id, action, text) {
    try {
      await api('POST', `${API}/${id}/${action}`, { text });
    } catch (err) {
      inboxList.prepend(el('p', { class: 'dfb-status dfb-error', text: `${id}: ${err.message}` }));
      return;
    }
    await refreshInbox();
  }

  // ---------- start ----------

  api('GET', '/api/dev').then((info) => (state.build = info.commit)).catch(() => {});
  refreshInbox();
  setInterval(() => {
    if (!document.hidden) refreshInbox();
  }, POLL_MS);

  window.devFeedback = { open: openPanel, close: closePanel, refresh: refreshInbox };
})();
