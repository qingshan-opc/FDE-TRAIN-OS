#!/usr/bin/env node
/**
 * Generate landing story strip videos via Agnes (image -> image-to-video).
 * Usage: node web/scripts/generate-landing-story-videos.mjs [--force] [--agnes-only] [--slide=story-task]
 * Env: AGNES_API_KEY or sibling deploy/.env
 */
import { createWriteStream, existsSync, readFileSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(__dirname, '..');
const outDir = path.join(webRoot, 'public', 'landing');
const force = process.argv.includes('--force');
const agnesOnly = process.argv.includes('--agnes-only');
const videoOnly = process.argv.includes('--video-only');
const slideArg = process.argv.find((a) => a.startsWith('--slide='));
const slideFilter = slideArg ? slideArg.split('=')[1] : null;
const videoIdArg = process.argv.find((a) => a.startsWith('--video-id='));
const resumeVideoId = videoIdArg ? videoIdArg.split('=')[1] : null;

const NO_TEXT =
  'CRITICAL: absolutely no text, no letters, no words, no typography, no captions, no logos, no watermark';

const SLIDES = [
  {
    id: 'story-task',
    imagePrompt:
      `Cinematic documentary photograph of a professional digital training workshop in China, young professionals collaborating around laptops with a task board showing deliverable milestones, teal accent lighting, warm natural light, premium corporate education brand film still, photorealistic. ${NO_TEXT}`,
    videoPrompt:
      'Very slow cinematic push-in on a modern training workshop, professionals subtly collaborating, soft natural light, calm premium brand film, seamless loop feel, no people looking at camera, no text',
    title: '任务驱动课纲',
  },
  {
    id: 'story-agent',
    imagePrompt:
      `Cinematic photo of an AI agent training lab, developer in an isolated workspace with multiple monitors showing agent workflow and code, elegant dark UI glow with teal accents, professional tech education atmosphere. ${NO_TEXT}`,
    videoPrompt:
      'Slow subtle camera drift across an AI agent training lab, monitor glow gently pulsing, calm focused tech education mood, seamless loop feel, no text, no watermark',
    title: 'Agent 实训环境',
  },
  {
    id: 'story-cert',
    imagePrompt:
      `Professional enterprise training graduation scene, trainer and trainee reviewing a digital certificate on a tablet, evidence dashboard on screen in background, warm trustworthy corporate education mood, teal palette. ${NO_TEXT}`,
    videoPrompt:
      'Gentle cinematic pan in a modern training room, trainer and trainee reviewing digital certificate on tablet, warm natural light, trustworthy corporate education film, seamless loop feel, no text',
    title: '可核验结业证书',
  },
];

function loadApiKey() {
  if (process.env.AGNES_API_KEY?.trim()) return process.env.AGNES_API_KEY.trim();
  for (const envPath of [
    path.join(webRoot, '..', '.env'),
    path.join(webRoot, '..', '..', 'litu-miniapp', 'deploy', 'runtime.env'),
    path.join(webRoot, '..', '..', 'digital-lingzhi-platform', 'deploy', '.env'),
  ]) {
    if (!existsSync(envPath)) continue;
    const m = readFileSync(envPath, 'utf8').match(/^AGNES_API_KEY=(.+)$/m);
    if (m?.[1]?.trim()) return m[1].trim();
  }
  const cfgPath = path.join(os.homedir(), '.anycode', 'config.json');
  if (existsSync(cfgPath)) {
    try {
      const cfg = JSON.parse(readFileSync(cfgPath, 'utf8'));
      const key = cfg?.provider_credentials?.agnes;
      if (typeof key === 'string' && key.trim()) return key.trim();
    } catch { /* ignore */ }
  }
  return '';
}

async function download(url, destination) {
  const res = await fetch(url);
  if (!res.ok || !res.body) throw new Error(`download ${res.status}`);
  await mkdir(path.dirname(destination), { recursive: true });
  const stream = createWriteStream(destination);
  await new Promise((resolve, reject) => {
    res.body.pipeTo(
      new WritableStream({
        write(chunk) { stream.write(Buffer.from(chunk)); },
        close() { stream.end(resolve); },
        abort(reason) { stream.destroy(reason); reject(reason); },
      }),
    ).catch(reject);
  });
}

async function sleep(ms) {
  await new Promise((r) => setTimeout(r, ms));
}

async function fetchWithRetry(url, options, label, attempts = 10) {
  let lastErr = null;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const res = await fetch(url, options);
      const text = await res.text();
      let data;
      try { data = JSON.parse(text); } catch { data = { raw: text }; }
      if (res.ok) return { res, data, text };
      const busy =
        res.status === 503 ||
        res.status === 429 ||
        text.includes('busy') ||
        text.includes('Unavailable') ||
        text.includes('video_queue_full');
      if (busy && attempt < attempts - 1) {
        const wait = text.includes('video_queue_full')
          ? 60000 + attempt * 30000
          : 15000 + attempt * 10000;
        console.warn(`[${label}] ${res.status} busy, retry in ${Math.round(wait / 1000)}s...`);
        await sleep(wait);
        continue;
      }
      throw new Error(`${label} ${res.status}: ${text.slice(0, 300)}`);
    } catch (err) {
      lastErr = err;
      if (attempt < attempts - 1) {
        await sleep(5000 + attempt * 3000);
        continue;
      }
    }
  }
  throw lastErr || new Error(`${label} failed`);
}

