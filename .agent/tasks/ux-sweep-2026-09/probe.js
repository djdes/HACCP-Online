(() => {
    const vw = document.documentElement.clientWidth;
    const scrollable = (el) => { for (let n = el; n && n !== document.body; n = n.parentElement) { const s = getComputedStyle(n); if (/(auto|scroll|hidden|clip)/.test(s.overflowX)) return true; } return false; };
    const desc = (el) => `${el.tagName.toLowerCase()}.${String(el.className?.toString?.() ?? "").slice(0, 60)} «${(el.textContent ?? "").trim().slice(0, 40)}»`;
    const off = []; const small = []; const tiny = [];
    for (const el of Array.from(document.querySelectorAll("body *"))) {
      const r = el.getBoundingClientRect(); if (r.width === 0 || r.height === 0) continue;
      const st = getComputedStyle(el); if (st.visibility === "hidden" || st.display === "none") continue;
      if ((r.right > vw + 2 || r.left < -2) && !scrollable(el.parentElement) && st.position !== "fixed" && off.length < 6) off.push(`${desc(el)} L${Math.round(r.left)} R${Math.round(r.right)}`);
      if (/^(BUTTON|A)$/.test(el.tagName) || el.getAttribute("role") === "button") { if ((r.width < 30 || r.height < 30) && r.top >= 0 && small.length < 6 && !scrollable(el.parentElement)) small.push(`${desc(el)} ${Math.round(r.width)}x${Math.round(r.height)}`); }
      if (el.children.length === 0 && (el.textContent ?? "").trim().length > 3 && parseFloat(st.fontSize) < 11 && tiny.length < 4) tiny.push(`${desc(el)} ${st.fontSize}`);
    }
    return { vw, pageScrollW: document.documentElement.scrollWidth, off, small, tiny, title: document.title, h1: document.querySelector("h1")?.textContent?.trim().slice(0, 80) ?? null, bodyLen: (document.body.innerText ?? "").length };
  })()