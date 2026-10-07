/* Rounded glass for an explicit decorative scene. Foreground controls stay sharp.
 * A padded, blurred source is displaced BEFORE the final rounded clip. This is
 * a web approximation of a lens, not a capture of arbitrary DOM or native glass.
 */
(() => {
  const NS = 'http://www.w3.org/2000/svg';
  const svg = (tag, attributes = {}) => {
    const node = document.createElementNS(NS, tag);
    Object.entries(attributes).forEach(([key, value]) => node.setAttribute(key, value));
    return node;
  };
  const write = (node, key, value) => {
    if (node.getAttribute(key) !== String(value)) node.setAttribute(key, value);
  };
  const style = (node, key, value) => {
    if (node.style[key] !== value) node.style[key] = value;
  };
  const definitions = svg('svg', { class: 'optical-filter-defs', 'aria-hidden': 'true' });
  const defs = svg('defs');
  definitions.append(defs); document.body.append(definitions);
  const instances = new Set(), dirty = new Set(), targets = new WeakMap();
  const opaque = matchMedia('(prefers-reduced-transparency: reduce), (prefers-contrast: more)');
  const cache = new Map();
  const scratch = document.createElement('canvas');
  // Maps are read back as PNGs repeatedly; keep this tiny canvas CPU-backed.
  const context = scratch.getContext('2d', { willReadFrequently: true });
  const typography = ['fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'lineHeight', 'letterSpacing', 'textAlign', 'textTransform', 'whiteSpace', 'color', 'direction'];
  let cacheBytes = 0, nextId = 0, frame = 0;

  // Signed distance supplies the actual normal of straight edges and corners.
  // A narrow optical bead decays smoothly into a nearly flat center. Unlike a
  // sinusoidal ridge, it doesn't produce a second, broad ring of warped letters.
  function surfaceMap(width, height, radius) {
    const key = `${width}:${height}:${radius}`;
    if (cache.has(key)) {
      const url = cache.get(key); cache.delete(key); cache.set(key, url); return url;
    }
    const ratio = Math.min(1, 320 / Math.max(width, height), Math.sqrt(49152 / (width * height)));
    scratch.width = Math.max(2, Math.round(width * ratio));
    scratch.height = Math.max(2, Math.round(height * ratio));
    const pixels = context.createImageData(scratch.width, scratch.height);
    const bevel = Math.min(16, Math.min(width, height) * .18);
    for (let y = 0; y < scratch.height; y++) {
      for (let x = 0; x < scratch.width; x++) {
        const px = (x + .5) / scratch.width * width - width / 2;
        const py = (y + .5) / scratch.height * height - height / 2;
        const qx = Math.abs(px) - (width / 2 - radius);
        const qy = Math.abs(py) - (height / 2 - radius);
        const ox = Math.max(qx, 0), oy = Math.max(qy, 0);
        const length = Math.hypot(ox, oy);
        const distance = Math.max(0, -(length + Math.min(Math.max(qx, qy), 0) - radius));
        let nx = 0, ny = 0;
        if (length > 0) { nx = ox / length; ny = oy / length; }
        else if (qx > qy) nx = 1;
        else ny = 1;
        nx *= Math.sign(px); ny *= Math.sign(py);
        const rim = (1 - Math.exp(-distance / 1.3)) * Math.exp(-distance / (bevel * .32));
        const center = Math.min(1, distance / bevel);
        const dx = -nx * rim * 1.05 - px / width * .055 * center;
        const dy = -ny * rim * 1.05 - py / height * .055 * center;
        const i = (y * scratch.width + x) * 4;
        pixels.data[i] = Math.round(127.5 + dx * 127.5);
        pixels.data[i + 1] = Math.round(127.5 + dy * 127.5);
        pixels.data[i + 2] = 128; pixels.data[i + 3] = 255;
      }
    }
    context.putImageData(pixels, 0, 0);
    const url = scratch.toDataURL();
    // Bound both entry count and encoded string memory, including resize sweeps.
    while (cache.size && (cache.size >= 48 || cacheBytes + url.length * 2 > 6 * 1024 * 1024)) {
      const oldest = cache.keys().next().value;
      cacheBytes -= cache.get(oldest).length * 2; cache.delete(oldest);
    }
    cache.set(key, url); cacheBytes += url.length * 2; return url;
  }

  function schedule() {
    if (!frame && !document.hidden && [...dirty].some(lens => lens.visible)) frame = requestAnimationFrame(tick);
  }
  function tick(time) {
    frame = 0;
    const sources = new Map(), updates = [];
    // All layout reads precede writes. Multiple lenses share one scene read.
    for (const lens of dirty) {
      if (!lens.visible) continue;
      dirty.delete(lens);
      const measurement = lens.measure(sources);
      if (measurement) updates.push([lens, measurement]);
    }
    for (const [lens, measurement] of updates) {
      lens.commit(measurement, time);
      if (time < lens.until || lens.mapPending) dirty.add(lens);
    }
    schedule();
  }
  const resize = new ResizeObserver(entries => {
    for (const entry of entries) for (const lens of targets.get(entry.target) || []) lens.invalidate();
  });
  const intersection = new IntersectionObserver(entries => {
    for (const entry of entries) for (const lens of targets.get(entry.target) || []) {
      if (lens.element !== entry.target) continue;
      lens.visible = entry.isIntersecting; lens.clip.hidden = !lens.visible;
      if (lens.visible) lens.invalidate();
      else style(lens.sampler, 'filter', 'none');
    }
  }, { rootMargin: '80px' });
  function observe(target, lens) {
    if (!targets.has(target)) { targets.set(target, new Set()); resize.observe(target); }
    targets.get(target).add(lens);
  }
  function unobserve(target, lens) {
    const group = targets.get(target); group?.delete(lens);
    if (group && !group.size) { resize.unobserve(target); targets.delete(target); }
  }

  class LiquidGlass {
    constructor(element, scene, options = {}) {
      this.element = element; this.scene = scene;
      this.options = { strength: 16, blur: 3.2, dispersion: 0, material: 'regular', enabled: true };
      this.visible = false; this.until = 0; this.id = `glass-optics-${++nextId}`;
      this.clip = document.createElement('div'); this.clip.className = 'glass-optics';
      this.clip.setAttribute('aria-hidden', 'true'); this.clip.inert = true; this.clip.hidden = true;
      this.sampler = document.createElement('div'); this.sampler.className = 'glass-sampler';
      this.clip.append(this.sampler); element.prepend(this.clip); element.classList.add('has-optics');
      this.sceneDirty = true; this.filterDirty = true;
      instances.add(this); observe(element, this); observe(scene, this); intersection.observe(element);
      this.set(options);
    }

    refreshScene() { this.sceneDirty = true; this.invalidate(); }

    set(options = {}) {
      const next = { ...this.options, ...options };
      for (const key of ['strength', 'blur', 'dispersion']) {
        next[key] = Math.max(0, Math.min(key === 'dispersion' ? .15 : key === 'blur' ? 20 : 80, Number(next[key]) || 0));
      }
      next.material = next.material === 'clear' ? 'clear' : 'regular';
      if (Object.keys(next).some(key => next[key] !== this.options[key])) this.filterDirty = true;
      this.options = next;
      this.element.dataset.glassMaterial = next.material;
      this.element.dataset.glassEnabled = String(Boolean(next.enabled)); this.invalidate();
    }

    invalidate(duration = 0, translation = null) {
      // A drag coalesced inside rAF must move its sampled scene in the same
      // paint, rather than wait one more frame for the next geometry read.
      if (translation && this.offset && this.copy) {
        this.offset.x -= translation.x; this.offset.y -= translation.y;
        style(this.copy, 'transform', `translate(${this.offset.x}px, ${this.offset.y}px)`);
      }
      this.until = Math.max(this.until, performance.now() + duration); dirty.add(this); schedule();
    }

    measure(sources) {
      // Fractional CSS sizes avoid the integer rounding seam of offsetWidth.
      const computed = getComputedStyle(this.element);
      const borderX = parseFloat(computed.borderLeftWidth) || 0;
      const borderY = parseFloat(computed.borderTopWidth) || 0;
      const width = parseFloat(computed.width) + (computed.boxSizing === 'border-box'
        ? -borderX - (parseFloat(computed.borderRightWidth) || 0)
        : (parseFloat(computed.paddingLeft) || 0) + (parseFloat(computed.paddingRight) || 0));
      const height = parseFloat(computed.height) + (computed.boxSizing === 'border-box'
        ? -borderY - (parseFloat(computed.borderBottomWidth) || 0)
        : (parseFloat(computed.paddingTop) || 0) + (parseFloat(computed.paddingBottom) || 0));
      if (!(width > 0 && height > 0)) return null;
      const radiusValue = computed.borderTopLeftRadius;
      const radius = Math.max(0, Math.min(width / 2, height / 2,
        (radiusValue.endsWith('%') ? Math.min(width, height) * parseFloat(radiusValue) / 100 : parseFloat(radiusValue)) - Math.min(borderX, borderY)));
      if (!sources.has(this.scene)) {
        const sourceStyle = getComputedStyle(this.scene);
        sources.set(this.scene, { rect: this.scene.getBoundingClientRect(), width: sourceStyle.width,
          height: sourceStyle.height, typography: Object.fromEntries(typography.map(key => [key, sourceStyle[key]])) });
      }
      return { width, height, radius, source: sources.get(this.scene), target: this.element.getBoundingClientRect(), borderX, borderY };
    }

    buildFilter() {
      const { strength, blur, dispersion, material } = this.options;
      const topology = this.options.enabled && !opaque.matches && (strength || blur) ? `${material}:${!!strength}:${!!blur}:${dispersion > 0}` : 'off';
      if (this.filterTopology === topology) {
        this.channels?.forEach((channel, index) => write(channel, 'scale', 2 * strength * (dispersion > 0 ? 1 + (index - 1) * dispersion : 1)));
        if (this.blurNode) write(this.blurNode, 'stdDeviation', blur);
        this.filterGeometry = '';
        return;
      }
      this.filterTopology = topology; this.filter?.remove(); this.blurNode = null;
      if (topology === 'off') {
        this.filter = null; this.map = null; this.channels = [];
        style(this.sampler, 'filter', 'none'); return;
      }
      this.filter = svg('filter', { id: this.id, filterUnits: 'userSpaceOnUse', primitiveUnits: 'userSpaceOnUse', 'color-interpolation-filters': 'sRGB' });
      let input = 'SourceGraphic';
      if (material === 'regular') {
        this.filter.append(svg('feColorMatrix', { in: input, type: 'saturate', values: '.78', result: 'neutral' })); input = 'neutral';
      }
      if (blur > 0) {
        this.blurNode = svg('feGaussianBlur', { in: input, stdDeviation: blur, edgeMode: 'duplicate', result: 'frosted' });
        this.filter.append(this.blurNode); input = 'frosted';
      }
      this.map = null; this.channels = [];
      if (strength > 0) {
        this.map = svg('feImage', { preserveAspectRatio: 'none', result: 'normal', x: 0, y: 0 }); this.filter.append(this.map);
        const split = dispersion > 0;
        (split ? ['R', 'G', 'B'] : ['all']).forEach((channel, index) => {
          const displacement = svg('feDisplacementMap', { in: input, in2: 'normal', xChannelSelector: 'R', yChannelSelector: 'G',
            scale: 2 * strength * (split ? 1 + (index - 1) * dispersion : 1), x: 0, y: 0, result: `displaced${channel}` });
          this.filter.append(displacement); this.channels.push(displacement);
          if (split) {
            const matrix = Array(20).fill(0); matrix[index * 6] = 1; matrix[18] = 1;
            this.filter.append(svg('feColorMatrix', { in: `displaced${channel}`, type: 'matrix', values: matrix.join(' '), result: channel }));
          }
        });
        if (split) this.filter.append(svg('feBlend', { in: 'R', in2: 'G', mode: 'screen', result: 'RG' }), svg('feBlend', { in: 'RG', in2: 'B', mode: 'screen' }));
      }
      defs.append(this.filter); this.filterGeometry = ''; this.mapGeometry = ''; this.lastMapTime = 0;
      style(this.sampler, 'filter', `url(#${this.id})`);
    }

    commit({ width, height, radius, source, target, borderX, borderY }, time) {
      if (this.sceneDirty) {
        this.copy = this.scene.cloneNode(true); this.copy.classList.add('glass-scene-copy'); this.copy.removeAttribute('id');
        this.copy.querySelectorAll('[id]').forEach(node => node.removeAttribute('id'));
        Object.assign(this.copy.style, source.typography);
        this.sampler.replaceChildren(this.copy); this.sceneDirty = false;
      }
      if (this.filterDirty) { this.buildFilter(); this.filterDirty = false; }
      const geometry = `${width}:${height}:${radius}`;
      if (this.filter && geometry !== this.filterGeometry) {
        // Source padding grows only with the pixels the filter actually samples.
        const pad = Math.ceil(this.options.strength * (1 + this.options.dispersion) + this.options.blur * 3 + 2);
        for (const [key, value] of Object.entries({ x: -pad, y: -pad, width: width + pad * 2, height: height + pad * 2 })) write(this.filter, key, value);
        if (this.map) {
          write(this.map, 'width', width); write(this.map, 'height', height);
          this.channels.forEach(channel => { write(channel, 'width', width); write(channel, 'height', height); });
        }
        this.filterGeometry = geometry;
      }
      style(this.clip, 'borderRadius', `${radius}px`); this.mapPending = false;
      if (this.map && this.filter && geometry !== this.mapGeometry) {
        // At most 30 map encodes/sec during morphs; alignment follows every frame.
        // Large jumps update immediately. The last frame is always exact.
        const jump = !this.mapSize || Math.abs(width - this.mapSize[0]) + Math.abs(height - this.mapSize[1]) + Math.abs(radius - this.mapSize[2]) > 12;
        if (jump || !this.lastMapTime || time - this.lastMapTime >= 32) {
          write(this.map, 'href', surfaceMap(Math.round(width), Math.round(height), Math.round(radius * 2) / 2));
          this.mapGeometry = geometry; this.mapSize = [width, height, radius]; this.lastMapTime = time;
        } else this.mapPending = true;
      }
      if (this.filter) style(this.sampler, 'filter', `url(#${this.id})`);
      style(this.copy, 'width', source.width); style(this.copy, 'height', source.height);
      this.offset = { x: source.rect.left - target.left - borderX, y: source.rect.top - target.top - borderY };
      style(this.copy, 'transform', `translate(${this.offset.x}px, ${this.offset.y}px)`);
    }

    destroy() {
      unobserve(this.element, this); unobserve(this.scene, this); intersection.unobserve(this.element);
      this.clip.remove(); this.filter?.remove(); this.element.classList.remove('has-optics');
      delete this.element.dataset.glassMaterial; delete this.element.dataset.glassEnabled;
      instances.delete(this); dirty.delete(this);
    }

    static invalidate(duration = 0) { instances.forEach(lens => lens.invalidate(duration)); }
  }
  window.addEventListener('resize', () => LiquidGlass.invalidate());
  opaque.addEventListener('change', () => instances.forEach(lens => { lens.filterDirty = true; lens.invalidate(); }));
  document.fonts?.ready.then(() => LiquidGlass.invalidate());
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { cancelAnimationFrame(frame); frame = 0; } else LiquidGlass.invalidate();
  });
  // Track only geometry transitions affecting a lens or its positioning wrapper.
  document.addEventListener('transitionrun', event => {
    if (!['transform', 'width', 'height', 'border-radius'].includes(event.propertyName)) return;
    const computed = getComputedStyle(event.target);
    const ms = value => parseFloat(value) * (value.trim().endsWith('ms') ? 1 : 1000);
    const duration = Math.max(...computed.transitionDuration.split(',').map(ms)) + Math.max(...computed.transitionDelay.split(',').map(ms));
    instances.forEach(lens => { if (event.target === lens.element || event.target.contains(lens.element)) lens.invalidate(duration + 34); });
  });
  window.LiquidGlass = LiquidGlass;
})();
