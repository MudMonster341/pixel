// Offline-bundle shim (ADR 0017, docs/OFFLINE_BUNDLE.md). Loaded ONLY by the bundle's index.html that
// tools/pack-offline.js writes -- the normal dev/electron index.html never includes it, so `npm start`
// is untouched.
//
// Why it exists: a page opened by double-click runs from file://, where browsers refuse XHR/fetch of
// local files (Phaser's loader uses XHR for maps, JSON and audio) and treat file:// images as
// cross-origin (WebGL then refuses them as textures). The bundler embeds every runtime asset in
// script-tag-loaded files as `window.__OFFLINE_ASSETS = { 'assets/foo.png': 'data:...;base64,...' }`
// (script tags are allowed on file://), and this shim makes every asset access resolve from that
// registry instead of the network:
//   - XMLHttpRequest  (Phaser loader: json, tilemaps, images as blobs, audio as arraybuffers)
//   - fetch()         (the card/box scenes check for the optional closing videos with fetch)
//   - Image / <audio> / <video> `.src` (HTML5-audio fallback, Phaser's Video object)
//   - URL.createObjectURL for registry image blobs (hands back the data URI itself, so the image is
//     never "tainted" for WebGL no matter how the browser treats blob: origins on file://)
//   - audio: the bundle embeds MP3 only (older Safari cannot decode Ogg Vorbis). A request for
//     assets/audio/.../x.ogg is answered with the x.mp3 entry, and canPlayType is made to admit Ogg Vorbis
//     (when MP3 plays) so Phaser does not skip the .ogg file names before asking.
//   - localStorage: if the browser blocks it, falls back to an in-memory store so the game still
//     plays (it just can't save).
// A path under assets/ that is NOT in the registry (an optional file the owner never supplied) gets a
// quiet synthetic 404, so the game's own "missing optional file" handling runs without a console
// error. Any other path (data:, blob:, http, vendor/...) is passed straight through.
//
// Written in conservative ES5 on purpose (Safari). Testable in Node: the file runs against whatever
// global object it is given (tests/unit/pack-offline.test.js loads it into a vm sandbox).
(function (root) {
  'use strict';

  var ASSET_PREFIX = 'assets/';

  function createOfflineShim(g) {
    var registry = g.__OFFLINE_ASSETS = g.__OFFLINE_ASSETS || {};
    var blobUrls = {}; // key -> blob: URL, made once (video/audio elements)
    var blobData = typeof g.WeakMap === 'function' ? new g.WeakMap() : null; // Blob -> data URI (images)
    var later = typeof g.setTimeout === 'function' ? function (fn) { g.setTimeout(fn, 0); } : function (fn) { fn(); };

    // ---------- path handling ----------

    function pageBase() {
      try {
        var href = String(g.location && g.location.href || '');
        return href.replace(/[?#].*$/, '').replace(/[^\/]*$/, '');
      } catch (e) {
        return '';
      }
    }

    // 'assets/a b.png', './assets/a%20b.png?x=1', 'file:///.../offline/assets/a.png' -> candidate keys
    function candidates(url) {
      var s = String(url);
      if (/^(data|blob|javascript):/i.test(s)) return [];
      var base = pageBase();
      if (base && s.indexOf(base) === 0) s = s.slice(base.length);
      s = s.replace(/[?#].*$/, '').replace(/^(\.\/)+/, '');
      var out = [s];
      try {
        var decoded = decodeURIComponent(s);
        if (decoded !== s) out.push(decoded);
      } catch (e) { /* not valid percent-encoding: the raw form is all there is */ }
      return out;
    }

    // -> { key, uri } for a registry hit, { missing: true } for an unregistered assets/ path,
    //    null for anything that is none of our business.
    function lookup(url) {
      if (url === null || url === undefined) return null;
      var list = candidates(typeof url === 'string' ? url : (url.href || String(url)));
      for (var i = 0; i < list.length; i++) {
        if (Object.prototype.hasOwnProperty.call(registry, list[i])) return { key: list[i], uri: registry[list[i]] };
      }
      // Audio: the bundle embeds MP3 only (older Safari cannot decode Ogg Vorbis), but the game still asks
      // for 'assets/audio/.../x.ogg'. Answer that with the x.mp3 entry (tools/pack-offline.js writes it).
      for (var a = 0; a < list.length; a++) {
        if (/\.ogg$/i.test(list[a])) {
          var alt = list[a].replace(/\.ogg$/i, '.mp3');
          if (Object.prototype.hasOwnProperty.call(registry, alt)) return { key: alt, uri: registry[alt] };
        }
      }
      for (var j = 0; j < list.length; j++) {
        if (list[j].indexOf(ASSET_PREFIX) === 0) return { missing: true, key: list[j] };
      }
      return null;
    }

    // ---------- data URI decoding ----------

    function splitUri(uri) {
      var comma = uri.indexOf(',');
      var meta = uri.slice(5, comma); // after "data:"
      return { mime: meta.replace(/;base64$/i, '') || 'application/octet-stream', base64: /;base64$/i.test(meta), body: uri.slice(comma + 1) };
    }

    function toBytes(uri) {
      var parts = splitUri(uri);
      var bin = parts.base64 ? g.atob(parts.body) : decodeURIComponent(parts.body);
      var bytes = new g.Uint8Array(bin.length);
      for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i) & 255;
      return bytes;
    }

    function toText(uri) {
      var parts = splitUri(uri);
      if (!parts.base64) return decodeURIComponent(parts.body);
      var bytes = toBytes(uri);
      if (typeof g.TextDecoder === 'function') return new g.TextDecoder('utf-8').decode(bytes);
      var bin = '';
      for (var i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
      return decodeURIComponent(escape(bin));
    }

    function toBlob(uri) {
      var blob = new g.Blob([toBytes(uri)], { type: splitUri(uri).mime });
      if (blobData) blobData.set(blob, uri);
      return blob;
    }

    function blobUrlFor(hit) {
      if (!blobUrls[hit.key]) {
        var blob = new g.Blob([toBytes(hit.uri)], { type: splitUri(hit.uri).mime });
        blobUrls[hit.key] = g.URL.createObjectURL(blob); // not in blobData, so the wrapper below passes it through

      }
      return blobUrls[hit.key];
    }

    // ---------- XMLHttpRequest ----------

    function fire(xhr, type, extra) {
      var event = { type: type, target: xhr, currentTarget: xhr, lengthComputable: true, loaded: extra || 0, total: extra || 0 };
      var handler = xhr['on' + type];
      if (typeof handler === 'function') {
        try { handler.call(xhr, event); } catch (e) { if (g.console) g.console.error(e); }
      }
    }

    function defineValue(obj, name, value) {
      try { Object.defineProperty(obj, name, { value: value, configurable: true, writable: true }); } catch (e) { obj[name] = value; }
    }

    function respond(xhr, hit) {
      var status = hit.missing ? 404 : 200;
      var type = xhr.responseType || '';
      var size = 0;
      var response = '';
      var text = null;
      if (!hit.missing) {
        if (type === 'blob') {
          response = toBlob(hit.uri);
          size = response.size;
        } else if (type === 'arraybuffer') {
          var bytes = toBytes(hit.uri);
          response = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.length);
          size = bytes.length;
        } else {
          text = toText(hit.uri);
          size = text.length;
          response = type === 'json' ? JSON.parse(text) : text;
        }
      }
      defineValue(xhr, 'readyState', 4);
      defineValue(xhr, 'status', status);
      defineValue(xhr, 'statusText', hit.missing ? 'Not Found' : 'OK');
      defineValue(xhr, 'responseURL', '');
      defineValue(xhr, 'response', response);
      if (type === '' || type === 'text') defineValue(xhr, 'responseText', text === null ? '' : text);
      fire(xhr, 'readystatechange', size);
      fire(xhr, 'progress', size);
      fire(xhr, 'load', size);
      fire(xhr, 'loadend', size);
    }

    function patchXhr() {
      var X = g.XMLHttpRequest;
      if (!X || !X.prototype || X.prototype.__offlinePatched) return;
      var nativeOpen = X.prototype.open;
      var nativeSend = X.prototype.send;
      X.prototype.open = function (method, url) {
        this.__offlineHit = String(method).toUpperCase() === 'GET' ? lookup(url) : null;
        return nativeOpen.apply(this, arguments);
      };
      X.prototype.send = function () {
        var hit = this.__offlineHit;
        if (!hit) return nativeSend.apply(this, arguments);
        var xhr = this;
        later(function () { respond(xhr, hit); });
      };
      X.prototype.__offlinePatched = true;
    }

    // ---------- fetch ----------

    function patchFetch() {
      var nativeFetch = g.fetch;
      if (typeof nativeFetch !== 'function' || typeof g.Response !== 'function') return;
      g.fetch = function (input, init) {
        var url = typeof input === 'string' ? input : (input && input.url) || input;
        var method = String((init && init.method) || (input && input.method) || 'GET').toUpperCase();
        var hit = method === 'GET' || method === 'HEAD' ? lookup(url) : null;
        if (!hit) return nativeFetch.apply(g, arguments);
        if (hit.missing) return g.Promise.resolve(new g.Response('', { status: 404, statusText: 'Not Found' }));
        var mime = splitUri(hit.uri).mime;
        // The games only ask "is this video there?" -- playback goes through <video>.src below -- so
        // don't decode tens of MB of video just to answer that.
        var body = /^video\//.test(mime) || method === 'HEAD' ? null : toBlob(hit.uri);
        return g.Promise.resolve(new g.Response(body, { status: 200, headers: { 'Content-Type': mime } }));
      };
    }

    // ---------- URL.createObjectURL (images stay data URIs) ----------

    function patchObjectUrl() {
      var U = g.URL;
      if (!U || typeof U.createObjectURL !== 'function' || U.createObjectURL.__offlineOriginal) return;
      var original = U.createObjectURL;
      var wrapped = function (obj) {
        var uri = blobData && obj && typeof obj === 'object' ? blobData.get(obj) : null;
        if (uri && /^data:image\//i.test(uri)) return uri;
        return original.apply(U, arguments);
      };
      wrapped.__offlineOriginal = original;
      U.createObjectURL = wrapped;
    }

    // ---------- element .src (Image, <audio>, <video>) ----------

    function patchSrc(ctor, kind) {
      var proto = ctor && ctor.prototype;
      var desc = proto && Object.getOwnPropertyDescriptor(proto, 'src');
      if (!desc || !desc.set || !desc.get || desc.set.__offlinePatched) return;
      var setter = function (value) {
        var hit = lookup(String(value));
        var out = value;
        if (hit && !hit.missing) out = kind === 'image' ? hit.uri : blobUrlFor(hit);
        return desc.set.call(this, out);
      };
      setter.__offlinePatched = true;
      Object.defineProperty(proto, 'src', { configurable: true, enumerable: desc.enumerable, get: desc.get, set: setter });
    }

    // ---------- Ogg-as-MP3 (Phaser's audio support check) ----------

    // Phaser only requests a file whose extension the browser claims to play (device.audio.ogg comes from
    // canPlayType('audio/ogg; codecs="vorbis"')). A Safari that cannot decode Ogg answers "" there, so
    // Phaser would skip every .ogg sound before the request ever reached lookup() above. The bundle's
    // sounds are MP3 under the .ogg names, so when the browser can play MP3 it is told Ogg Vorbis is fine
    // too. decodeAudioData sniffs the bytes, not the name, so the MP3 data decodes. A browser that really
    // plays Ogg keeps its own honest answer.
    function patchCanPlayType() {
      var M = g.HTMLMediaElement;
      var proto = M && M.prototype;
      if (!proto || typeof proto.canPlayType !== 'function' || proto.canPlayType.__offlinePatched) return;
      var original = proto.canPlayType;
      var wrapped = function (type) {
        var answer = original.apply(this, arguments);
        if (!answer && /^audio\/ogg\s*;\s*codecs\s*=\s*["']?vorbis/i.test(String(type))) {
          var mp3 = original.call(this, 'audio/mpeg');
          if (mp3) return mp3;
        }
        return answer;
      };
      wrapped.__offlinePatched = true;
      proto.canPlayType = wrapped;
    }

    // ---------- localStorage ----------

    function guardLocalStorage() {
      try {
        var probe = '__offline_probe__';
        g.localStorage.setItem(probe, '1');
        g.localStorage.removeItem(probe);
        return false;
      } catch (e) {
        var store = {};
        var memory = {
          getItem: function (k) { return Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null; },
          setItem: function (k, v) { store[k] = String(v); },
          removeItem: function (k) { delete store[k]; },
          key: function (i) { var keys = Object.keys(store); return i < keys.length ? keys[i] : null; },
          clear: function () { store = {}; }
        };
        Object.defineProperty(memory, 'length', { get: function () { return Object.keys(store).length; } });
        try { Object.defineProperty(g, 'localStorage', { value: memory, configurable: true }); } catch (e2) { /* save.js is try/catch-wrapped anyway */ }
        return true;
      }
    }

    function install() {
      g.__OFFLINE_BUNDLE = true; // src/main.js reads this: dev tools stay off whatever ?dev says
      patchXhr();
      patchFetch();
      patchObjectUrl();
      patchSrc(g.HTMLImageElement, 'image');
      patchSrc(g.HTMLMediaElement, 'media');
      patchCanPlayType();
      guardLocalStorage();
    }

    return {
      lookup: lookup,
      install: install,
      has: function (url) { var hit = lookup(url); return Boolean(hit && !hit.missing); },
      keys: function () { return Object.keys(registry); }
    };
  }

  var shim = createOfflineShim(root);
  shim.install();
  root.__OFFLINE_SHIM = shim;
})(typeof window !== 'undefined' ? window : this);
