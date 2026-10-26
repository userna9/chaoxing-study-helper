/*
Font feature recognition helpers adapted from OCS 网课助手 v5.2.1.
Copyright (c) enncy. MIT License.
Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:
The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.
THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
*/
  const refTableCache = /* @__PURE__ */ new Map();
  function unpackBits(packed, offset, count2, dims) {
    const bytesPerGlyph = dims / 8;
    const out = new Uint8Array(count2 * dims);
    for (let i = 0; i < count2; i++) {
      const pBase = offset + i * bytesPerGlyph;
      const oBase = i * dims;
      for (let b = 0; b < bytesPerGlyph; b++) {
        const byte = packed[pBase + b];
        for (let k = 0; k < 8; k++) {
          out[oBase + b * 8 + k] = byte >> 7 - k & 1;
        }
      }
    }
    return out;
  }
  function loadRefTable(url) {
    let cached = refTableCache.get(url);
    if (!cached) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 3e4);
      cached = fetch(url, { signal: controller.signal, credentials: "omit" }).then((r) => { if (!r.ok) throw new Error("字形表下载失败 HTTP " + r.status); return r.arrayBuffer(); }).then((buf) => {
        const dv = new DataView(buf);
        const magic = String.fromCharCode(dv.getUint8(0), dv.getUint8(1), dv.getUint8(2), dv.getUint8(3));
        if (magic !== "FRB2") {
          throw new Error("[font-decrypt] 无效的特征表格式: " + magic);
        }
        const count2 = dv.getUint32(4, true);
        const threshold = dv.getUint32(8, true);
        const gc = dv.getUint32(12, true);
        const gf = dv.getUint32(16, true);
        if (!count2 || count2 > 100000 || ![gc,gf].every(n => Number.isInteger(n) && n > 0 && n <= 64 && 480 % n === 0 && n*n % 8 === 0) || 20 + count2 * (4 + (gc*gc + gf*gf)/8) > buf.byteLength) throw new Error("无效的字形表长度");
        const cps = new Uint32Array(count2);
        let off = 20;
        for (let i = 0; i < count2; i++, off += 4) {
          cps[i] = dv.getUint32(off, true);
        }
        const packed = new Uint8Array(buf);
        const coarse = unpackBits(packed, off, count2, gc * gc);
        off += count2 * gc * gc / 8;
        const fine = unpackBits(packed, off, count2, gf * gf);
        return { count: count2, cps, coarse, fine, gc, gf, threshold };
      });
      cached = cached.then((table) => {
        clearTimeout(timer);
        return table;
      }).catch((err) => {
        clearTimeout(timer);
        refTableCache.delete(url);
        throw err;
      });
      refTableCache.set(url, cached);
    }
    return cached;
  }
  const RENDER = 360;
  const SQ = 480;
  const BASELINE = 384;
  const SHORTLIST = 40;
  const INK_THRESHOLD = 40;
  let renderCanvas;
  function getRenderCanvas() {
    if (!renderCanvas) {
      const cv = document.createElement("canvas");
      cv.width = SQ;
      cv.height = SQ;
      renderCanvas = { cv, ctx: cv.getContext("2d", { willReadFrequently: true }) };
    }
    return renderCanvas;
  }
  function renderGlyph(fontFamily, ch, table) {
    const { ctx } = getRenderCanvas();
    ctx.clearRect(0, 0, SQ, SQ);
    ctx.fillStyle = "#fff";
    ctx.font = `${RENDER}px "${fontFamily}"`;
    ctx.textBaseline = "alphabetic";
    const advance = ctx.measureText(ch).width;
    ctx.fillText(ch, (SQ - advance) / 2, BASELINE);
    const px = ctx.getImageData(0, 0, SQ, SQ).data;
    let hasInk = false;
    for (let i = 3; i < px.length; i += 4) {
      if (px[i] > INK_THRESHOLD) {
        hasInk = true;
        break;
      }
    }
    if (!hasInk) {
      return null;
    }
    const W = SQ + 1;
    const ii = new Uint32Array(W * W);
    for (let y = 0; y < SQ; y++) {
      let rowSum = 0;
      const srcRow = y * SQ * 4;
      const dstRow = (y + 1) * W;
      const upRow = y * W;
      for (let x = 0; x < SQ; x++) {
        rowSum += px[srcRow + x * 4 + 3];
        ii[dstRow + x + 1] = ii[upRow + x + 1] + rowSum;
      }
    }
    const box = (n) => {
      const b = SQ / n;
      const area = b * b;
      const out = new Uint8Array(n * n);
      for (let gy = 0; gy < n; gy++) {
        for (let gx = 0; gx < n; gx++) {
          const y0 = gy * b;
          const x0 = gx * b;
          const sum = ii[(y0 + b) * W + x0 + b] - ii[y0 * W + x0 + b] - ii[(y0 + b) * W + x0] + ii[y0 * W + x0];
          out[gy * n + gx] = sum / area > table.threshold ? 1 : 0;
        }
      }
      return out;
    };
    return { coarse: box(table.gc), fine: box(table.gf) };
  }
  const coverageCanvasCache = {};
  function isCoveredByFont(fontFamily, ch) {
    const render2 = (fallback) => {
      var _a;
      const key = fontFamily + "|" + fallback;
      const cv = (_a = coverageCanvasCache[key]) != null ? _a : coverageCanvasCache[key] = (() => {
        const c = document.createElement("canvas");
        c.width = 200;
        c.height = 200;
        return c;
      })();
      const ctx = cv.getContext("2d", { willReadFrequently: true });
      ctx.clearRect(0, 0, 200, 200);
      ctx.fillStyle = "#fff";
      ctx.font = `120px "${fontFamily}", ${fallback}`;
      ctx.textBaseline = "middle";
      ctx.fillText(ch, 10, 100);
      return ctx.getImageData(0, 0, 200, 200).data;
    };
    const a = render2("serif");
    const b = render2("sans-serif");
    let diff = 0;
    for (let i = 3; i < a.length; i += 4) {
      diff += Math.abs(a[i] - b[i]);
    }
    return diff < 1e3;
  }
  function bitDistance(tableArr, idx, dims, q) {
    let s = 0;
    const base = idx * dims;
    for (let i = 0; i < dims; i++) {
      if (tableArr[base + i] !== q[i]) {
        s++;
      }
    }
    return s;
  }
  function crackChar(table, feat) {
    const { count: count2, cps, coarse, fine, gc, gf } = table;
    const dists = new Float64Array(count2);
    for (let i = 0; i < count2; i++) {
      dists[i] = bitDistance(coarse, i, gc * gc, feat.coarse);
    }
    const sorted = Float64Array.from(dists);
    sorted.sort();
    const threshold = sorted[Math.min(SHORTLIST, count2) - 1];
    const idx = [];
    for (let i = 0; i < count2; i++) {
      if (dists[i] <= threshold) {
        idx.push(i);
      }
    }
    let bestI = -1;
    let best = Infinity;
    let second = Infinity;
    for (let k = 0; k < idx.length; k++) {
      const i = idx[k];
      const d = bitDistance(fine, i, gf * gf, feat.fine);
      if (d < best) {
        second = best;
        best = d;
        bestI = i;
      } else if (d < second) {
        second = d;
      }
    }
    return {
      ch: String.fromCodePoint(cps[bestI]),
      best,
      second,
      margin: second > 0 ? 1 - best / second : 1
    };
  }
  function extractFontFromStyle(doc, fontFamilyMarker) {
    var _a, _b;
    const styleEl = Array.from(doc.head.querySelectorAll("style")).find((s) => {
      var _a2;
      return (_a2 = s.textContent) == null ? void 0 : _a2.includes(fontFamilyMarker);
    });
    const base64 = (_b = (_a = styleEl == null ? void 0 : styleEl.textContent) == null ? void 0 : _a.match(/base64,([\w\W]+?)['")]/)) == null ? void 0 : _b[1];
    if (!base64) {
      return void 0;
    }
    const raw = window.atob(base64);
    const buffer = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) {
      buffer[i] = raw.charCodeAt(i);
    }
    return buffer.buffer;
  }

