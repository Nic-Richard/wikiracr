import { useState, useEffect, useRef, useCallback } from 'react';
import styles from './WikiArticle.module.css';

const STRIP = ['.mw-editsection', '#toc'].join(', ');
const DESKTOP_ZOOM_MIN = 80;
const MOBILE_ZOOM_MIN = 60;
const ZOOM_MAX = 140;
const ZOOM_STEP = 10;
const ZOOM_STORAGE_KEY = 'wikiracrArticleZoomV2';
const CC_BY_SA_URL = 'https://creativecommons.org/licenses/by-sa/4.0/';

function isMobileViewport() {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(max-width: 700px), (pointer: coarse)').matches;
}

function getZoomMin() {
  return isMobileViewport() ? MOBILE_ZOOM_MIN : DESKTOP_ZOOM_MIN;
}

function clampZoom(value) {
  return Math.min(ZOOM_MAX, Math.max(getZoomMin(), value));
}

function readStoredZoom() {
  try {
    const value = Number(localStorage.getItem(ZOOM_STORAGE_KEY));
    return Number.isFinite(value) ? clampZoom(value) : 100;
  } catch {
    return 100;
  }
}

function buildDoc(html) {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <base href="https://en.wikipedia.org/">
  <link rel="stylesheet" href="https://en.wikipedia.org/w/load.php?modules=mediawiki.legacy.commonPrint,shared|mediawiki.skinning.content.parsoid|mediawiki.skinning.interface|skins.vector.styles|site.styles|ext.cite.style|ext.cite.styles|mediawiki.page.gallery.styles&only=styles&skin=vector">
  <style>
    html, body {
      background: #fff;
      margin: 0;
      padding: 8px 20px 80px;
      font-family: -apple-system, 'Linux Libertine', Georgia, serif;
      font-size: 14px;
      line-height: 1.6;
      color: #202122;
    }
    .mw-parser-output {
      max-width: 960px;
      margin: 0 auto;
    }
    .mw-editsection, #toc { display: none !important; }
    a { color: #3366cc; }
    a:hover { text-decoration: underline; }
    mark.wikiracr-find-mark { background: #fff3a3; color: inherit; }
    mark.wikiracr-find-active { background: #ffb84d; }
  </style>
</head>
<body>
  <div class="mw-parser-output">${html}</div>
  <script>
    document.addEventListener('click', function(e) {
      var a = e.target.closest('a');
      if (!a) return;
      e.preventDefault();
      window.parent.postMessage({ type: 'wiki-nav', href: a.getAttribute('href') || '' }, '*');
    });

    (function() {
      var marks = [];
      var current = -1;

      function clearMarks() {
        marks.forEach(function(m) {
          var parent = m.parentNode;
          if (!parent) return;
          parent.replaceChild(document.createTextNode(m.textContent), m);
          parent.normalize();
        });
        marks = [];
        current = -1;
      }

      function sendResults() {
        window.parent.postMessage({ type: 'find-results', count: marks.length, index: marks.length ? current + 1 : 0 }, '*');
      }

      function focusCurrent() {
        marks.forEach(function(m, i) { m.classList.toggle('wikiracr-find-active', i === current); });
        if (marks[current]) marks[current].scrollIntoView({ block: 'center', behavior: 'smooth' });
      }

      function runSearch(query) {
        clearMarks();
        if (!query) { sendResults(); return; }
        var q = query.toLowerCase();

        var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
          acceptNode: function(node) {
            if (!node.nodeValue || node.nodeValue.toLowerCase().indexOf(q) === -1) return NodeFilter.FILTER_REJECT;
            var p = node.parentElement;
            if (p && (p.closest('script') || p.closest('style'))) return NodeFilter.FILTER_REJECT;
            return NodeFilter.FILTER_ACCEPT;
          }
        });
        var textNodes = [];
        var node;
        while ((node = walker.nextNode())) textNodes.push(node);

        textNodes.forEach(function(textNode) {
          var text  = textNode.nodeValue;
          var lower = text.toLowerCase();
          var frag  = document.createDocumentFragment();
          var last  = 0;
          var idx;
          while ((idx = lower.indexOf(q, last)) !== -1) {
            if (idx > last) frag.appendChild(document.createTextNode(text.slice(last, idx)));
            var mark = document.createElement('mark');
            mark.className = 'wikiracr-find-mark';
            mark.textContent = text.slice(idx, idx + query.length);
            frag.appendChild(mark);
            marks.push(mark);
            last = idx + query.length;
          }
          if (last < text.length) frag.appendChild(document.createTextNode(text.slice(last)));
          textNode.parentNode.replaceChild(frag, textNode);
        });

        if (marks.length) { current = 0; focusCurrent(); }
        sendResults();
      }

      function applyArticleZoom(value) {
        var zoom = Math.min(1.4, Math.max(0.6, Number(value) || 1));
        var content = document.querySelector('.mw-parser-output');
        document.body.style.fontSize = (14 * zoom) + 'px';
        document.body.style.paddingLeft = Math.max(8, Math.round(20 / zoom)) + 'px';
        document.body.style.paddingRight = Math.max(8, Math.round(20 / zoom)) + 'px';
        if (content) content.style.maxWidth = Math.round(960 / zoom) + 'px';
      }

      window.addEventListener('message', function(e) {
        var data = e.data || {};
        if (data.type === 'find-query') runSearch(data.query || '');
        else if (data.type === 'find-next' && marks.length) { current = (current + 1) % marks.length; focusCurrent(); sendResults(); }
        else if (data.type === 'find-prev' && marks.length) { current = (current - 1 + marks.length) % marks.length; focusCurrent(); sendResults(); }
        else if (data.type === 'find-clear') clearMarks();
        else if (data.type === 'article-zoom') applyArticleZoom(data.zoom);
      });
    })();
  <\/script>
</body>
</html>`;
}

async function fetchHtml(title) {
  const res = await fetch(`https://en.wikipedia.org/api/rest_v1/page/html/${encodeURIComponent(title)}`);
  if (!res.ok) throw new Error(`Wikipedia returned ${res.status}`);
  const text = await res.text();
  const doc  = new DOMParser().parseFromString(text, 'text/html');
  doc.querySelectorAll(STRIP).forEach(el => el.remove());
  return doc.body.innerHTML;
}

export default function WikiArticle({ title, goalTitle, onLinkClick }) {
  const [blobUrl, setBlobUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);
  const [findOpen, setFindOpen]   = useState(false);
  const [query, setQuery]         = useState('');
  const [matches, setMatches]     = useState({ count: 0, index: 0 });
  const [articleZoom, setArticleZoom] = useState(readStoredZoom);
  const iframeRef  = useRef(null);
  const findInputRef = useRef(null);
  const debounceRef  = useRef(null);

  const postToFrame = useCallback((msg) => {
    iframeRef.current?.contentWindow?.postMessage(msg, '*');
  }, []);

  const applyArticleZoom = useCallback(() => {
    postToFrame({ type: 'article-zoom', zoom: articleZoom / 100 });
  }, [articleZoom, postToFrame]);

  useEffect(() => {
    setFindOpen(false);
    setQuery('');
    setMatches({ count: 0, index: 0 });
  }, [title]);

  useEffect(() => {
    try { localStorage.setItem(ZOOM_STORAGE_KEY, String(articleZoom)); } catch {}
    applyArticleZoom();
  }, [articleZoom, applyArticleZoom]);

  useEffect(() => {
    let url = null;
    setLoading(true);
    setError(null);

    fetchHtml(title)
      .then(html => {
        const blob = new Blob([buildDoc(html)], { type: 'text/html; charset=utf-8' });
        url = URL.createObjectURL(blob);
        setBlobUrl(url);
        setLoading(false);
      })
      .catch(e => { setError(e.message); setLoading(false); });

    return () => { if (url) URL.revokeObjectURL(url); };
  }, [title]);

  useEffect(() => {
    const handler = ({ data }) => {
      if (data?.type === 'find-results') { setMatches({ count: data.count, index: data.index }); return; }
      if (data?.type !== 'wiki-nav') return;
      const href = data.href;
      if (!href || href.startsWith('#')) return;
      if (href.startsWith('./') || href.startsWith('/wiki/')) {
        const raw   = href.startsWith('./') ? href.slice(2) : href.slice(6);
        const clean = decodeURIComponent(raw.split('#')[0]).replace(/_/g, ' ');
        onLinkClick(clean);
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [onLinkClick]);

  function openFind() {
    setFindOpen(true);
    setTimeout(() => findInputRef.current?.focus(), 0);
  }

  function closeFind() {
    setFindOpen(false);
    setQuery('');
    setMatches({ count: 0, index: 0 });
    postToFrame({ type: 'find-clear' });
  }

  function onQueryChange(value) {
    setQuery(value);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => postToFrame({ type: 'find-query', query: value }), 150);
  }

  function goNext() { postToFrame({ type: 'find-next' }); }
  function goPrev() { postToFrame({ type: 'find-prev' }); }

  function changeArticleZoom(delta) {
    setArticleZoom(value => clampZoom(value + delta));
  }

  useEffect(() => {
    const onResize = () => setArticleZoom(value => clampZoom(value));
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
    };
  }, []);

  function resetArticleZoom() {
    setArticleZoom(100);
  }

  function onFindKeyDown(e) {
    if (e.key === 'Escape') { e.preventDefault(); closeFind(); return; }
    if (e.key !== 'Enter') return;
    e.preventDefault();
    if (e.shiftKey) goPrev(); else goNext();
  }

  const displayTitle = title.replace(/_/g, ' ');
  const displayGoal  = goalTitle.replace(/_/g, ' ');
  const articleUrl = `https://en.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}`;

  if (loading) {
    return (
      <div className={styles.state}>
        <div className={styles.spinner} />
        <span>Loading {displayTitle}...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.state}>
        <span className={styles.err}>Could not load: {error}</span>
      </div>
    );
  }

  return (
    <div className={styles.root}>
      <div className={styles.banner}>
        <span className={styles.bannerLabel}>Navigate to</span>
        <strong className={styles.bannerGoal}>{displayGoal}</strong>
        <div className={styles.toolsWrap}>
          {!findOpen && (
            <div className={styles.zoomControl} aria-label="Article zoom controls">
              <button className={styles.zoomButton} onClick={() => changeArticleZoom(-ZOOM_STEP)} disabled={articleZoom <= getZoomMin()} title="Zoom article out" aria-label="Zoom article out">-</button>
              <button className={styles.zoomValue} onClick={resetArticleZoom} title="Reset article zoom" aria-label="Reset article zoom">{articleZoom}%</button>
              <button className={styles.zoomButton} onClick={() => changeArticleZoom(ZOOM_STEP)} disabled={articleZoom >= ZOOM_MAX} title="Zoom article in" aria-label="Zoom article in">+</button>
            </div>
          )}
          <div className={`${styles.findWrap} ${findOpen ? styles.findWrapOpen : ''}`}>
            {findOpen ? (
              <div className={styles.findBar}>
                <input
                  ref={findInputRef}
                  className={styles.findInput}
                  value={query}
                  onChange={e => onQueryChange(e.target.value)}
                  onKeyDown={onFindKeyDown}
                  placeholder="Find on this page"
                />
                {query && (
                  <span className={styles.findCount}>
                    {matches.count ? `${matches.index}/${matches.count}` : '0/0'}
                  </span>
                )}
                <button className={styles.findNav} onClick={goPrev} disabled={!matches.count} title="Previous match" aria-label="Previous match">&#8592;</button>
                <button className={styles.findNav} onClick={goNext} disabled={!matches.count} title="Next match" aria-label="Next match">&#8594;</button>
                <button className={styles.findClose} onClick={closeFind} title="Close" aria-label="Close find">&#10005;</button>
              </div>
            ) : (
              <button className={styles.findToggle} onClick={openFind} title="Find on this page" aria-label="Find on this page">
                &#128269;
              </button>
            )}
          </div>
        </div>
      </div>
      <iframe
        ref={iframeRef}
        src={blobUrl}
        className={styles.frame}
        title={displayTitle}
        onLoad={applyArticleZoom}
      />
      <div className={styles.attribution} aria-label="Wikipedia attribution">
        <a href={articleUrl} target="_blank" rel="noreferrer">Wikipedia content</a>
        <span aria-hidden="true">·</span>
        <a href={CC_BY_SA_URL} target="_blank" rel="noreferrer">CC BY-SA</a>
      </div>
    </div>
  );
}
