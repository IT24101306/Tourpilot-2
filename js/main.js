/**
 * IYYO — Fullscreen pinned scroll showcase (optimized for 60fps scrub)
 * Frame list: js/frames.manifest.json (run scripts/generate-frames-manifest.ps1 after image changes)
 */

const FRAME_FOLDER_DEFAULT = "HERO SECTION IMAGES";
const SCROLL_SECTION_ID = "projects";
const MANIFEST_URL = "js/frames.manifest.json";
const HERO_VIDEO_FALLBACK = "assets/hero-scroll.mp4";
const MAX_CANVAS_W = 1920;
/* Video mode = 1 request. Image fallback loads frames only while scrolling. */
const PREFETCH_RADIUS = 10;
const MAX_CONCURRENT_LOADS = 3;
const MAX_FRAMES_IN_MEMORY = 56;
const RENDER_PROGRESS_EPS = 0.0006;
/* Higher = more scroll distance between frames (smoother scrub) */
const SCROLL_VH_PER_FRAME = 2.1;
const SCROLL_MIN_VH = 160;
const SCROLL_MAX_VH = 460;
/* Non-overlapping ranges — only one story card visible at a time */
const phases = [
  { id: "intro", start: 0, end: 0.24 },
  { id: "rotate", start: 0.24, end: 0.48 },
  { id: "dismantle", start: 0.48, end: 0.72 },
  { id: "orbit", start: 0.72, end: 1 },
];

const STORY_CONTENT = {
  intro: {
    eyebrow: "IYYO Solutions",
    title: "Digital products, built right.",
    copy:
      "Websites, software, and e-commerce — engineered with quality, speed, and reliability.",
  },
  rotate: {
    eyebrow: "What we do",
    title: "Design & development.",
    copy:
      "From brand websites to custom platforms, we ship work that performs in the real world.",
  },
  dismantle: {
    eyebrow: "How we work",
    title: "Clear process. Fast delivery.",
    copy:
      "Structured builds, transparent communication, and solutions your team can actually use.",
  },
  orbit: {
    eyebrow: "Let's build",
    title: "Ready when you are.",
    copy:
      "Scroll through our showcase — then explore projects or get in touch to start yours.",
  },
};

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

const canvas = $("#robot-canvas");
const ctx = canvas.getContext("2d", { alpha: false, desynchronized: true });
const robotStage = $("#robot-stage");
const heroVideoEl = $("#hero-video");
const loader = $("#loader");
const terminalOutput = $("#terminal-output");
const terminalTyping = $("#terminal-typing");
const main = $("#main");
const chamber = $("#chamber");
const storyUi = $("#story-ui");
const storyClock = $("#story-clock");
const storyCard = $("#story-card");
const storyTextWrap = $("#story-text-wrap");
const storyEyebrow = $("#story-eyebrow");
const storyTitle = $("#story-title");
const storyCopy = $("#story-copy");

const BUDDY_WAKE_MESSAGE = "scroll to wake Buddy";

const frames = [];
const frameLoadPromises = new Map();
const loadQueue = [];
const loadingIndexes = new Set();
let framePaths = [];
let frameFolder = FRAME_FOLDER_DEFAULT;
let frameCount = 0;
let loadedFrameCount = 0;
let activeLoads = 0;
let manifestVideo = null;
let manifestVideoMp4 = null;
let heroVideo = null;
let useVideoMode = false;
let renderedVideoTime = -1;
let pendingVideoProgress = null;
let videoSeekInFlight = false;
const VIDEO_SEEK_EPS = 0.001;
let lastPrefetchLower = -1;
let lastPrefetchUpper = -1;
let viewW = 0;
let viewH = 0;
let currentProgress = 0;
let lastRenderedProgress = -1;
let targetProgress = 0;
let experienceReady = false;
let lenis = null;
let renderQueued = false;
let scrollIdleTimer = null;
let currentStoryPhase = null;
let storyChangeTimer = null;
let buddyAwakened = false;
let pumpScheduled = false;
let bootstrapping = false;

ctx.imageSmoothingEnabled = true;
ctx.imageSmoothingQuality = "high";

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

