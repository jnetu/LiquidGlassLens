/* Shape-aware refraction for explicit, non-interactive scene layers.
 * The scene replica is sampled before the lens is clipped. This keeps text
 * sharp and allows pixels outside the lens to bend into its rounded edge.
 * No dependency on SVG support inside backdrop-filter (not portable).
 */
(() => {
  const NS = 'http://www.w3.org/2000/svg';
  const svg = (tag, attributes = {}) => {
    const element = document.createElementNS(NS, tag);
    Object.entries(attributes).forEach(([key, value]) => element.setAttribute(key, value));
    return element;
  };
  const definitions = svg('svg', { class: 'optical-filter-defs', 'aria-hidden': 'true' });
  const defs = svg('defs');
  definitions.append(defs);
  document.body.append(definitions);
  const instances = new Set();
  const cache = new Map();
  let nextId = 0;
  let frame = 0;
  let trackingUntil = 0;

  // Rounded-rectangle signed distance gives the actual surface normal, including
  // straight sides and circular corners. A raised bevel refracts more at the rim.
  function surfaceMap(width, height, radius) {
    const key = `${width}:${height}:${radius}`;
    if (cache.has(key)) return cache.get(key);
    const ratio = Math.min(1, 640 / Math.max(width, height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(2, Math.round(width * ratio));
    canvas.height = Math.max(2, Math.round(height * ratio));
    const context = canvas.getContext('2d');
    const pixels = context.createImageData(canvas.width, canvas.height);
    const bevel = Math.min(26, Math.min(width, height) * 0.24);
    for (let y = 0; y < canvas.height; y++) {
      for (let x = 0; x < canvas.width; x++) {
        const px = (x + 0.5) / canvas.width * width - width / 2;
        const py = (y + 0.5) / canvas.height * height - height / 2;
        const qx = Math.abs(px) - (width / 2 - radius);
        const qy = Math.abs(py) - (height / 2 - radius);
        const ox = Math.max(qx, 0), oy = Math.max(qy, 0);
        const length = Math.hypot(ox, oy);
        const distance = -(length + Math.min(Math.max(qx, qy), 0) - radius);
        let nx = 0, ny = 0;
        if (length > 0) { nx = ox / length; ny = oy / length; }
        else if (qx > qy) nx = 1;
        else ny = 1;
        nx *= Math.sign(px); ny *= Math.sign(py);
        const depth = Math.max(0, Math.min(1, distance / bevel));
        const rim = Math.pow(Math.sin(depth * Math.PI), 1.25);
        // Subtle magnification across the flat center + strong curved edge.
        const dx = -nx * rim * 0.88 - px / width * 0.12 * depth;
        const dy = -ny * rim * 0.88 - py / height * 0.12 * depth;
        const i = (y * canvas.width + x) * 4;
        pixels.data[i] = Math.round(127.5 + dx * 127.5);
        pixels.data[i + 1] = Math.round(127.5 + dy * 127.5);
        pixels.data[i + 2] = 128;
        pixels.data[i + 3] = 255;
      }
    }
    context.putImageData(pixels, 0, 0);
    const url = canvas.toDataURL();
    if (cache.size >= 48) cache.delete(cache.keys().next().value);
    cache.set(key, url);
    return url;
  }

  function tick() {
    frame = 0;
    instances.forEach(instance => { if (instance.visible) instance.sync(); });
    if (performance.now() < trackingUntil) invalidate();
  }
  function invalidate(duration = 0) {
    trackingUntil = Math.max(trackingUntil, performance.now() + duration);
    if (!frame) frame = requestAnimationFrame(tick);
  }

  class LiquidGlass {
    constructor(element, scene, options = {}) {
      this.element = element;
      this.scene = scene;
      this.options = { strength: 22, blur: 0.25, dispersion: 0, enabled: true, ...options };
      this.visible = false;
      this.geometry = '';
      this.id = `glass-optics-${++nextId}`;
      this.filter = svg('filter', {
        id: this.id, filterUnits: 'userSpaceOnUse', primitiveUnits: 'userSpaceOnUse',
        'color-interpolation-filters': 'sRGB'
      });
      this.map = svg('feImage', { preserveAspectRatio: 'none', result: 'normal', x: 0, y: 0 });
      this.filter.append(this.map);
      this.channels = [];
      ['R', 'G', 'B'].forEach((channel, index) => {
        const displacement = svg('feDisplacementMap', {
          in: 'SourceGraphic', in2: 'normal', xChannelSelector: 'R',
          yChannelSelector: 'G', result: `displaced${channel}`
        });
        const matrix = Array(20).fill(0);
        matrix[index * 6] = 1;
        matrix[18] = 1;
        this.filter.append(displacement, svg('feColorMatrix', {
          in: `displaced${channel}`, type: 'matrix', values: matrix.join(' '), result: channel
        }));
        this.channels.push(displacement);
      });
      this.filter.append(svg('feBlend', { in: 'R', in2: 'G', mode: 'screen', result: 'RG' }));
      this.filter.append(svg('feBlend', { in: 'RG', in2: 'B', mode: 'screen', result: 'RGB' }));
      this.blur = svg('feGaussianBlur', { in: 'RGB', stdDeviation: this.options.blur });
      this.filter.append(this.blur);
      defs.append(this.filter);

      this.clip = document.createElement('div');
      this.clip.className = 'glass-optics';
      this.clip.setAttribute('aria-hidden', 'true');
      this.clip.inert = true;
      this.sampler = document.createElement('div');
      this.sampler.className = 'glass-sampler';
      this.sampler.style.filter = `url(#${this.id})`;
      this.clip.append(this.sampler);
      element.prepend(this.clip);
      element.classList.add('has-optics');
      this.refreshScene();
      this.resize = new ResizeObserver(() => invalidate());
      this.resize.observe(element);
      this.resize.observe(scene);
      this.intersection = new IntersectionObserver(entries => {
        this.visible = entries[0].isIntersecting;
        if (this.visible) invalidate();
      }, { rootMargin: '120px' });
      this.intersection.observe(element);
      instances.add(this);
      this.set(options);
    }

    refreshScene() {
      this.copy = this.scene.cloneNode(true);
      this.copy.classList.add('glass-scene-copy');
      this.copy.removeAttribute('id');
      this.copy.querySelectorAll('[id]').forEach(node => node.removeAttribute('id'));
      // A button has its own inherited typography (notably text-align:center).
      // Preserve the source's inheritance so a replica never reflows inside it.
      const sourceStyle = getComputedStyle(this.scene);
      ['fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'lineHeight',
        'letterSpacing', 'textAlign', 'textTransform', 'whiteSpace', 'color', 'direction']
        .forEach(property => { this.copy.style[property] = sourceStyle[property]; });
      this.sampler.replaceChildren(this.copy);
      invalidate();
    }

    set(options) {
      Object.assign(this.options, options);
      const strength = this.options.enabled ? this.options.strength : 0;
      this.channels.forEach((channel, index) => {
        channel.setAttribute('scale', 2 * strength * (1 + (index - 1) * this.options.dispersion));
      });
      this.blur.setAttribute('stdDeviation', this.options.enabled ? this.options.blur : 0);
      invalidate();
    }

    sync() {
      const width = this.element.clientWidth, height = this.element.clientHeight;
      if (!width || !height) return;
      const computed = getComputedStyle(this.element);
      const radiusValue = computed.borderTopLeftRadius;
      const radius = Math.round(Math.min(width / 2, height / 2,
        radiusValue.endsWith('%') ? Math.min(width, height) * parseFloat(radiusValue) / 100 : parseFloat(radiusValue)));
      const geometry = `${width}:${height}:${radius}`;
      if (geometry !== this.geometry) {
        this.geometry = geometry;
        Object.entries({ x: -64, y: -64, width: width + 128, height: height + 128 })
          .forEach(([key, value]) => this.filter.setAttribute(key, value));
        this.map.setAttribute('width', width);
        this.map.setAttribute('height', height);
        this.map.setAttribute('href', surfaceMap(width, height, radius));
      }
      const source = this.scene.getBoundingClientRect();
      const target = this.element.getBoundingClientRect();
      this.copy.style.width = `${this.scene.offsetWidth}px`;
      this.copy.style.height = `${this.scene.offsetHeight}px`;
      this.copy.style.transform = `translate(${source.left - target.left - this.element.clientLeft}px, ${source.top - target.top - this.element.clientTop}px)`;
    }

    destroy() {
      this.resize.disconnect(); this.intersection.disconnect();
      this.clip.remove(); this.filter.remove();
      this.element.classList.remove('has-optics');
      instances.delete(this);
    }

    static invalidate(duration = 0) { invalidate(duration); }
  }
  window.addEventListener('resize', () => invalidate());
  document.fonts?.ready.then(() => invalidate());
  document.addEventListener('transitionrun', event => {
    if (event.target.closest('.optical-stage')) invalidate(600);
  });
  window.LiquidGlass = LiquidGlass;
})();