async function preflight(apiKey) {
  console.log(`Agnes key loaded (${apiKey.slice(0, 7)}…)`);
}

async function agnesJson(url, options, label = 'agnes') {
  const { data } = await fetchWithRetry(url, options, label, 10);
  return data;
}

function extractVideoUrl(result) {
  for (const key of ['remixed_from_video_id', 'video_url', 'url']) {
    const v = result?.[key];
    if (typeof v === 'string' && v.startsWith('http')) return v;
  }
  return null;
}

function ffmpegKenBurns(pngPath, mp4Path, seconds = 6) {
  const frames = seconds * 24;
  const vf = [
    'scale=1152:648:force_original_aspect_ratio=increase',
    'crop=1152:648',
    `zoompan=z='min(zoom+0.0012,1.06)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${frames}:s=1152x648:fps=24`,
  ].join(',');
  const r = spawnSync(
    'ffmpeg',
    ['-y', '-loop', '1', '-i', pngPath, '-vf', vf, '-t', String(seconds), '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', mp4Path],
    { stdio: 'inherit' },
  );
  if (r.status !== 0) throw new Error(`ffmpeg failed for ${path.basename(mp4Path)}`);
}

function extractPosterFromVideo(mp4Path, pngPath) {
  const r = spawnSync(
    'ffmpeg',
    ['-y', '-i', mp4Path, '-ss', '00:00:00.5', '-vframes', '1', '-update', '1', '-q:v', '2', pngPath],
    { stdio: 'inherit' },
  );
  if (r.status !== 0) throw new Error(`ffmpeg poster extract failed for ${path.basename(mp4Path)}`);
}

async function generatePoster(apiKey, slide, pngPath) {
  try {
    console.log(`[${slide.id}] generating poster...`);
    const img = await agnesJson(
      'https://apihub.agnes-ai.com/v1/images/generations',
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'agnes-image-2.1-flash',
          prompt: slide.imagePrompt,
          size: '1152x648',
          extra_body: { response_format: 'url' },
        }),
      },
      `${slide.id}-image`,
    );
    const imageUrl = img?.data?.[0]?.url;
    if (!imageUrl) throw new Error(`no poster url for ${slide.id}`);
    await download(imageUrl, pngPath);
    return imageUrl;
  } catch (err) {
    console.warn(`[${slide.id}] poster skipped (${err.message}), using text-to-video`);
    return null;
  }
}

async function createVideoTask(apiKey, slide, imageUrl) {
  const payload = {
    model: 'agnes-video-v2.0',
    prompt: slide.videoPrompt,
    width: 1152,
    height: 648,
    num_frames: 81,
    frame_rate: 24,
    negative_prompt: 'watermark, text, logo, distorted geometry, flicker',
  };
  if (imageUrl) payload.image = imageUrl;

  console.log(`[${slide.id}] creating video task (${imageUrl ? 'image-to-video' : 'text-to-video'})...`);
  for (let attempt = 0; attempt < 24; attempt += 1) {
    try {
      const { data: task } = await fetchWithRetry(
        'https://apihub.agnes-ai.com/v1/videos',
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        },
        `${slide.id}-video-create`,
        8,
      );
      const videoId = task.video_id || task.id || task.task_id;
      if (videoId) return videoId;
    } catch (err) {
      const retryable = /503|429|busy|video_queue_full/i.test(err.message);
      if (!retryable || attempt >= 23) throw err;
      const wait = 60000 + attempt * 20000;
      console.warn(`[${slide.id}] video queue wait ${Math.round(wait / 1000)}s (${attempt + 1}/24)...`);
      await sleep(wait);
    }
  }
  throw new Error('video queue busy');
}