function termLine(text, type = "") {
  if (!terminalOutput) return;
  const line = document.createElement("div");
  line.className = `terminal-line${type ? ` terminal-line--${type}` : ""}`;
  line.textContent = text;
  terminalOutput.appendChild(line);
  terminalOutput.scrollTop = terminalOutput.scrollHeight;
}

async function typeCommand(text, speed = 42) {
  if (!terminalTyping) return;
  terminalTyping.textContent = "";
  for (const ch of text) {
    terminalTyping.textContent += ch;
    await delay(speed);
  }
}

let lastLoggedPct = -1;

async function runBootHeader() {
  termLine("Microsoft Windows [Version 10.0.26200]");
  termLine("(c) IYYO Solutions Corporation. All rights reserved.");
  termLine("");
  await typeCommand("iyyo init --showcase --preload");
  await delay(550);
  termLine("iyyo init --showcase --preload", "ok");
  if (terminalTyping) terminalTyping.textContent = "";
  termLine("");
  termLine("[SYS] Mounting showcase chamber...", "info");
  await delay(220);
}

function stripJsonBom(text) {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

function applyManifestData(data) {
  if (!Array.isArray(data.files) || data.files.length === 0) {
    throw new Error("Manifest has no files");
  }
  frameFolder = data.folder || FRAME_FOLDER_DEFAULT;
  manifestVideo = data.video || null;
  manifestVideoMp4 = data.videoMp4 || null;
  framePaths = data.files.map((name) => `${frameFolder}/${name}`);
  frameCount = framePaths.length;
  termLine(`[OK] Manifest loaded — ${frameCount} frames detected`, "ok");
}

async function loadManifest() {
  if (window.IYYO_FRAME_MANIFEST) {
    applyManifestData(window.IYYO_FRAME_MANIFEST);
    return;
  }

  try {
    const res = await fetch(MANIFEST_URL);
    if (!res.ok) throw new Error(`Manifest HTTP ${res.status}`);
    const data = JSON.parse(stripJsonBom(await res.text()));
    applyManifestData(data);
    return;
  } catch (err) {
    console.warn("Manifest fetch failed:", err);
  }

  throw new Error(
    "Frame manifest missing. Run scripts/generate-frames-manifest.ps1 and reload."
  );
}

function framePath(index) {
  return framePaths[index];
}

function isFrameReady(index) {
  return Boolean(frames[index]?.complete);
}

function logFrameProgress(force = false) {
  const pct = Math.round((loadedFrameCount / frameCount) * 100);
  if (!force && pct < lastLoggedPct + 12 && loadedFrameCount !== frameCount) return;
  lastLoggedPct = pct;
  const pad = String(loadedFrameCount).padStart(3, "0");
  const total = String(frameCount).padStart(3, "0");
  termLine(`[RUN] Caching frame buffer [${pad}/${total}] — ${pct}%`, "dim");
}

function onFrameLoaded(index) {
  loadedFrameCount += 1;

  if (
    !bootstrapping &&
    (loadedFrameCount === frameCount || loadedFrameCount % 24 === 0)
  ) {
    logFrameProgress(true);
  }

  trimFrameMemory(index);

  const { lower, upper } = getFrameBlendFromProgress(currentProgress);
  if (index >= lower - 1 && index <= upper + 1) {
    lastRenderedProgress = -1;
    drawFrameAt(currentProgress);
  }
}

function trimFrameMemory(anchorIndex) {
  if (useVideoMode || frameCount <= MAX_FRAMES_IN_MEMORY) return;

  const { lower, upper } = getFrameBlendFromProgress(currentProgress);
  const keepMin = Math.max(0, Math.min(anchorIndex, lower) - PREFETCH_RADIUS - 2);
  const keepMax = Math.min(
    frameCount - 1,
    Math.max(anchorIndex, upper) + PREFETCH_RADIUS + 2
  );

  for (let i = 0; i < frameCount; i++) {
    if (i >= keepMin && i <= keepMax) continue;
    if (!frames[i]) continue;
    frames[i] = null;
    frameLoadPromises.delete(i);
  }
}

function loadFrame(index) {
  if (index < 0 || index >= frameCount) return Promise.resolve();
  if (isFrameReady(index)) return Promise.resolve();
  if (frameLoadPromises.has(index)) return frameLoadPromises.get(index);

  const promise = new Promise((resolve) => {
    const img = new Image();
    img.decoding = "async";
    img.src = encodeURI(framePath(index));
    img.onload = async () => {
      if (img.decode) {
        try {
          await img.decode();
        } catch {
          /* optional */
        }
      }
      frames[index] = img;
      onFrameLoaded(index);
      resolve();
    };
    img.onerror = () => {
      console.warn(`Frame ${index + 1} failed: ${framePath(index)}`);
      resolve();
    };
  });

  frameLoadPromises.set(index, promise);
  promise.finally(() => {
    frameLoadPromises.delete(index);
  });

  return promise;
}

function enqueueFrameLoad(index, priority = 0) {
  if (index < 0 || index >= frameCount) return;
  if (isFrameReady(index) || loadingIndexes.has(index)) return;
  if (loadQueue.some((job) => job.index === index)) return;

  loadQueue.push({ index, priority });
  pumpLoadQueue();
}

function pumpLoadQueue() {
  if (pumpScheduled) return;
  pumpScheduled = true;

  queueMicrotask(() => {
    pumpScheduled = false;

    for (let i = loadQueue.length - 1; i >= 0; i--) {
      const job = loadQueue[i];
      if (isFrameReady(job.index) || loadingIndexes.has(job.index)) {
        loadQueue.splice(i, 1);
      }
    }

    loadQueue.sort((a, b) => a.priority - b.priority);

    while (activeLoads < MAX_CONCURRENT_LOADS && loadQueue.length) {
      const job = loadQueue.shift();
      if (
        !job ||
        job.index < 0 ||
        job.index >= frameCount ||
        isFrameReady(job.index) ||
        loadingIndexes.has(job.index)
      ) {
        continue;
      }

      loadingIndexes.add(job.index);
      activeLoads += 1;

      loadFrame(job.index).finally(() => {
        loadingIndexes.delete(job.index);
        activeLoads -= 1;
        pumpLoadQueue();
      });
    }
  });
}

function prefetchAroundBlend(lower, upper) {
  if (!experienceReady || useVideoMode) return;
  if (lower === lastPrefetchLower && upper === lastPrefetchUpper) return;
  lastPrefetchLower = lower;
  lastPrefetchUpper = upper;

  enqueueFrameLoad(lower, 0);
  if (upper !== lower) enqueueFrameLoad(upper, 0);

  for (let d = 1; d <= PREFETCH_RADIUS; d++) {
    enqueueFrameLoad(lower - d, d);
    enqueueFrameLoad(upper + d, d);
  }
}

function blockHeroPlayback(video) {
  const stop = () => {
    if (!video.paused) video.pause();
  };
  video.addEventListener("play", stop);
  video.addEventListener("playing", stop);
  return stop;
}

function seekVideoTo(video, time) {
  return new Promise((resolve) => {
    const duration = video.duration;
    if (!Number.isFinite(duration) || duration <= 0) {
      resolve(false);
      return;
    }

    const target = Math.max(0, Math.min(duration - 0.001, time));
    if (Math.abs(video.currentTime - target) <= VIDEO_SEEK_EPS) {
      resolve(true);
      return;
    }

    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      video.removeEventListener("seeked", finish);
      clearTimeout(timer);
      resolve(true);
    };

    const timer = setTimeout(finish, 180);
    video.addEventListener("seeked", finish, { once: true });
    video.pause();
    video.currentTime = target;
  });
}

