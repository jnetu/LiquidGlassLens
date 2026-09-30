/* LiquidLens playground — all samples use the same shape-aware optical engine. */
document.addEventListener('DOMContentLoaded', () => {
  const $ = selector => document.querySelector(selector);
  const $$ = selector => [...document.querySelectorAll(selector)];
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const optics = new Map();
  let toastTimer;
  function toast(message) {
    const element = $('#copyToast');
    element.textContent = message;
    element.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => element.classList.remove('show'), 2800);
  }
  function selectButton(button, siblings) {
    siblings.forEach(item => {
      const selected = item === button;
      item.classList.toggle('active', selected);
      item.setAttribute('aria-pressed', selected);
    });
  }
  function makeScene(stage, art = 'blue', word = 'FLUID.') {
    const source = document.createElement('div');
    source.className = `optical-scene scene-${art}`;
    source.setAttribute('aria-hidden', 'true');
    source.innerHTML = '<div class="scene-grid"></div><div class="scene-orbit"></div><div class="scene-type"></div><div class="scene-stripe"></div>';
    source.querySelector('.scene-type').textContent = word;
    stage.prepend(source);
    return source;
  }
  function attach(element, scene, options) {
    const lens = new LiquidGlass(element, scene, options);
    optics.set(element, lens);
    return lens;
  }

  // Explicit background layers avoid recursively capturing a lens or duplicating
  // interactive controls. Only the decorative scene is replicated and made inert.
  const sceneConfigs = [
    ['.dock-stage-wrapper', 'blue', 'DESKTOP.'],
    ['.player-stage', 'violet', 'SOUND.'],
    ['.island-demo-stage', 'peach', 'HELLO.'],
    ['.card-tilt-container', 'blue', 'MEMBER.'],
    ['.controls-suite-content', 'peach', 'CONTROL.'],
    ['.anatomy-visual-stage', 'blue', 'REFRACT.']
  ];
  sceneConfigs.forEach(([selector, art, word]) => {
    const stage = $(selector);
    stage.classList.add('optical-stage');
    makeScene(stage, art, word);
  });
  $$('[data-art]').forEach(stage => makeScene(stage, stage.dataset.art, stage.dataset.art === 'map' ? 'GLASS DISTRICT' : 'FLOW.'));
  $$('.optical-stage').forEach(stage => {
    const scene = stage.querySelector(':scope > .optical-scene');
    stage.querySelectorAll('.box, .liquid-dock-shelf, .glass-segmented-shell').forEach(element => {
      if (element.id === 'lensBox' || element.classList.contains('dock-icon-capsule') || element.classList.contains('album-lens-holder')) return;
      attach(element, scene, { strength: element.classList.contains('liquid-dock-shelf') ? 18 : 22 });
    });
  });

  $$('.theme-btn').forEach(button => {
    button.setAttribute('aria-pressed', button.classList.contains('active'));
    button.addEventListener('click', () => {
      document.documentElement.dataset.theme = button.dataset.setTheme;
      selectButton(button, $$('.theme-btn'));
    });
  });

  // Laboratory: shape-specific maps, exact scene alignment, keyboard + pointer input.
  const canvas = $('#lensCanvas');
  const lensElement = $('#activeInteractiveLens');
  const lensBox = $('#lensBox');
  const labScene = canvas.querySelector('.optical-scene');
  const labLens = attach(lensBox, labScene, { strength: 22, blur: .3, dispersion: .018 });
  const names = ['Width', 'Height', 'Radius', 'Tr', 'Strength', 'Blur'];
  const inputs = Object.fromEntries(names.map(name => [name, $(`#slider${name}`)]));
  const presets = {
    circle: [160, 160, 80, 20], pill: [280, 88, 140, 15],
    squircle: [220, 120, 32, 15], card: [320, 190, 26, 12]
  };
  let position = { x: 0, y: 0 };
  let comparison = true;
  function place(x = position.x, y = position.y) {
    const halfWidth = lensBox.offsetWidth / 2, halfHeight = lensBox.offsetHeight / 2;
    position.x = Math.max(halfWidth + 6, Math.min(canvas.clientWidth - halfWidth - 6, x));
    position.y = Math.max(halfHeight + 6, Math.min(canvas.clientHeight - halfHeight - 36, y));
    lensElement.style.left = `${position.x}px`;
    lensElement.style.top = `${position.y}px`;
    LiquidGlass.invalidate();
  }
  function updateLens() {
    const maxWidth = Math.min(380, canvas.clientWidth - 16);
    inputs.Width.max = maxWidth;
    inputs.Width.value = Math.min(+inputs.Width.value, maxWidth);
    ['Width', 'Height', 'Radius', 'Tr'].forEach((name, i) => {
      lensBox.style.setProperty(['--w', '--h', '--r', '--tr'][i], inputs[name].value + (name === 'Tr' ? '%' : 'px'));
    });
    names.forEach(name => $(`#val${name}`).textContent = inputs[name].value + (name === 'Tr' ? '%' : 'px'));
    labLens.set({ strength: +inputs.Strength.value, blur: +inputs.Blur.value, enabled: comparison });
    $('#liveSnippetText').textContent = `/* With the integration example below: */\nObject.assign(lens.style, {\n  width: "${inputs.Width.value}px",\n  height: "${inputs.Height.value}px",\n  borderRadius: "${inputs.Radius.value}px"\n});\nglass.set({ strength: ${inputs.Strength.value}, blur: ${inputs.Blur.value} });`;
    place();
  }
  $$('.shape-btn').forEach(button => {
    button.setAttribute('aria-pressed', button.classList.contains('active'));
    button.addEventListener('click', () => {
      ['Width', 'Height', 'Radius', 'Tr'].forEach((name, i) => inputs[name].value = presets[button.dataset.preset][i]);
      selectButton(button, $$('.shape-btn'));
      updateLens();
    });
  });
  Object.entries(inputs).forEach(([name, input]) => input.addEventListener('input', () => {
    if (['Width', 'Height', 'Radius'].includes(name)) selectButton(null, $$('.shape-btn'));
    updateLens();
  }));
  $('#sceneSelect').addEventListener('change', event => {
    labScene.dataset.scene = event.target.value;
    labLens.refreshScene();
  });
  $('#compareRefraction').addEventListener('click', event => {
    comparison = !comparison;
    event.currentTarget.textContent = comparison ? 'Refraction on' : 'Refraction off';
    event.currentTarget.setAttribute('aria-pressed', comparison);
    event.currentTarget.classList.toggle('active', comparison);
    updateLens();
  });
  let drag = null;
  canvas.addEventListener('pointerdown', event => {
    if (event.button !== 0) return;
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left - canvas.clientLeft;
    const y = event.clientY - rect.top - canvas.clientTop;
    const onLens = lensBox.contains(event.target);
    drag = { id: event.pointerId, x: onLens ? x - position.x : 0, y: onLens ? y - position.y : 0 };
    canvas.setPointerCapture(event.pointerId);
    lensBox.focus({ preventScroll: true });
    place(x - drag.x, y - drag.y);
  });
  canvas.addEventListener('pointermove', event => {
    if (!drag || drag.id !== event.pointerId) return;
    const rect = canvas.getBoundingClientRect();
    place(event.clientX - rect.left - canvas.clientLeft - drag.x, event.clientY - rect.top - canvas.clientTop - drag.y);
  });
  ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(type => canvas.addEventListener(type, () => drag = null));
  lensBox.addEventListener('keydown', event => {
    const directions = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    if (directions[event.key]) {
      event.preventDefault();
      const step = event.shiftKey ? 24 : 6;
      place(position.x + directions[event.key][0] * step, position.y + directions[event.key][1] * step);
    } else if (event.key === 'Home') {
      event.preventDefault(); place(canvas.clientWidth * .34, canvas.clientHeight * .40);
    }
  });
  let motionFrame = 0, motion = false, labVisible = false;
  function animate(time) {
    motionFrame = 0;
    if (!motion || !labVisible || document.hidden) return;
    canvas.style.setProperty('--scene-x', `${Math.sin(time / 1800) * 35}px`);
    canvas.style.setProperty('--scene-y', `${Math.cos(time / 2200) * 18}px`);
    motionFrame = requestAnimationFrame(animate);
  }
  function resumeMotion() { if (motion && labVisible && !motionFrame && !document.hidden && !reducedMotion.matches) motionFrame = requestAnimationFrame(animate); }
  function stopMotion() {
    motion = false; cancelAnimationFrame(motionFrame); motionFrame = 0;
    canvas.style.removeProperty('--scene-x'); canvas.style.removeProperty('--scene-y');
    $('#animateScene').setAttribute('aria-pressed', false); $('#animateScene').classList.remove('active');
    $('#animateScene').textContent = 'Animate scene';
  }
  new IntersectionObserver(entries => { labVisible = entries[0].isIntersecting; resumeMotion(); }).observe(canvas);
  document.addEventListener('visibilitychange', resumeMotion);
  reducedMotion.addEventListener('change', () => { if (reducedMotion.matches) stopMotion(); });
  $('#animateScene').addEventListener('click', event => {
    if (motion) { stopMotion(); return; }
    if (reducedMotion.matches) { toast('Scene animation is disabled by your reduced motion setting.'); return; }
    motion = true; event.currentTarget.setAttribute('aria-pressed', true); event.currentTarget.classList.add('active');
    event.currentTarget.textContent = 'Pause scene'; resumeMotion();
  });
  $('#resetLens').addEventListener('click', () => {
    [220, 120, 32, 15, 22, .3].forEach((value, i) => inputs[names[i]].value = value);
    selectButton($('.shape-btn[data-preset="squircle"]'), $$('.shape-btn'));
    comparison = true; $('#compareRefraction').textContent = 'Refraction on';
    $('#compareRefraction').setAttribute('aria-pressed', true); $('#compareRefraction').classList.add('active');
    $('#sceneSelect').value = 'type'; labScene.dataset.scene = 'type'; labLens.refreshScene();
    stopMotion(); updateLens(); place(canvas.clientWidth * .34, canvas.clientHeight * .40);
  });
  new ResizeObserver(() => updateLens()).observe(canvas);
  updateLens(); place(canvas.clientWidth * .34, canvas.clientHeight * .40);

  // Dock buttons have an actual selection, including keyboard activation.
  const dockStatus = document.createElement('span');
  dockStatus.className = 'demo-status'; dockStatus.setAttribute('role', 'status');
  dockStatus.textContent = 'Finder · ready when you are'; $('.dock-stage-wrapper').append(dockStatus);
  $$('.dock-icon-capsule').forEach((button, i) => {
    button.setAttribute('aria-pressed', i === 0);
    button.addEventListener('click', () => {
      selectButton(button, $$('.dock-icon-capsule'));
      dockStatus.textContent = `${button.querySelector('.dock-tooltip').textContent} · selected`;
    });
  });
  // Non-native controls retained from the original design gain Space / Enter parity.
  $$('[role="button"], [role="switch"]').forEach(element => {
    if (element.tagName === 'BUTTON' || element.tagName === 'A') return;
    element.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); element.click(); }
    });
  });

  // Simulated media: labels, icon, waveform and time all reflect the same state.
  const tracks = [ ['Sub-surface Resonance', 238], ['Prismatic Drift', 204], ['Soft Focus', 267] ];
  let track = 0, elapsed = 102, playing = false, lastTime = performance.now();
  const timeLabel = seconds => `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
  function renderPlayer() {
    const duration = tracks[track][1];
    $('.track-title').textContent = tracks[track][0];
    $('#elapsedTime').textContent = timeLabel(elapsed); $('#durationTime').textContent = timeLabel(duration);
    $('#scrubberFill').style.width = `${elapsed / duration * 100}%`;
    $('#scrubberBead').style.left = `${elapsed / duration * 100}%`;
    $('#scrubberTrack').setAttribute('aria-valuenow', Math.round(elapsed));
    $('#scrubberTrack').setAttribute('aria-valuemax', duration);
    $('#scrubberTrack').setAttribute('aria-valuetext', `${timeLabel(elapsed)} of ${timeLabel(duration)}`);
    $('#btnPlayPause').setAttribute('aria-label', playing ? 'Pause playback demo' : 'Play playback demo');
    $('#btnPlayPause').setAttribute('aria-pressed', playing);
    $('#audioWaveBars').classList.toggle('paused', !playing);
    $('#playIconSvg').innerHTML = playing ? '<path d="M6 4h4v16H6zM14 4h4v16h-4z"/>' : '<polygon points="5 3 19 12 5 21 5 3"/>';
  }
  $('#btnPlayPause').addEventListener('click', () => { playing = !playing; lastTime = performance.now(); renderPlayer(); });
  function changeTrack(delta) { track = (track + delta + tracks.length) % tracks.length; elapsed = 0; renderPlayer(); }
  $('[aria-label="Previous Track"]').addEventListener('click', () => changeTrack(-1));
  $('[aria-label="Next Track"]').addEventListener('click', () => changeTrack(1));
  setInterval(() => {
    const now = performance.now();
    if (playing && !document.hidden) {
      elapsed = Math.min(tracks[track][1], elapsed + (now - lastTime) / 1000);
      if (elapsed >= tracks[track][1]) changeTrack(1);
      renderPlayer();
    }
    lastTime = now;
  }, 500);
  const scrubber = $('#scrubberTrack'); let scrubbing = false;
  function seek(event) { const rect = scrubber.getBoundingClientRect(); elapsed = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)) * tracks[track][1]; renderPlayer(); }
  scrubber.addEventListener('pointerdown', event => { scrubbing = true; scrubber.setPointerCapture(event.pointerId); seek(event); });
  scrubber.addEventListener('pointermove', event => { if (scrubbing) seek(event); });
  ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(type => scrubber.addEventListener(type, () => scrubbing = false));
  scrubber.addEventListener('keydown', event => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    elapsed = event.key === 'Home' ? 0 : event.key === 'End' ? tracks[track][1] : Math.max(0, Math.min(tracks[track][1], elapsed + (event.key === 'ArrowRight' ? 5 : -5)));
    renderPlayer();
  });
  renderPlayer();

  $$('.island-trigger-btn').forEach(button => {
    button.setAttribute('aria-pressed', button.classList.contains('active'));
    button.addEventListener('click', () => {
      selectButton(button, $$('.island-trigger-btn'));
      $$('.capsule-content-state').forEach(state => state.classList.toggle('active', state.id === button.dataset.state));
      const size = { stateBio: [300, 64], stateAudio: [330, 70], stateCall: [315, 74] }[button.dataset.state];
      $('#morphingCapsule').style.setProperty('--w', `${size[0]}px`);
      $('#morphingCapsule').style.setProperty('--h', `${size[1]}px`);
      LiquidGlass.invalidate(500);
    });
  });
  $('#cardTiltStage').addEventListener('pointermove', event => {
    if (reducedMotion.matches || event.pointerType === 'touch') return;
    const rect = event.currentTarget.getBoundingClientRect();
    $('#tiltGlassCard').style.transform = `translate(${((event.clientX - rect.left) / rect.width - .5) * 24}px, ${((event.clientY - rect.top) / rect.height - .5) * 20}px)`;
    LiquidGlass.invalidate(250);
  });
  $('#cardTiltStage').addEventListener('pointerleave', () => { $('#tiltGlassCard').style.transform = ''; LiquidGlass.invalidate(250); });
  const controlLenses = [...optics].filter(([element]) => element.closest('.controls-suite-content')).map(([, lens]) => lens);
  let dispersion = true;
  function updateDispersion() { controlLenses.forEach(lens => lens.set({ dispersion: dispersion ? .055 : 0 })); }
  $('#tactileGlassSwitch').addEventListener('click', event => {
    dispersion = !dispersion; event.currentTarget.classList.toggle('active', dispersion);
    event.currentTarget.setAttribute('aria-checked', dispersion); updateDispersion();
  });
  updateDispersion();
  $$('.segmented-pill-item').forEach((button, index) => {
    button.setAttribute('aria-pressed', index === 0);
    button.addEventListener('click', () => {
      selectButton(button, $$('.segmented-pill-item'));
      const [strength, blur] = [[22, .25], [10, 2], [32, .1], [40, .4]][index];
      controlLenses.forEach(lens => lens.set({ strength, blur }));
    });
  });
  function findExperiment() {
    const query = $('.glass-search-field').value.trim().toLowerCase();
    if (!query) { toast('Try “map”, “weather”, “dock”, or “toolbar”.'); return; }
    const result = $$('.bento-item').find(item => item.querySelector('.bento-header').textContent.toLowerCase().includes(query));
    if (!result) { toast(`No experiment found for “${query}”.`); return; }
    setCategory('all'); result.scrollIntoView({ behavior: reducedMotion.matches ? 'auto' : 'smooth', block: 'center' });
    result.setAttribute('tabindex', '-1'); result.focus({ preventScroll: true });
    toast(`Found: ${result.querySelector('h3').textContent}`);
  }
  $('.glass-search-btn-icon').addEventListener('click', findExperiment);
  $('.glass-search-field').addEventListener('keydown', event => { if (event.key === 'Enter') findExperiment(); });
  function setCategory(category) {
    selectButton($(`.gallery-filter [data-category="${category}"]`), $$('.gallery-filter button'));
    $$('.bento-item').forEach(item => item.hidden = category !== 'all' && item.dataset.category !== category);
    LiquidGlass.invalidate();
  }
  $$('.gallery-filter button').forEach(button => button.addEventListener('click', () => setCategory(button.dataset.category)));

  $$('.tool-btn').forEach(button => button.addEventListener('click', () => {
    selectButton(button, $$('.tool-btn')); $('#toolStatus').textContent = `${button.dataset.tool} tool · ready to create`;
  }));
  $('#dismissNotification').addEventListener('click', () => { $('#demoNotification').hidden = true; $('#restoreNotification').focus({ preventScroll: true }); });
  $('#restoreNotification').addEventListener('click', () => { $('#demoNotification').hidden = false; LiquidGlass.invalidate(); });
  let weather = 0;
  $('#changeWeather').addEventListener('click', () => {
    const forecasts = [['sunny', '29°', '☀ Clear skies'], ['rain', '24°', '☂ Passing showers'], ['night', '26°', '☾ After hours']];
    weather = (weather + 1) % forecasts.length;
    const [art, temp, summary] = forecasts[weather];
    const scene = $('.weather-stage > .optical-scene');
    scene.className = `optical-scene scene-${art}`;
    optics.get($('.weather-widget')).refreshScene();
    $('#weatherTemp').textContent = temp; $('#weatherSummary').textContent = summary;
  });
  let placeIndex = 0;
  function nextPlace() {
    const places = [[0, 0, '↗ The studio'], [-60, -32, '⌁ The riverside'], [55, 35, '✦ The gallery']];
    placeIndex = (placeIndex + 1) % places.length;
    const [x, y, label] = places[placeIndex];
    $('#mapMarker').style.transform = `translate(${x}px, ${y}px)`; $('#mapLabel').textContent = label;
    LiquidGlass.invalidate(650);
  }
  $('#mapMarker').addEventListener('click', nextPlace); $('#nextPlace').addEventListener('click', nextPlace);
  const dialog = $('#glassDialog');
  $('#openGlassDialog').addEventListener('click', () => { dialog.showModal(); LiquidGlass.invalidate(); });
  $('#closeGlassDialog').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });

  // Anatomy: refraction is a real on/off comparison, separate from the finish.
  const anatomy = $('#anatomyTargetBox');
  $$('.layer-toggle-card').forEach(button => button.addEventListener('click', () => {
    const disabled = button.classList.toggle('disabled');
    button.setAttribute('aria-pressed', !disabled);
    button.querySelector('.layer-checkbox-mock').textContent = disabled ? '−' : '✓';
    if (button.dataset.layerTarget === 'refraction') optics.get(anatomy).set({ enabled: !disabled });
    else if (button.dataset.layerTarget === 'rim') $('#anatomyCircleOverlay').classList.toggle('no-rim', disabled);
    else anatomy.classList.toggle({ insets: 'no-insets', coreShadow: 'no-before', specular: 'no-after' }[button.dataset.layerTarget], disabled);
  }));

  // Copyable integration uses the same engine as the demos, with explicit scope.
  const markup = `<div class="optical-stage">\n  <!-- Decorative scene only: no controls or live inputs. -->\n  <div class="optical-scene" aria-hidden="true">\n    <h1>MAKE IT FLOW.</h1>\n  </div>\n  <button class="glass" id="myLens">A new perspective</button>\n</div>\n<script src="optics.js"><\/script>\n<!-- Add the CSS and JavaScript from the next two tabs. -->`;
  const css = `.optical-filter-defs { position: absolute; width: 0; height: 0; }\n.optical-stage { position: relative; overflow: hidden; height: 360px;\n  border-radius: 24px; isolation: isolate; }\n.optical-scene { position: absolute; inset: 0; overflow: hidden;\n  background: repeating-linear-gradient(90deg, #b8d3e6 0 30px, #8db9d3 30px 32px); }\n.optical-scene h1 { font: 800 80px/1 system-ui; color: #173650; }\n.glass { position: absolute; left: 60px; top: 90px; width: 260px;\n  height: 100px; border-radius: 32px; isolation: isolate;\n  background: #ffffff16; border: 1px solid #fff9; color: #173650;\n  box-shadow: inset 0 1px 1px white, 0 8px 24px #17365030; }\n.glass-optics { position: absolute; inset: 0; z-index: -1;\n  overflow: hidden; border-radius: inherit; pointer-events: none; }\n.glass-sampler { position: absolute; inset: 0; overflow: visible; }\n.glass-scene-copy { position: absolute; top: 0; left: 0;\n  right: auto; bottom: auto; max-width: none; transform-origin: 0 0; }`;
  const javascript = `// Load optics.js first. One map per lens, generated to fit its shape.\nconst lens = document.querySelector('#myLens');\nconst scene = document.querySelector('.optical-scene');\nconst glass = new LiquidGlass(lens, scene, {\n  strength: 22,    // Displacement in CSS pixels; 0 = unchanged scene\n  blur: 0.3,       // Frosting, independent of refraction\n  dispersion: 0.02 // Color separation at the curved edge\n});\n\n// After moving a lens (or while it transitions):\nLiquidGlass.invalidate(400);\n\n// After changing the decorative scene's markup:\nglass.refreshScene();\n\n// Before removing a lens: glass.destroy();\n// The engine samples this explicit scene, not arbitrary page content.\n// Keep controls outside the scene; use translate for lens movement.`;
  const panels = { html: $('#panelHtml'), css: $('#panelCss'), js: $('#panelJs') };
  Object.entries({ html: markup, css, js: javascript }).forEach(([key, code]) => panels[key].querySelector('code').textContent = code);
  let tab = 'html';
  $$('.code-tab-btn').forEach(button => {
    button.setAttribute('aria-pressed', button.classList.contains('active'));
    button.addEventListener('click', () => {
      tab = button.dataset.tab; selectButton(button, $$('.code-tab-btn'));
      Object.entries(panels).forEach(([key, panel]) => panel.hidden = key !== tab);
    });
  });
  async function copy(text, success) {
    try { await navigator.clipboard.writeText(text); toast(success); }
    catch { toast('Clipboard unavailable. Select the snippet and copy it manually.'); }
  }
  $('#btnCopyMainCode').addEventListener('click', () => copy(panels[tab].textContent.trim(), 'Code copied.'));
  $('#btnCopyLiveCss').addEventListener('click', () => copy($('#liveSnippetText').textContent, 'Lens settings copied.'));
  const download = document.createElement('a');
  download.className = 'utility-btn'; download.href = 'optics.js'; download.download = 'optics.js'; download.textContent = 'Download optics.js ↓';
  $('.code-tabs-header').append(download);
});