async function pollVideo(apiKey, slide, videoId, mp4Path, pngPath, refreshPoster = false) {
  console.log(`[${slide.id}] polling ${videoId}...`);
  for (let attempt = 0; attempt < 120; attempt += 1) {
    await sleep(15000 + (attempt % 4) * 5000);
    const res = await fetch(
      `https://apihub.agnes-ai.com/agnesapi?video_id=${encodeURIComponent(videoId)}&model_name=agnes-video-v2.0`,
      { headers: { Authorization: `Bearer ${apiKey}` } },
    );
    const text = await res.text();
    let result = {};
    try { result = JSON.parse(text); } catch { result = { raw: text }; }
    if (result?.error?.code === 429) {
      console.warn(`[${slide.id}] rate limited, wait 45s...`);
      await sleep(45000);
      continue;
    }
    const status = result.status || result?.data?.status || result.internal_status;
    if (status && status !== 'queued') console.log(`[${slide.id}] ${status}`);
    if (status === 'failed' || status === 'error') throw new Error(JSON.stringify(result.error || result).slice(0, 300));
    const url = extractVideoUrl(result);
    if ((status === 'completed' || result.internal_status === 'completed') && url) {
      await download(url, mp4Path);
      if (refreshPoster || !existsSync(pngPath)) extractPosterFromVideo(mp4Path, pngPath);
      return { id: slide.id, png: `/landing/${slide.id}.png`, mp4: `/landing/${slide.id}.mp4`, source: 'agnes' };
    }
  }
  throw new Error('video timed out');
}

async function generateSlide(apiKey, slide) {
  const pngPath = path.join(outDir, `${slide.id}.png`);
  const mp4Path = path.join(outDir, `${slide.id}.mp4`);
  if (!force && existsSync(mp4Path) && existsSync(pngPath)) {
    console.log(`skip ${slide.id} (exists)`);
    return { id: slide.id, png: `/landing/${slide.id}.png`, mp4: `/landing/${slide.id}.mp4`, source: 'cached' };
  }

  if (!apiKey) throw new Error('AGNES_API_KEY missing');

  let imageUrl = null;
  if (videoOnly && existsSync(pngPath)) {
    console.log(`[${slide.id}] reusing poster on disk, text-to-video`);
  } else {
    imageUrl = await generatePoster(apiKey, slide, pngPath);
  }

  const videoId = resumeVideoId || (await createVideoTask(apiKey, slide, imageUrl));
  return pollVideo(apiKey, slide, videoId, mp4Path, pngPath, !imageUrl);
}

async function main() {
  await mkdir(outDir, { recursive: true });
  const apiKey = loadApiKey();
  if (!apiKey) throw new Error('AGNES_API_KEY missing — add to digital-fde-platform/.env or export AGNES_API_KEY');
  await preflight(apiKey);
  console.log('Agnes preflight OK');

  const slides = slideFilter ? SLIDES.filter((s) => s.id === slideFilter) : SLIDES;
  if (slides.length === 0) throw new Error(`unknown slide: ${slideFilter}`);

  const manifest = { slides: [], generated_at: new Date().toISOString() };
  let usedFallback = false;

  for (const slide of slides) {
    const pngPath = path.join(outDir, `${slide.id}.png`);
    const mp4Path = path.join(outDir, `${slide.id}.mp4`);
    try {
      manifest.slides.push({ ...await generateSlide(apiKey, slide), title: slide.title });
      if (slides.indexOf(slide) < slides.length - 1) {
        console.log(`[${slide.id}] done, cooling down 90s before next slide...`);
        await sleep(90000);
      }
    } catch (err) {
      if (agnesOnly) throw err;
      console.warn(`[${slide.id}] Agnes failed (${err.message}), ffmpeg fallback...`);
      if (!existsSync(pngPath)) throw err;
      ffmpegKenBurns(pngPath, mp4Path);
      usedFallback = true;
      manifest.slides.push({ id: slide.id, png: `/landing/${slide.id}.png`, mp4: `/landing/${slide.id}.mp4`, source: 'ffmpeg-kenburns' });
    }
  }

  manifest.note = usedFallback
    ? 'Partial fallback used (ffmpeg Ken Burns). Re-run with --agnes-only to regenerate via Agnes.'
    : 'Generated via Agnes video API (image-to-video or text-to-video)';
  await writeFile(path.join(outDir, 'story-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(JSON.stringify(manifest, null, 2));
}

main().catch((err) => { console.error('FAILED:', err.message); process.exit(1); });