async function isVideoScrubbable(video) {
  const duration = video.duration;
  if (!Number.isFinite(duration) || duration <= 0) return false;

  await seekVideoTo(video, duration * 0.5);
  const mid = video.currentTime;
  return mid > 0.05;
}

function enableVideoStage() {
  robotStage?.classList.add("is-video-mode");
}

function disableVideoStage() {
  robotStage?.classList.remove("is-video-mode");
  heroVideo = null;
  useVideoMode = false;
  pendingVideoProgress = null;
  videoSeekInFlight = false;
  renderedVideoTime = -1;
}

function videoEventAlreadyFired(video, eventName) {
  if (eventName === "loadedmetadata") {
    return video.readyState >= HTMLMediaElement.HAVE_METADATA;
  }
  if (eventName === "loadeddata") {
    return video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA;
  }
  if (eventName === "canplay") {
    return video.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA;
  }
  return false;
}

function waitForVideoEvent(video, eventName, timeoutMs = 10000) {
  if (videoEventAlreadyFired(video, eventName)) {
    return Promise.resolve(true);
  }

  return new Promise((resolve) => {
    let settled = false;
    const done = (ok) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      video.removeEventListener(eventName, onEvent);
      video.removeEventListener("error", onError);
      resolve(ok);
    };
    const onEvent = () => done(true);
    const onError = () => done(false);
    const timer = setTimeout(() => done(false), timeoutMs);
    video.addEventListener(eventName, onEvent, { once: true });
    video.addEventListener("error", onError, { once: true });
  });
}

