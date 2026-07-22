/**
 * Meshy API client for Image-to-3D (smart-topology) + remesh + download.
 * Docs: https://docs.meshy.ai/en/api/image-to-3d
 */

const MESHY_BASE = 'https://api.meshy.ai/openapi/v1';

const DEFAULT_IMAGE_TO_3D = {
  model_type: 'smart-topology',
  ai_model: 'meshy-t2',
  // Keep textured GLBs under ~10MB for LiveSet
  target_polycount: 6000,
  should_texture: true,
  enable_pbr: true,
  auto_size: true,
  origin_at: 'bottom',
};

function getApiKey(explicit) {
  const key = explicit || process.env.MESHY_API_KEY;
  if (!key) throw new Error('MESHY_API_KEY is required');
  return key;
}

async function meshyFetch(path, { method = 'GET', body, apiKey } = {}) {
  const key = getApiKey(apiKey);
  const res = await fetch(`${MESHY_BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${key}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }
  if (!res.ok) {
    const err = new Error(`Meshy ${method} ${path} → ${res.status}: ${text.slice(0, 400)}`);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

/**
 * Create Image-to-3D task. imageUrl may be https URL or data URI.
 * @returns {Promise<string>} task id
 */
async function createImageTo3dTask(imageUrl, overrides = {}, apiKey) {
  const body = {
    ...DEFAULT_IMAGE_TO_3D,
    ...overrides,
    image_url: imageUrl,
  };
  const data = await meshyFetch('/image-to-3d', { method: 'POST', body, apiKey });
  const id = data.result || data.id;
  if (!id) throw new Error(`Meshy create missing task id: ${JSON.stringify(data)}`);
  return id;
}

async function getImageTo3dTask(taskId, apiKey) {
  return meshyFetch(`/image-to-3d/${taskId}`, { apiKey });
}

/**
 * Poll until SUCCEEDED / FAILED.
 * @returns {Promise<object>} final task object
 */
async function waitForTask(taskId, {
  apiKey,
  intervalMs = 8000,
  timeoutMs = 20 * 60 * 1000,
  getTask = getImageTo3dTask,
} = {}) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const task = await getTask(taskId, apiKey);
    const status = task.status;
    if (status === 'SUCCEEDED') return task;
    if (status === 'FAILED' || status === 'CANCELED') {
      const err = new Error(`Meshy task ${taskId} ${status}: ${task.task_error?.message || ''}`);
      err.task = task;
      throw err;
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error(`Meshy task ${taskId} timed out after ${timeoutMs}ms`);
}

async function createRemeshTask(inputTaskId, overrides = {}, apiKey) {
  const body = {
    input_task_id: inputTaskId,
    target_formats: ['glb'],
    topology: 'triangle',
    target_polycount: 8000,
    origin_at: 'bottom',
    ...overrides,
  };
  const data = await meshyFetch('/remesh', { method: 'POST', body, apiKey });
  const id = data.result || data.id;
  if (!id) throw new Error(`Meshy remesh missing task id: ${JSON.stringify(data)}`);
  return id;
}

async function getRemeshTask(taskId, apiKey) {
  return meshyFetch(`/remesh/${taskId}`, { apiKey });
}

async function waitForRemesh(taskId, opts = {}) {
  return waitForTask(taskId, { ...opts, getTask: getRemeshTask });
}

/**
 * Download a URL to Buffer.
 */
async function downloadBinary(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download failed ${res.status}: ${url}`);
  const ab = await res.arrayBuffer();
  return Buffer.from(ab);
}

function pickGlbUrl(task) {
  return (
    task.model_urls?.glb ||
    task.model_urls?.['glb'] ||
    task.model_url ||
    task.output?.model_urls?.glb ||
    task.result?.model_urls?.glb ||
    null
  );
}

function pickThumbnailUrl(task) {
  return (
    task.thumbnail_url ||
    task.thumbnail_urls?.['512'] ||
    task.thumbnail_urls?.['256'] ||
    null
  );
}

/**
 * Remesh with aggressive decimation. Prefer smaller output than input.
 */
async function remeshUntilSmallEnough(inputTaskId, currentBuffer, {
  apiKey,
  maxBytes = 10 * 1024 * 1024,
  polycounts = [5000, 3000, 2000],
} = {}) {
  let best = { buffer: currentBuffer, taskId: null, glbUrl: null, thumbnailUrl: null };
  for (const target_polycount of polycounts) {
    console.log(`  Remesh attempt @ ${target_polycount} faces…`);
    const remeshId = await createRemeshTask(
      inputTaskId,
      {
        target_polycount,
        topology: 'triangle',
      },
      apiKey
    );
    const remeshTask = await waitForRemesh(remeshId, { apiKey });
    const glbUrl = pickGlbUrl(remeshTask);
    if (!glbUrl) {
      console.warn('  Remesh returned no GLB URL, continuing…');
      continue;
    }
    const buffer = await downloadBinary(glbUrl);
    const mb = (buffer.length / (1024 * 1024)).toFixed(2);
    console.log(`  Remesh result: ${mb}MB`);
    if (buffer.length < best.buffer.length) {
      best = {
        buffer,
        taskId: remeshId,
        glbUrl,
        thumbnailUrl: pickThumbnailUrl(remeshTask),
      };
    }
    if (buffer.length <= maxBytes) {
      return { ...best, ok: true };
    }
  }

  // Last resort: adaptive low decimation
  console.log('  Remesh attempt @ adaptive low (decimation_mode 4)…');
  try {
    const remeshId = await createRemeshTask(
      inputTaskId,
      { topology: 'triangle', decimation_mode: 4 },
      apiKey
    );
    const remeshTask = await waitForRemesh(remeshId, { apiKey });
    const glbUrl = pickGlbUrl(remeshTask);
    if (glbUrl) {
      const buffer = await downloadBinary(glbUrl);
      console.log(`  Remesh result: ${(buffer.length / (1024 * 1024)).toFixed(2)}MB`);
      if (buffer.length < best.buffer.length) {
        best = {
          buffer,
          taskId: remeshId,
          glbUrl,
          thumbnailUrl: pickThumbnailUrl(remeshTask),
        };
      }
      if (buffer.length <= maxBytes) return { ...best, ok: true };
    }
  } catch (err) {
    console.warn(`  Adaptive remesh failed: ${err.message}`);
  }

  return {
    ...best,
    ok: best.buffer.length <= maxBytes,
  };
}

module.exports = {
  DEFAULT_IMAGE_TO_3D,
  createImageTo3dTask,
  getImageTo3dTask,
  waitForTask,
  createRemeshTask,
  getRemeshTask,
  waitForRemesh,
  remeshUntilSmallEnough,
  downloadBinary,
  pickGlbUrl,
  pickThumbnailUrl,
  meshyFetch,
};
