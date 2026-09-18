(() => {
  const vw = document.documentElement.clientWidth, vh = window.innerHeight;
  const dlg = Array.from(document.querySelectorAll('[role="dialog"]')).filter((d) => d.getBoundingClientRect().width > 0).pop();
  if (!dlg) return { dialog: false };
  const r = dlg.getBoundingClientRect();
  const scrollable = (el) => { for (let n = el; n && n !== dlg.parentElement; n = n.parentElement) { const s = getComputedStyle(n); if (/(auto|scroll|hidden|clip)/.test(s.overflowX)) return true; } return false; };
  const off = [];
  for (const el of Array.from(dlg.querySelectorAll("*"))) { const b = el.getBoundingClientRect(); if (b.width === 0) continue; if ((b.right > vw + 1 || b.left < -1) && !scrollable(el.parentElement) && off.length < 5) off.push(`${el.tagName.toLowerCase()} «${(el.textContent || "").trim().slice(0, 30)}» R${Math.round(b.right)}`); }
  const inputs = Array.from(dlg.querySelectorAll("input,select,textarea")).filter((i) => i.getBoundingClientRect().width > 0);
  const smallFont = inputs.filter((i) => parseFloat(getComputedStyle(i).fontSize) < 16).length;
  return { dialog: true, title: (dlg.querySelector("h2,h1,[data-slot=dialog-title]")?.textContent || "").trim().slice(0, 60), rect: [Math.round(r.left), Math.round(r.top), Math.round(r.right), Math.round(r.bottom)], vw, vh, off, inputs: inputs.length, inputsUnder16px: smallFont, scrollH: dlg.scrollHeight, clientH: dlg.clientHeight };
})()