function resetHeroVideoElement(video) {
  if (!video) return;
  video.removeAttribute("style");
  video.pause();
  video.removeAttribute("src");
  video.load();
}

function primeVideoElement(video) {
  video.muted = true;
  video.playsInline = true;
  video.preload = "auto";
  video.autoplay = false;
  video.loop = false;
  video.controls = false;
  video.setAttribute("playsinline", "");
  video.setAttribute("webkit-playsinline", "");
}

async function loadHeroVideo(src) {
  const video = heroVideoEl;
  if (!video) return false;

  const videoUrl = src.split("/").map(encodeURIComponent).join("/");
  primeVideoElement(video);
  blockHeroPlayback(video);

  video.style.cssText =
    "position:fixed;left:-9999px;top:0;width:320px;height:180px;opacity:0.01;visibility:visible;pointer-events:none;z-index:-1;";

  try {
    termLine("[RUN] Fetching video metadata...", "dim");
    video.src = videoUrl;
    video.load();

    const hasMeta = await waitForVideoEvent(video, "loadedmetadata", 15000);
    if (!hasMeta) {
      termLine("[WARN] Hero video metadata timed out — using image frames", "warn");
      return false;
    }

    const duration = video.duration;
    const w = video.videoWidth;
    const h = video.videoHeight;
    if (!Number.isFinite(duration) || duration <= 0 || !w || !h) {
      termLine("[WARN] Hero video metadata invalid — using image frames", "warn");
      return false;
    }

    termLine(
      `[OK] Video metadata — ${duration.toFixed(1)}s @ ${w}x${h}`,
      "ok"
    );

    termLine("[RUN] Priming first frame...", "dim");
    video.pause();
    await seekVideoTo(video, 0);

    const hasFrame = await waitForVideoEvent(video, "loadeddata", 10000);
    if (!hasFrame) {
      termLine("[WARN] Hero video frame decode failed — using image frames", "warn");
      return false;
    }

    video.removeAttribute("style");
    video.pause();
    heroVideo = video;
    useVideoMode = true;
    enableVideoStage();
    return true;
  } catch (err) {
    console.warn("Hero video setup failed:", err);
    termLine("[WARN] Video setup failed — using image frames", "warn");
    return false;
  } finally {
    if (!useVideoMode || heroVideo !== video) {
      disableVideoStage();
      resetHeroVideoElement(video);
    }
  }
}

async function tryLoadHeroVideo() {
  const candidates = [...new Set([manifestVideoMp4, manifestVideo, HERO_VIDEO_FALLBACK].filter(Boolean))];
  if (!candidates.length) return false;

  for (const src of candidates) {
    termLine(`[RUN] Loading hero video: ${src}`, "info");
    if (await loadHeroVideo(src)) {
      termLine(`[OK] Hero video ready — 1 media request`, "ok");
      return true;
    }
  }

  return false;
}

async function finishBootSequence() {
  await delay(280);
  termLine("[SYS] Initializing scroll engine (Lenis + GSAP)...", "info");
  await delay(350);
  termLine("[OK] ScrollTrigger pinned viewport ready", "ok");
  await delay(280);
  termLine("[SYS] Launching showcase...", "info");
  await delay(650);
  termLine("[OK] IYYO showcase online.", "ok");
  if (terminalTyping) terminalTyping.textContent = "";
}

