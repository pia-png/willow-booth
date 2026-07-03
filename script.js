// =============================================================================
// WILLOW BOOTH — Mini Photo Booth 
//
// Organized as:
//   1. Elements + config 
//   2. Frame selection screen
//   3. Booth theme + live filmstrip layout
//   4. Camera 
//   5. Countdown + capture
//   6. Strip renderers 
//   7. Download
//   8. Reset
// =============================================================================
(function(){
  // ---------- 1. Elements ----------
  const selectScreen = document.getElementById('selectScreen');
  const boothScreen = document.getElementById('boothScreen');
  const frameCards = document.querySelectorAll('.frame-card');
  const enterBoothBtn = document.getElementById('enterBoothBtn');
  const changeFrameBtn = document.getElementById('changeFrameBtn');
  const frameBadge = document.getElementById('frameBadge');
  const filmstrip = document.getElementById('filmstrip');
  const stripLabel = document.getElementById('stripLabel');

  const video = document.getElementById('video');
  const placeholder = document.getElementById('placeholder');
  const startBtn = document.getElementById('startBtn');
  const shutterBtn = document.getElementById('shutterBtn');
  const flashEl = document.getElementById('flash');
  const countdownEl = document.getElementById('countdownNum');
  const statusEl = document.getElementById('status');
  const shotCountEl = document.getElementById('shotCount');
  const downloadBtn = document.getElementById('downloadBtn');
  const resetBtn = document.getElementById('resetBtn');
  const captureCanvas = document.getElementById('captureCanvas');
  const stripCanvas = document.getElementById('stripCanvas');
  
  const cssFilters = {
    none: 'none',
    bw: 'grayscale(1) contrast(1.15)',
    sepia: 'sepia(0.75) contrast(1.05) saturate(1.2)',
    vintage: 'contrast(1.1) saturate(0.75) sepia(0.25) brightness(1.02)'
  };

  const frameNames = { woods: 'Woods', ocean: 'Ocean Breeze', sky: 'Sky' };
  const frameLabels = { woods: 'WILLOW BOOTH', ocean: 'by the shore', sky: 'in the clouds' };

  const FRAME_OVERLAY_IMAGES = {
    woods: 'images/woods.png',
    ocean: 'images/ocean.png',
    sky: 'images/sky.png'
  };

  const FRAME_LAYOUT = {
    woods: { frameW: 480, frameH: 360, pad: 24, gap: 18, labelH: 60, footerH: 50, sprocketZone: 0 },
    ocean: { frameW: 460, frameH: 345, pad: 30, gap: 20, labelH: 74, footerH: 56, sprocketZone: 0 },
    sky:   { frameW: 440, frameH: 330, pad: 26, gap: 16, labelH: 66, footerH: 50, sprocketZone: 0 }
  };

  function getTotalDims(layout){
    const totalW = layout.frameW + layout.pad * 2 + layout.sprocketZone * 2;
    const totalH = layout.labelH + layout.frameH * 3 + layout.gap * 2 + layout.footerH + layout.pad;
    return { totalW, totalH };
  }


  Object.keys(FRAME_OVERLAY_IMAGES).forEach(type => {
    const src = FRAME_OVERLAY_IMAGES[type];
    if (!src) return;
    const miniFrame = document.querySelector('.mini-frame.' + type);
    if (!miniFrame) return;
    const probe = new Image();
    probe.onload = () => {
      miniFrame.style.backgroundImage = `url('${src}')`;
      miniFrame.style.backgroundSize = 'cover';
      miniFrame.style.backgroundPosition = 'center';
      miniFrame.classList.add('has-image');
    };
    probe.onerror = () => {
      console.warn(`Frame thumbnail failed to load for "${type}": ${src} — showing CSS fallback instead.`);
    };
    probe.src = src;
  });

  let currentFilter = 'none';
  let stream = null;
  let shots = [];
  let busy = false;
  let selectedFrame = null;

  // ---------- 2. Frame selection screen ----------
  frameCards.forEach(card => {
    card.addEventListener('click', () => {
      selectFrame(card.dataset.frame);
    });
  });

  function selectFrame(type){
    selectedFrame = type;
    frameCards.forEach(c => c.classList.toggle('active', c.dataset.frame === type));
    enterBoothBtn.disabled = false;
  }

  enterBoothBtn.addEventListener('click', () => {
    if (!selectedFrame) return;
    selectScreen.style.display = 'none';
    boothScreen.style.display = 'flex';
    applyFrameTheme();
  });

  changeFrameBtn.addEventListener('click', () => {
    boothScreen.style.display = 'none';
    selectScreen.style.display = 'flex';
  });

  // ---------- 3. Booth theme + live filmstrip layout ----------
  function applyFrameTheme(){
    filmstrip.className = 'filmstrip theme-' + selectedFrame;
    frameBadge.textContent = frameNames[selectedFrame];
    stripLabel.textContent = frameLabels[selectedFrame];

    const existingOverlay = filmstrip.querySelector('.frame-overlay-img');
    if (existingOverlay) existingOverlay.remove();
    const overlaySrc = FRAME_OVERLAY_IMAGES[selectedFrame];
    if (overlaySrc) {
      const overlay = document.createElement('img');
      overlay.className = 'frame-overlay-img';
      overlay.onerror = () => overlay.remove();
      overlay.src = overlaySrc;
      filmstrip.appendChild(overlay);
    }

    layoutLiveFilmstrip(selectedFrame);
  }

  function layoutLiveFilmstrip(type){
    const layout = FRAME_LAYOUT[type];
    if (!layout) return;
    const { frameW, frameH, pad, gap, labelH, sprocketZone } = layout;
    const { totalW, totalH } = getTotalDims(layout);

    filmstrip.style.aspectRatio = `${totalW} / ${totalH}`;
    filmstrip.style.padding = '0';
    filmstrip.style.gap = '0';
    filmstrip.style.minHeight = '0';
    filmstrip.style.position = 'relative';


    const renderedW = filmstrip.clientWidth;
    const renderedH = filmstrip.clientHeight;
    const scaleX = renderedW / totalW;
    const scaleY = renderedH / totalH;

    [0, 1, 2].forEach(i => {
      const slot = document.getElementById('slot' + i);
      const x = sprocketZone + pad;
      const y = labelH + i * (frameH + gap);

      slot.style.position = 'absolute';
      slot.style.margin = '0';
      slot.style.left = (x * scaleX) + 'px';
      slot.style.top = (y * scaleY) + 'px';
      slot.style.width = (frameW * scaleX) + 'px';
      slot.style.height = (frameH * scaleY) + 'px';
    });

    stripLabel.style.display = 'block';
    stripLabel.style.position = 'absolute';
    stripLabel.style.left = '0';
    stripLabel.style.top = (12 * scaleY) + 'px';
    stripLabel.style.width = '100%';
    stripLabel.style.margin = '0';
    stripLabel.style.padding = '0';
    stripLabel.style.boxSizing = 'border-box';
  }


  window.addEventListener('resize', () => {
    if (selectedFrame && boothScreen.style.display !== 'none') {
      layoutLiveFilmstrip(selectedFrame);
    }
  });

  // ---------- 4. Camera ----------
  startBtn.addEventListener('click', async () => {
    try {
      if (!window.isSecureContext) {
        statusEl.textContent = 'Camera needs a secure context (https, or localhost) to work.';
      }
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false });
      video.srcObject = stream;
      video.style.display = 'block';
      placeholder.style.display = 'none';
      shutterBtn.disabled = shots.length >= 3;
      statusEl.textContent = 'When you are ready, hit the shutter.';
    } catch (err) {
      statusEl.textContent = "Couldn't access the camera (" + err.name + "). Check your site permissions.";
    }
  });

  // ---------- 5. Countdown + capture ----------
  shutterBtn.addEventListener('click', () => {
    if (busy || shots.length >= 3) return;
    runCountdown();
  });

  const COUNTDOWN_START = 3;
  const COUNTDOWN_BEAT_MS = 1000;

  function runCountdown(){
    busy = true;
    shutterBtn.disabled = true;
    statusEl.textContent = 'Hold still…';

    let n = COUNTDOWN_START;
    showCountdownBeat(n);

    const tick = setInterval(() => {
      n -= 1;
      if (n > 0) {
        showCountdownBeat(n);
      } else {
        clearInterval(tick);
        takePhoto();
      }
    }, COUNTDOWN_BEAT_MS);
  }

  function showCountdownBeat(n){
    countdownEl.textContent = n;
    countdownEl.classList.remove('show');
    void countdownEl.offsetWidth; // restart the CSS animation
    countdownEl.classList.add('show');
  }

  function takePhoto(){
    flashEl.classList.remove('pop');
    void flashEl.offsetWidth;
    flashEl.classList.add('pop');

    const w = video.videoWidth || 640;
    const h = video.videoHeight || 480;
    captureCanvas.width = w;
    captureCanvas.height = h;
    const ctx = captureCanvas.getContext('2d');

    ctx.save();
    ctx.filter = cssFilters[currentFilter];
    ctx.translate(w, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, w, h);
    ctx.restore();

    const dataUrl = captureCanvas.toDataURL('image/jpeg', 0.92);
    shots.push(dataUrl);
    placeInSlot(shots.length - 1, dataUrl);

    shotCountEl.textContent = `${shots.length} / 3 shots`;
    statusEl.textContent = shots.length < 3 ? 'Nice. Ready for the next one.' : 'Strip complete. You can download it below.';

    busy = false;
    shutterBtn.disabled = shots.length >= 3;
    if (shots.length >= 3) downloadBtn.disabled = false;
  }

  function placeInSlot(index, dataUrl){
    const slot = document.getElementById('slot' + index);
    slot.innerHTML = '';
    const img = document.createElement('img');
    img.src = dataUrl;
    slot.appendChild(img);
    const label = document.createElement('span');
    label.className = 'frame-index';
    label.textContent = String(index + 1).padStart(2, '0');
    slot.appendChild(label);
  }

  function loadImage(src){
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
  }

  function drawRoundedRect(ctx, x, y, w, h, r){
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  // ---------- 6. Strip renderers ----------
  async function drawWoodsStrip(ctx, imgs, overlayImg){
    const { frameW, frameH, pad, gap, labelH } = FRAME_LAYOUT.woods;
    const { totalW, totalH } = getTotalDims(FRAME_LAYOUT.woods);
    ctx.canvas.width = totalW;
    ctx.canvas.height = totalH;
    ctx.clearRect(0, 0, totalW, totalH);  
     
    ctx.fillStyle = '#0f0e0d';
    ctx.fillRect(0, 0, totalW, totalH);

    imgs.forEach((img, i) => {
      const y = labelH + i * (frameH + gap);
      if (overlayImg) {
        ctx.drawImage(img, pad, y, frameW, frameH);
      } else {

        ctx.save();
        drawRoundedRect(ctx, pad, y, frameW, frameH, 2);
        ctx.clip();
        ctx.fillStyle = '#1a1917'; ctx.fillRect(pad, y, frameW, frameH);
        ctx.drawImage(img, pad, y, frameW, frameH);
        ctx.restore();
        ctx.strokeStyle = '#2c2a26'; ctx.lineWidth = 1;
        drawRoundedRect(ctx, pad, y, frameW, frameH, 2); ctx.stroke();

        ctx.fillStyle = '#5a564c';
        ctx.font = '9px "my-font", serif';
        ctx.textAlign = 'right';
        ctx.fillText(String(i + 1).padStart(2, '0'), pad + frameW - 5, y + frameH - 5);
      }
    });


    if (overlayImg) {
      ctx.drawImage(overlayImg, 0, 0, totalW, totalH);
    }

    ctx.save();
    ctx.fillStyle = '#7fae82';
    ctx.font = '700 26px "my-font", serif';
    ctx.textAlign = 'center';
    ctx.shadowColor = 'rgba(0,0,0,0.6)';
    ctx.shadowBlur = 4;
    ctx.shadowOffsetY = 1;
    ctx.fillText(frameLabels.woods, totalW / 2, 40);
    ctx.restore();

    ctx.save();
    ctx.fillStyle = '#fdf6ec';
    ctx.font = '15px "my-font", serif';
    ctx.textAlign = 'center';
    ctx.fillText(new Date().toLocaleDateString(), totalW / 2, totalH - 22);
    ctx.restore();
  }

  async function drawOceanStrip(ctx, imgs, overlayImg){
    const { frameW, frameH, pad, gap, labelH } = FRAME_LAYOUT.ocean;
    const { totalW, totalH } = getTotalDims(FRAME_LAYOUT.ocean);
    ctx.canvas.width = totalW; ctx.canvas.height = totalH;


    ctx.fillStyle = '#fdf6ec';
    ctx.fillRect(0, 0, totalW, totalH);

    imgs.forEach((img, i) => {
      const y = labelH + i * (frameH + gap);
      if (overlayImg) {
        ctx.drawImage(img, pad, y, frameW, frameH);
      } else {

        ctx.save();
        drawRoundedRect(ctx, pad, y, frameW, frameH, 10);
        ctx.clip();
        ctx.fillStyle = '#fffaf3'; ctx.fillRect(pad, y, frameW, frameH);
        ctx.drawImage(img, pad, y, frameW, frameH);
        ctx.restore();
        ctx.strokeStyle = '#cfe0c9'; ctx.lineWidth = 1;
        drawRoundedRect(ctx, pad, y, frameW, frameH, 10); ctx.stroke();


        ctx.fillStyle = '#fffaf3';
        ctx.font = '9px "my-font", serif';
        ctx.textAlign = 'right';
        ctx.fillText(String(i + 1).padStart(2, '0'), pad + frameW - 5, y + frameH - 5);
      }
    });


    if (overlayImg) {
      ctx.drawImage(overlayImg, 0, 0, totalW, totalH);
    }


    ctx.save();
    ctx.fillStyle = '#2f7ba6';
    ctx.font = '600 34px "my-font", serif';
    ctx.textAlign = 'center';
    ctx.fillText(frameLabels.ocean, totalW / 2, 52);
    ctx.restore();

    ctx.save();
    ctx.fillStyle = '#2f7ba6';
    ctx.font = '15px "my-font", serif';
    ctx.textAlign = 'center';
    ctx.fillText(new Date().toLocaleDateString(), totalW / 2, totalH - 22);
    ctx.restore();
  }

  async function drawSkyStrip(ctx, imgs, overlayImg){
    const { frameW, frameH, pad, gap, labelH, sprocketZone } = FRAME_LAYOUT.sky;
    const { totalW, totalH } = getTotalDims(FRAME_LAYOUT.sky);
    ctx.canvas.width = totalW; ctx.canvas.height = totalH;


    ctx.fillStyle = '#fdf6ec';
    ctx.fillRect(0, 0, totalW, totalH);

    imgs.forEach((img, i) => {
      const y = labelH + i * (frameH + gap);
      const x = sprocketZone + pad;
      if (overlayImg) {
        ctx.drawImage(img, x, y, frameW, frameH);
      } else {

        ctx.fillStyle = '#fdf6ec'; ctx.fillRect(x, y, frameW, frameH);
        ctx.drawImage(img, x, y, frameW, frameH);
        ctx.strokeStyle = '#cfe0c9'; ctx.lineWidth = 1;
        ctx.strokeRect(x, y, frameW, frameH);

        // matches .frame-index (sky)
        ctx.fillStyle = '#fdf6ec';
        ctx.font = '9px "my-font", serif';
        ctx.textAlign = 'right';
        ctx.fillText(String(i + 1).padStart(2, '0'), x + frameW - 5, y + frameH - 5);
      }
    });


    if (overlayImg) {
      ctx.drawImage(overlayImg, 0, 0, totalW, totalH);
    }

    ctx.save();
    ctx.fillStyle = '#dff0d8';
    ctx.font = '700 22px "my-font", serif';
    ctx.textAlign = 'center';
    if ('letterSpacing' in ctx) ctx.letterSpacing = '4px';
    ctx.fillText(frameLabels.sky, totalW / 2, 42);
    ctx.restore();

    ctx.save();
    ctx.fillStyle = '#5c7a63';
    ctx.font = '13px "my-font", serif';
    ctx.textAlign = 'center';
    ctx.fillText(new Date().toLocaleDateString(), totalW / 2, totalH - 20);
    ctx.restore();
  }

  // ---------- 7. Download ----------
  downloadBtn.addEventListener('click', async () => {
    if (shots.length < 3) return;
    downloadBtn.disabled = true;
    downloadBtn.textContent = 'Developing…';

    try {
      if (document.fonts && document.fonts.ready) await document.fonts.ready;
      const imgs = await Promise.all(shots.map(loadImage));
      const ctx = stripCanvas.getContext('2d');

      const overlaySrc = FRAME_OVERLAY_IMAGES[selectedFrame];
      let overlayImg = null;
      if (overlaySrc) {
        try {
          overlayImg = await loadImage(overlaySrc);
        } catch (e) {
          console.warn(`Overlay art failed to load for "${selectedFrame}": ${overlaySrc} — using the fallback frame instead.`, e);
        }
      }

      if (selectedFrame === 'woods') {
        await drawWoodsStrip(ctx, imgs, overlayImg);
      } else if (selectedFrame === 'ocean') {
        await drawOceanStrip(ctx, imgs, overlayImg);
      } else if (selectedFrame === 'sky') {
        await drawSkyStrip(ctx, imgs, overlayImg);
      }

      const link = document.createElement('a');
      link.download = 'photo-booth-strip.jpg';
      link.href = stripCanvas.toDataURL('image/jpeg', 0.95);
      link.click();
    } finally {
      downloadBtn.disabled = false;
      downloadBtn.textContent = 'Download strip';
    }
  });

  // ---------- 8. Reset ----------
  resetBtn.addEventListener('click', () => {
    shots = [];
    shotCountEl.textContent = '0 / 3 shots';
    downloadBtn.disabled = true;
    shutterBtn.disabled = !stream;
    statusEl.textContent = stream ? 'When you are ready, hit the shutter.' : 'Turn on the camera to begin.';
    [0,1,2].forEach(i => {
      const slot = document.getElementById('slot' + i);
      slot.innerHTML = `<span class="empty-dot"></span><span class="frame-index">${String(i+1).padStart(2,'0')}</span>`;
    });
  });
})();


       