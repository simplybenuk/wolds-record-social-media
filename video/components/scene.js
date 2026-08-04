/* Shared HyperFrames scene engine for Wolds Record Reels.
 *
 * Responsibilities:
 *   - read composition variables tolerantly (arrays may arrive as real arrays
 *     or as JSON strings, see the note in the compositions);
 *   - lay a weighted list of scenes across the composition duration, writing
 *     data-start / data-duration before the runtime reads them;
 *   - publish the absolute-clock CSS custom properties the shared stylesheet
 *     uses for its fades.
 *
 * Everything here is deterministic. No timers, no requestAnimationFrame, no
 * wall-clock or random values: the renderer seeks to arbitrary timestamps and
 * every frame must resolve identically on every pass.
 */
(function (global) {
  "use strict";

  var STAGGER = 0.16;
  var MAX_SCENE_FADE = 0.5;
  var MIN_DURATION = 3;
  var MAX_DURATION = 90;

  function variables() {
    try {
      var api = global.__hyperframes;
      if (api && typeof api.getVariables === "function") {
        var values = api.getVariables();
        if (values && typeof values === "object") return values;
      }
    } catch (error) {
      void error;
    }
    return {};
  }

  function asText(value) {
    if (value === null || value === undefined) return "";
    if (typeof value === "string") return value.trim();
    if (typeof value === "number" || typeof value === "boolean") return String(value);
    return "";
  }

  /* Accepts a real array, a JSON-encoded array, or a single scalar. */
  function asList(value) {
    if (Array.isArray(value)) return value;
    var text = asText(value);
    if (!text) return [];
    if (text.charAt(0) === "[") {
      try {
        var parsed = JSON.parse(text);
        if (Array.isArray(parsed)) return parsed;
      } catch (error) {
        void error;
      }
    }
    return [text];
  }

  function asTextList(value) {
    var items = asList(value);
    var out = [];
    for (var i = 0; i < items.length; i++) {
      var text = asText(items[i]);
      if (text) out.push(text);
    }
    return out;
  }

  /* Asset paths arrive relative to the repository root (e.g.
     "assets/photos/dog-image.png"). The renderer and the preview studio both
     serve the composition from the project root, so they are normalised to a
     root-absolute URL rather than being resolved against compositions/. */
  function asPath(value) {
    var raw = value;
    if (raw && typeof raw === "object" && typeof raw.url === "string") raw = raw.url;
    var text = asText(raw);
    if (!text) return "";
    if (text.indexOf("data:") === 0 || text.indexOf("http") === 0) return text;
    return "/" + text.replace(/^\.\//, "").replace(/^\/+/, "");
  }

  function asDuration(value, fallback) {
    var seconds = Number(value);
    if (!isFinite(seconds)) return fallback;
    if (seconds < MIN_DURATION) return MIN_DURATION;
    if (seconds > MAX_DURATION) return MAX_DURATION;
    return seconds;
  }

  function round(value) {
    return Math.round(value * 1000) / 1000;
  }

  function secs(value) {
    return round(value) + "s";
  }

  /* An empty value CLEARS the element rather than leaving whatever static copy the
     composition ships with. Returning early on empty used to leave the authoring
     placeholder in place, so a reel missing a caption rendered -- and could have
     published -- marketing copy the operator never wrote. Blank is recoverable;
     confidently wrong text is not. Content validation lives in
     scripts/lib/content.mjs so valid records never reach here empty. */
  function setText(element, value) {
    if (!element) return false;
    var text = asText(value);
    element.textContent = text;
    return Boolean(text);
  }

  function setImage(element, value) {
    if (!element) return false;
    var path = asPath(value);
    if (!path) {
      element.removeAttribute("src");
      element.setAttribute("data-wr-empty", "true");
      return false;
    }
    element.setAttribute("src", path);
    element.removeAttribute("data-wr-empty");
    return true;
  }

  function hide(element) {
    if (element && element.parentNode) element.parentNode.removeChild(element);
  }

  /* Distributes `total` seconds across weighted scenes and writes the timing
     the HyperFrames runtime and the shared CSS both read. */
  function layout(scenes, total) {
    var sum = 0;
    var i;
    for (i = 0; i < scenes.length; i++) sum += scenes[i].weight;
    if (!(sum > 0)) return;

    var cursor = 0;
    for (i = 0; i < scenes.length; i++) {
      var last = i === scenes.length - 1;
      var end = last ? total : cursor + total * (scenes[i].weight / sum);
      place(scenes[i].el, cursor, end - cursor, i);
      cursor = end;
    }
  }

  function place(element, start, span, index) {
    if (!element || span <= 0) return;

    var sceneFade = Math.min(MAX_SCENE_FADE, span * 0.28);
    var inDur = Math.min(0.9, Math.max(0.35, span * 0.34));

    element.style.setProperty("--wr-scene-at", secs(start));
    element.style.setProperty("--wr-scene-span", secs(span));
    element.style.setProperty("--wr-scene-in-dur", secs(sceneFade));
    element.style.setProperty("--wr-in-dur", secs(inDur));
    element.setAttribute("data-wr-scene-index", String(index));
    element.style.zIndex = String(index + 1);

    var risers = element.querySelectorAll(".wr-rise");
    var budget = Math.max(0, span - inDur);
    var step = Math.min(STAGGER, risers.length > 1 ? budget / (risers.length - 1) : STAGGER);
    for (var i = 0; i < risers.length; i++) {
      risers[i].style.setProperty("--wr-at", secs(start + i * step));
    }
  }

  /* The renderer derives the composition length from the furthest-reaching CSS
     animation, which is the persistent paper layer's `wr-hold`. Nothing
     declares a static data-duration, so the record's duration always wins. */
  function build(defaultDuration, builder) {
    var vars = variables();
    var total = asDuration(vars.duration, defaultDuration);
    var stage = document.querySelector("[data-composition-id][data-width]");
    if (stage) stage.style.setProperty("--wr-total", secs(total));
    var scenes = builder(vars, total) || [];
    layout(scenes, total);
  }

  global.WRScene = {
    variables: variables,
    asText: asText,
    asList: asList,
    asTextList: asTextList,
    asPath: asPath,
    setText: setText,
    setImage: setImage,
    hide: hide,
    build: build
  };
})(window);