async function bootstrapInitialFrames() {
  const batchSize = 12;
  const bootstrapEnd = Math.min(batchSize, frameCount);
  lastLoggedPct = -1;
  bootstrapping = true;

  termLine(`[RUN] Caching frame buffer [0/${frameCount}]`, "info");

  for (let start = 0; start < bootstrapEnd; start += batchSize) {
    const end = Math.min(start + batchSize, bootstrapEnd);
    const jobs = [];
    for (let i = start; i < end; i++) jobs.push(loadFrame(i));
    await Promise.all(jobs);

    const loaded = end;
    const pct = Math.round((loaded / frameCount) * 100);
    if (pct >= lastLoggedPct + 12 || loaded === bootstrapEnd) {
      lastLoggedPct = pct;
      const pad = String(loaded).padStart(3, "0");
      const total = String(frameCount).padStart(3, "0");
      termLine(`[RUN] Caching frame buffer [${pad}/${total}] — ${pct}%`, "dim");
    }
  }

  if (!isFrameReady(0)) {
    bootstrapping = false;
    throw new Error("First hero frame failed to load");
  }

  await delay(280);
  termLine("[OK] All frames cached to GPU memory", "ok");
  bootstrapping = false;
}

async function bootstrapMedia() {
  if (await tryLoadHeroVideo()) {
    await delay(280);
    termLine("[OK] Hero sequence mounted from video", "ok");
    return;
  }

  disableVideoStage();
  termLine("[WARN] Hero video unavailable — falling back to image frames", "warn");
  await bootstrapInitialFrames();
}

function fitCanvas() {
  viewW = window.innerWidth;
  viewH = window.innerHeight;

  const dpr = Math.min(window.devicePixelRatio || 1, 1.75);
  let bufferW = Math.round(viewW * dpr);
  let bufferH = Math.round(viewH * dpr);

  if (bufferW > MAX_CANVAS_W) {
    const scale = MAX_CANVAS_W / bufferW;
    bufferW = MAX_CANVAS_W;
    bufferH = Math.round(bufferH * scale);
  }

  canvas.width = bufferW;
  canvas.height = bufferH;
  canvas.style.width = "100vw";
  canvas.style.height = "100vh";
  canvas.style.height = "100dvh";
  ctx.setTransform(1, 0, 0, 1, 0, 0);
}

/** object-fit: cover — fullscreen, centered crop */
function drawCoverImage(source, alpha = 1) {
  const cw = canvas.width;
  const ch = canvas.height;
  const iw = source.videoWidth || source.naturalWidth;
  const ih = source.videoHeight || source.naturalHeight;
  if (!iw || !ih) return;

  const scale = Math.max(cw / iw, ch / ih);
  const dw = iw * scale;
  const dh = ih * scale;
  const dx = (cw - dw) * 0.5;
  const dy = (ch - dh) * 0.5;

  const prevAlpha = ctx.globalAlpha;
  ctx.globalAlpha = alpha;
  ctx.drawImage(source, dx, dy, dw, dh);
  ctx.globalAlpha = prevAlpha;
}

function getFrameBlendFromProgress(progress) {
  const clamped = Math.max(0, Math.min(1, progress));
  const exact = clamped * (frameCount - 1);
  const lower = Math.floor(exact);
  const upper = Math.min(frameCount - 1, lower + 1);
  return { lower, upper, blend: exact - lower };
}

function frameIndexFromProgress(progress) {
  return getFrameBlendFromProgress(progress).lower;
}

function drawSingleFrame(index) {
  if (!isFrameReady(index)) return false;
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "source-over";
  drawCoverImage(frames[index], 1);
  return true;
}

function drawBlendedFrames(lowerIdx, upperIdx, blend) {
  if (lowerIdx === upperIdx || blend <= 0.001) {
    if (drawSingleFrame(lowerIdx)) return;
    const best = findBestLoadedIndex(lowerIdx);
    if (best >= 0) drawSingleFrame(best);
    return;
  }

  if (isFrameReady(lowerIdx) && isFrameReady(upperIdx)) {
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
    drawCoverImage(frames[lowerIdx], 1);
    ctx.globalAlpha = blend;
    drawCoverImage(frames[upperIdx], 1);
    ctx.globalAlpha = 1;
    return;
  }

  if (isFrameReady(lowerIdx)) {
    drawSingleFrame(lowerIdx);
    return;
  }

  if (isFrameReady(upperIdx)) {
    drawSingleFrame(upperIdx);
    return;
  }

  const best = findBestLoadedIndex(lowerIdx);
  if (best >= 0) drawSingleFrame(best);
}

