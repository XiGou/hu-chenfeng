/* ==========================================================================
   户晨风语录 · 交互逻辑
   数据驱动：从 assets/data/quotes.json 读取语录并渲染
   ========================================================================== */
(function () {
  "use strict";

  const DATA_URL = "assets/data/quotes.json";
  const quotesEl = document.getElementById("quotes");
  const countEl = document.getElementById("count");
  const emptyEl = document.getElementById("empty");
  const searchEl = document.getElementById("search");
  const typewriterBtn = document.getElementById("toggle-typewriter");

  let quotes = [];
  let filtered = [];

  /* ---------- 工具 ---------- */
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (m) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m];
    });
  }

  function fmtDate(d) {
    if (!d) return "";
    const parts = String(d).split("-");
    return parts.length === 3 ? parts[0] + "年" + +parts[1] + "月" + +parts[2] + "日" : d;
  }

  function linkIcon(type) {
    if (type === "youtube") return "▶";
    if (type === "spotify") return "♫";
    return "↗";
  }

  /* ---------- 渲染 ---------- */
  function buildMedia(q) {
    const parts = [];

    if (q.audio) {
      parts.push('<audio controls preload="none" src="' + esc(q.audio) + '"></audio>');
    }

    if (q.video) {
      // 懒加载 iframe：仅在有意图时加载，避免阻塞
      parts.push(
        '<div class="media-video-wrap">' +
          '<iframe data-src="' + esc(q.video) +
          '" title="视频" loading="lazy" allowfullscreen allow="encrypted-media; picture-in-picture"></iframe>' +
        "</div>"
      );
    }

    if (Array.isArray(q.links) && q.links.length) {
      const links = q.links
        .map(function (l) {
          const type = l.type || "link";
          return (
            '<a class="media-link" href="' + esc(l.url) +
            '" target="_blank" rel="noopener noreferrer">' +
            '<span class="ext">' + linkIcon(type) + "</span>" +
            esc(l.label || type) +
            "</a>"
          );
        })
        .join("");
      parts.push('<div class="media-links">' + links + "</div>");
    }

    return parts.length ? '<div class="media">' + parts.join("") + "</div>" : "";
  }

  function buildCard(q) {
    const tags = (q.tags || [])
      .map(function (t) { return '<span class="tag">#' + esc(t) + "</span>"; })
      .join("");

    return (
      '<article class="quote-card" data-id="' + q.id + '">' +
        '<span class="quote-no">No.' + String(q.id).padStart(3, "0") + "</span>" +
        '<div class="quote-meta">' +
          '<span class="cat">' + esc(q.category || "未分类") + "</span>" +
          (q.date ? "<time>" + fmtDate(q.date) + "</time>" : "") +
        "</div>" +
        '<blockquote class="quote-text">' + esc(q.text) + "</blockquote>" +
        (tags ? '<div class="tags">' + tags + "</div>" : "") +
        buildMedia(q) +
      "</article>"
    );
  }

  function render() {
    if (!filtered.length) {
      quotesEl.innerHTML = "";
      emptyEl.hidden = false;
      countEl.textContent = "共 0 篇";
      return;
    }
    emptyEl.hidden = true;
    const html = filtered.map(buildCard).join("");
    quotesEl.innerHTML = html;
    countEl.textContent = "共 " + filtered.length + " 篇";
    lazyLoadVideos();
  }

  /* 懒加载 iframe：进入视口才真正加载 src */
  function lazyLoadVideos() {
    if (!("IntersectionObserver" in window)) {
      document.querySelectorAll("iframe[data-src]").forEach(function (f) {
        f.src = f.dataset.src;
      });
      return;
    }
    const io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) {
          const f = e.target;
          if (f.dataset.src && !f.src) {
            f.src = f.dataset.src;
            f.removeAttribute("data-src");
          }
          io.unobserve(f);
        }
      });
    }, { rootMargin: "200px" });
    document.querySelectorAll("iframe[data-src]").forEach(function (f) {
      io.observe(f);
    });
  }

  /* ---------- 检索 ---------- */
  function doSearch() {
    const kw = (searchEl.value || "").trim().toLowerCase();
    if (!kw) {
      filtered = quotes.slice();
    } else {
      filtered = quotes.filter(function (q) {
        const hay = [
          q.text, q.category,
          (q.tags || []).join(" "),
          q.date
        ].join(" ").toLowerCase();
        return kw.split(/\s+/).every(function (w) { return hay.indexOf(w) !== -1; });
      });
    }
    render();
  }

  /* ---------- 打字机标题动画 ---------- */
  function setupTypewriter() {
    const titleEl = document.getElementById("site-title");
    const full = titleEl.textContent;
    let enabled = false;
    let interval = null;

    function stop() {
      if (interval) { clearInterval(interval); interval = null; }
      titleEl.textContent = full;
      document.body.classList.remove("typewriter");
    }

    function play() {
      stop();
      document.body.classList.add("typewriter");
      titleEl.textContent = "";
      let i = 0;
      interval = setInterval(function () {
        titleEl.textContent = full.slice(0, ++i);
        if (i >= full.length) { clearInterval(interval); interval = null; }
      }, 140);
    }

    function toggle() {
      enabled = !enabled;
      typewriterBtn.textContent = enabled ? "⏸ 停止打字机" : "🔤 打字机动画";
      if (enabled) play(); else stop();
    }

    typewriterBtn.addEventListener("click", toggle);
    // 尊重减少动效偏好
    if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      typewriterBtn.hidden = true;
    }
  }

  /* ---------- 初始化 ---------- */
  function init() {
    fetch(DATA_URL)
      .then(function (r) {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.json();
      })
      .then(function (data) {
        // meta 填充
        const m = data.meta || {};
        if (m.title) document.getElementById("site-title").textContent = m.title;
        if (m.subtitle) document.getElementById("site-subtitle").textContent = m.subtitle;
        if (m.description) document.getElementById("site-description").textContent = m.description;
        document.title = (m.title || "语录") + " · Loquitur";

        quotes = (data.quotes || []).map(function (q, i) {
          return Object.assign({ id: i + 1 }, q);
        });
        filtered = quotes.slice();
        render();
      })
      .catch(function (err) {
        quotesEl.innerHTML =
          '<p class="empty">加载语录数据失败：' + esc(err.message) + "</p>";
      });

    searchEl.addEventListener("input", doSearch);
    setupTypewriter();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