/** Legacy single-source draw (video) */
function drawCover(source) {
  const cw = canvas.width;
  const ch = canvas.height;
  ctx.fillStyle = "#1c1c1c";
  ctx.fillRect(0, 0, cw, ch);
  drawCoverImage(source, 1);
}

async function pumpVideoSeek() {
  if (!heroVideo || videoSeekInFlight || pendingVideoProgress === null) return;

  const duration = heroVideo.duration;
  if (!Number.isFinite(duration) || duration <= 0) return;

  const progress = pendingVideoProgress;
  const time = Math.max(0, Math.min(duration - 0.001, progress * duration));

  if (Math.abs(heroVideo.currentTime - time) <= VIDEO_SEEK_EPS) {
    renderedVideoTime = heroVideo.currentTime;
    pendingVideoProgress = null;
    return;
  }

  videoSeekInFlight = true;
  await seekVideoTo(heroVideo, time);
  renderedVideoTime = heroVideo.currentTime;
  videoSeekInFlight = false;

  if (
    pendingVideoProgress !== null &&
    Math.abs(pendingVideoProgress - progress) > 0.0001
  ) {
    pumpVideoSeek();
    return;
  }

  pendingVideoProgress = null;
}

function scrubVideoAt(progress) {
  if (!heroVideo || heroVideo.readyState < 2) return;
  pendingVideoProgress = progress;
  pumpVideoSeek();
}

function findBestLoadedIndex(targetIndex) {
  if (isFrameReady(targetIndex)) return targetIndex;

  const maxDist = Math.min(frameCount, MAX_FRAMES_IN_MEMORY);
  for (let d = 1; d <= maxDist; d++) {
    const lo = targetIndex - d;
    const hi = targetIndex + d;
    if (lo >= 0 && isFrameReady(lo)) return lo;
    if (hi < frameCount && isFrameReady(hi)) return hi;
  }

  return -1;
}

function drawFrameAt(progress) {
  if (!viewW) return;
  if (!useVideoMode && !frameCount) return;

  if (useVideoMode) {
    lastRenderedProgress = progress;
    scrubVideoAt(progress);
    return;
  }

  const { lower, upper, blend } = getFrameBlendFromProgress(progress);
  const canDraw =
    isFrameReady(lower) ||
    isFrameReady(upper) ||
    findBestLoadedIndex(lower) >= 0;

  if (!canDraw) return;

  lastRenderedProgress = progress;
  drawBlendedFrames(lower, upper, blend);
}

let lastUiProgress = -1;

function markScrolling() {
  chamber?.classList.add("is-scrolling");
  clearTimeout(scrollIdleTimer);
  scrollIdleTimer = setTimeout(() => {
    chamber?.classList.remove("is-scrolling");
  }, 150);
}

function updateChamberStyles(progress) {
  if (Math.abs(progress - lastUiProgress) < 0.004 && lastUiProgress >= 0) return;
  lastUiProgress = progress;

  const root = document.documentElement;
  const p = progress.toFixed(4);
  root.style.setProperty("--scroll-progress", p);
  root.style.setProperty("--parallax-1", `${progress * -14}px`);
  root.style.setProperty("--parallax-2", `${progress * -26}px`);
  root.style.setProperty("--parallax-3", `${progress * -40}px`);
  root.style.setProperty("--key-intensity", String(0.32 + progress * 0.28));
  root.style.setProperty("--rim-intensity", String(0.38 + Math.sin(progress * Math.PI) * 0.2));
  root.style.setProperty("--accent-angle", `${120 + progress * 120}deg`);

}

function getActivePhaseId(progress) {
  const p = Math.max(0, Math.min(1, progress));
  for (let i = 0; i < phases.length; i++) {
    const phase = phases[i];
    const isLast = i === phases.length - 1;
    if (p >= phase.start && (isLast ? p <= phase.end : p < phase.end)) {
      return phase.id;
    }
  }
  return phases[0].id;
}

function applyStoryContent(phaseId) {
  const data = STORY_CONTENT[phaseId];
  if (!data) return;

  if (storyEyebrow) {
    if (data.eyebrow) {
      storyEyebrow.textContent = data.eyebrow;
      storyEyebrow.hidden = false;
    } else {
      storyEyebrow.textContent = "";
      storyEyebrow.hidden = true;
    }
  }

  if (storyTitle) storyTitle.textContent = data.title;

  if (storyCopy) {
    if (data.copy) {
      storyCopy.textContent = data.copy;
      storyCopy.hidden = false;
    } else {
      storyCopy.textContent = "";
      storyCopy.hidden = true;
    }
  }
}

function updateStoryClock() {
  if (!storyClock) return;
  storyClock.textContent = buddyAwakened ? "scroll ↓" : BUDDY_WAKE_MESSAGE;
}

function showBuddyWakeState() {
  buddyAwakened = false;
  currentStoryPhase = null;
  storyCard?.classList.add("is-buddy-sleeping");
  if (storyTextWrap) storyTextWrap.hidden = true;
  updateStoryClock();
}

function awakenBuddy(progress) {
  if (buddyAwakened) return;
  buddyAwakened = true;
  storyCard?.classList.remove("is-buddy-sleeping");
  if (storyTextWrap) storyTextWrap.hidden = false;
  currentStoryPhase = null;
  updateStoryClock();
  updateStoryPanels(progress);
}

function maybeAwakenBuddy(progress) {
  if (buddyAwakened || progress <= 0.001) return;
  awakenBuddy(progress);
}

function startStoryClock() {
  showBuddyWakeState();
}

function setStoryPhase(phaseId) {
  if (phaseId === currentStoryPhase) return;

  clearTimeout(storyChangeTimer);

  if (currentStoryPhase === null) {
    currentStoryPhase = phaseId;
    applyStoryContent(phaseId);
    return;
  }

  storyCard?.classList.add("is-text-changing");
  storyChangeTimer = setTimeout(() => {
    applyStoryContent(phaseId);
    currentStoryPhase = phaseId;
    storyCard?.classList.remove("is-text-changing");
  }, 220);
}

function updateStoryPanels(progress) {
  setStoryPhase(getActivePhaseId(progress));
}

function renderFrame(progress) {
  currentProgress = progress;
  targetProgress = progress;
  drawFrameAt(progress);
}

function renderUi(progress) {
  maybeAwakenBuddy(progress);
  updateChamberStyles(progress);
  if (buddyAwakened) updateStoryPanels(progress);
}

function queueRender(progress) {
  targetProgress = progress;
  if (!useVideoMode) {
    const { lower, upper } = getFrameBlendFromProgress(progress);
    prefetchAroundBlend(lower, upper);
  }
  markScrolling();
  if (renderQueued) return;
  renderQueued = true;
  requestAnimationFrame(() => {
    renderQueued = false;
    renderFrame(targetProgress);
    renderUi(targetProgress);
  });
}

function setupLenis() {
  if (typeof Lenis === "undefined") return null;

  const instance = new Lenis({
    duration: 1.05,
    easing: (t) => 1 - Math.pow(1 - t, 3),
    smoothWheel: true,
    wheelMultiplier: 0.9,
    touchMultiplier: 1.4,
    infinite: false,
  });

  instance.on("scroll", ScrollTrigger.update);

  gsap.ticker.add((time) => {
    instance.raf(time * 1000);
  });
  gsap.ticker.lagSmoothing(0);

  return instance;
}

function setupScrollTrigger() {
  gsap.registerPlugin(ScrollTrigger);

  const section = $(`#${SCROLL_SECTION_ID}`);
  if (!section) return;

  ScrollTrigger.scrollerProxy(document.documentElement, {
    scrollTop(value) {
      if (arguments.length) {
        if (lenis) lenis.scrollTo(value, { immediate: true });
        else window.scrollTo(0, value);
      }
      return lenis ? lenis.scroll : window.scrollY;
    },
    getBoundingClientRect() {
      return {
        top: 0,
        left: 0,
        width: window.innerWidth,
        height: window.innerHeight,
      };
    },
  });

  ScrollTrigger.create({
    trigger: section,
    start: "top top",
    end: "bottom bottom",
    scrub: true,
    invalidateOnRefresh: true,
    onUpdate: (self) => {
      queueRender(self.progress);
    },
  });

  ScrollTrigger.addEventListener("refreshInit", () => {
    fitCanvas();
    renderedVideoTime = -1;
    lastRenderedProgress = -1;
    pendingVideoProgress = null;
    videoSeekInFlight = false;
    drawFrameAt(currentProgress);
  });
}

function bindScroll() {
  if (typeof gsap !== "undefined" && typeof ScrollTrigger !== "undefined") {
    lenis = setupLenis();
    window.iyyoLenis = lenis;
    setupScrollTrigger();
    ScrollTrigger.refresh();
  } else {
    window.addEventListener(
      "scroll",
      () => {
        const section = $(`#${SCROLL_SECTION_ID}`);
        if (!section) return;
        const scrollable = section.offsetHeight - window.innerHeight;
        const progress = Math.max(0, Math.min(1, -section.getBoundingClientRect().top / scrollable));
        queueRender(progress);
      },
      { passive: true }
    );
  }
}

function applyScrollTrackHeight() {
  const section = $(`#${SCROLL_SECTION_ID}`);
  if (!section) return;

  const units = useVideoMode
    ? Math.round((heroVideo?.duration || 8) * 28)
    : frameCount;

  if (!units) return;

  const vh = Math.min(
    SCROLL_MAX_VH,
    Math.max(SCROLL_MIN_VH, Math.round(units * SCROLL_VH_PER_FRAME))
  );
  section.style.height = `${vh}vh`;
}

function forceScrollTop() {
  if (typeof history !== "undefined" && "scrollRestoration" in history) {
    history.scrollRestoration = "manual";
  }
  window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  if (lenis) lenis.scrollTo(0, { immediate: true });
}

function resetToFirstFrame() {
  currentProgress = 0;
  targetProgress = 0;
  lastRenderedProgress = -1;
  renderedVideoTime = -1;
  pendingVideoProgress = null;
  videoSeekInFlight = false;
  lastPrefetchLower = -1;
  lastPrefetchUpper = -1;
  lastUiProgress = -1;
  currentStoryPhase = null;
  clearTimeout(storyChangeTimer);
  storyCard?.classList.remove("is-text-changing");
  forceScrollTop();
  if (useVideoMode && heroVideo) {
    heroVideo.pause();
    heroVideo.currentTime = 0;
  }
  drawFrameAt(0);
  updateChamberStyles(0);
  if (buddyAwakened) {
    currentStoryPhase = null;
    updateStoryPanels(0);
  } else {
    showBuddyWakeState();
  }
}

function revealExperience() {
  loader.classList.add("is-done");
  loader.setAttribute("aria-busy", "false");
  main.classList.remove("hidden");
  chamber?.classList.add("is-ready");
  experienceReady = true;
  startStoryClock();

  applyScrollTrackHeight();
  fitCanvas();
  forceScrollTop();

  requestAnimationFrame(() => {
    bindScroll();
    resetToFirstFrame();
    ScrollTrigger?.refresh(true);
  });
}

async function init() {
  if (typeof history !== "undefined" && "scrollRestoration" in history) {
    history.scrollRestoration = "manual";
  }
  if (location.hash) {
    history.replaceState(null, "", location.pathname + location.search);
  }
  forceScrollTop();
  main?.classList.remove("hidden");

  try {
    await runBootHeader();
    await loadManifest();
    await delay(200);
    await bootstrapMedia();
    await finishBootSequence();
    revealExperience();
  } catch (err) {
    console.error(err);
    termLine(`[ERR] ${err.message}`, "warn");
    termLine("[ERR] Load failed — refresh to retry.", "warn");
  }
}

let resizeTimer;
window.addEventListener(
  "resize",
  () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      if (!experienceReady) return;
      fitCanvas();
      lastRenderedProgress = -1;
      renderedVideoTime = -1;
      drawFrameAt(currentProgress);
      ScrollTrigger?.refresh();
    }, 150);
  },
  { passive: true }
);

window.addEventListener("pageshow", (event) => {
  if (!experienceReady) return;
  if (event.persisted) {
    resetToFirstFrame();
    requestAnimationFrame(() => {
      ScrollTrigger?.refresh(true);
      resetToFirstFrame();
    });
  }
});

init();
