import React, { useCallback, useEffect, useRef, useState } from "react";
import { IconBackspace, IconCalculator, IconCheck, IconX } from "@tabler/icons-react";

/**
 * F11 ile programın her yerinden açılan hesap makinesi.
 * Yalnızca F11 ile açılır; X, Vazgeç veya Esc ile kapanır.
 * "Tamam" sonucu, açılmadan önce odakta olan alana yazar.
 */

type Op = "+" | "-" | "*" | "/" | null;

const fmt = (n: number): string => {
  if (!isFinite(n)) return "Hata";
  const r = Math.round(n * 1e10) / 1e10;
  return r.toLocaleString("tr-TR", { maximumFractionDigits: 10 });
};

const compute = (a: number, b: number, op: Op): number => {
  switch (op) {
    case "+": return a + b;
    case "-": return a - b;
    case "*": return a * b;
    case "/": return b === 0 ? NaN : a / b;
    default: return b;
  }
};

const GlobalCalculator: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [entry, setEntry] = useState("0");        // ekrandaki giriş (nokta ondalık)
  const [acc, setAcc] = useState<number | null>(null);
  const [op, setOp] = useState<Op>(null);
  const [fresh, setFresh] = useState(true);       // sonraki rakam yeni sayı başlatır
  const [history, setHistory] = useState("");
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const targetRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ dx: number; dy: number } | null>(null);

  const reset = () => {
    setEntry("0"); setAcc(null); setOp(null); setFresh(true); setHistory("");
  };

  const close = useCallback(() => setOpen(false), []);

  const current = (): number => parseFloat(entry) || 0;

  const digit = (d: string) => {
    if (entry === "Hata" || fresh) {
      setEntry(d === "." ? "0." : d);
      setFresh(false);
      return;
    }
    if (d === "." && entry.includes(".")) return;
    if (entry.replace("-", "").replace(".", "").length >= 16) return;
    setEntry(entry === "0" && d !== "." ? d : entry + d);
  };

  const operator = (o: Op) => {
    const cur = current();
    let base = cur;
    if (acc !== null && op && !fresh) {
      base = compute(acc, cur, op);
      setEntry(isFinite(base) ? String(base) : "Hata");
    } else if (acc !== null && fresh) {
      base = acc; // operatör değiştirme
    }
    setAcc(base);
    setOp(o);
    setFresh(true);
    setHistory(`${fmt(base)} ${o === "*" ? "×" : o === "/" ? "÷" : o}`);
  };

  const equals = () => {
    if (acc === null || !op) return;
    const cur = current();
    const res = compute(acc, cur, op);
    setHistory(`${fmt(acc)} ${op === "*" ? "×" : op === "/" ? "÷" : op} ${fmt(cur)} =`);
    setEntry(isFinite(res) ? String(Math.round(res * 1e10) / 1e10) : "Hata");
    setAcc(null); setOp(null); setFresh(true);
  };

  const back = () => {
    if (fresh || entry === "Hata") return;
    const s = entry.slice(0, -1);
    setEntry(s === "" || s === "-" ? "0" : s);
  };

  const unary = (fn: (x: number) => number) => {
    const r = fn(current());
    setEntry(isFinite(r) ? String(Math.round(r * 1e10) / 1e10) : "Hata");
    setFresh(true);
  };

  const percent = () => {
    const cur = current();
    const r = acc !== null && (op === "+" || op === "-") ? (acc * cur) / 100 : cur / 100;
    setEntry(String(Math.round(r * 1e10) / 1e10));
    setFresh(false);
  };

  const commit = () => {
    const el = targetRef.current;
    let val = entry === "Hata" ? "" : entry;
    if (acc !== null && op) {
      const r = compute(acc, current(), op);
      val = isFinite(r) ? String(Math.round(r * 1e10) / 1e10) : "";
    }
    if (el && val && document.contains(el) && !el.readOnly && !el.disabled) {
      const out = el.type === "number" ? val : val.replace(".", ",");
      const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
      try {
        setter?.call(el, out);
        el.dispatchEvent(new Event("input", { bubbles: true }));
        el.dispatchEvent(new Event("change", { bubbles: true }));
      } catch { /* bu alan desteklemiyor */ }
      setOpen(false);
      setTimeout(() => el.focus(), 0);
      return;
    }
    setOpen(false);
  };

  // F11: aç/kapat (tarayıcı tam ekranını engeller)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "F11") return;
      e.preventDefault();
      e.stopPropagation();
      setOpen(prev => {
        if (!prev) {
          const a = document.activeElement;
          targetRef.current =
            a instanceof HTMLInputElement && ["text", "number", "tel", "search", ""].includes(a.type)
              ? a
              : a instanceof HTMLTextAreaElement ? a : null;
          reset();
        }
        return !prev;
      });
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, []);

  // Açıkken klavyeden kullanım (sayfadaki kısayollara sızmasın)
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "F11" || e.ctrlKey || e.altKey || e.metaKey) return;
      const k = e.key;
      let handled = true;
      if (/^[0-9]$/.test(k)) digit(k);
      else if (k === "." || k === ",") digit(".");
      else if (k === "+" || k === "-" || k === "*" || k === "/") operator(k);
      else if (k === "Enter" || k === "=") equals();
      else if (k === "Backspace") back();
      else if (k === "Delete") { setEntry("0"); setFresh(true); }
      else if (k === "Escape") close();
      else if (k === "%") percent();
      else handled = false;
      if (handled) { e.preventDefault(); e.stopPropagation(); }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  });

  // Sürükleme
  useEffect(() => {
    const move = (e: MouseEvent) => {
      if (!drag.current) return;
      setPos({ x: e.clientX - drag.current.dx, y: e.clientY - drag.current.dy });
    };
    const up = () => { drag.current = null; };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
    return () => { window.removeEventListener("mousemove", move); window.removeEventListener("mouseup", up); };
  }, []);

  if (!open) return null;

  const startDrag = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest("button")) return;
    const r = boxRef.current?.getBoundingClientRect();
    if (!r) return;
    drag.current = { dx: e.clientX - r.left, dy: e.clientY - r.top };
    e.preventDefault();
  };

  const display = entry === "Hata" ? "Hata" : (() => {
    const [i, d] = entry.split(".");
    const intPart = Number(i || "0").toLocaleString("tr-TR");
    const sign = i.startsWith("-") && Number(i) === 0 ? "-" : "";
    return sign + intPart + (entry.includes(".") ? "," + (d ?? "") : "");
  })();

  const B = (label: React.ReactNode, onClick: () => void, variant = "light", title?: string) => (
    <button type="button" className={`btn btn-${variant} gc-btn`} onClick={onClick} title={title} tabIndex={-1}>
      {label}
    </button>
  );

  const style: React.CSSProperties = pos
    ? { left: pos.x, top: pos.y, transform: "none" }
    : {};

  return (
    <div className="gc-root" role="dialog" aria-label="Hesap makinesi">
      <style>{`
        .gc-root .gc-box{position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);z-index:2000;width:320px;max-width:calc(100vw - 32px);
          background:var(--bs-body-bg);color:var(--bs-body-color);border:1px solid var(--bs-border-color);border-radius:var(--bs-border-radius-lg,.5rem);
          box-shadow:0 .75rem 2rem rgba(0,0,0,.25);user-select:none;}
        .gc-root .gc-head{display:flex;align-items:center;justify-content:space-between;padding:.5rem .75rem;cursor:move;
          border-bottom:1px solid var(--bs-border-color);background:var(--bs-tertiary-bg);border-radius:var(--bs-border-radius-lg,.5rem) var(--bs-border-radius-lg,.5rem) 0 0;}
        .gc-root .gc-title{font-weight:600;font-size:.9rem;}
        .gc-root .gc-screen{margin:.75rem;padding:.5rem .75rem;border:1px solid var(--bs-border-color);border-radius:var(--bs-border-radius);
          background:var(--bs-secondary-bg);text-align:right;min-height:64px;}
        .gc-root .gc-hist{font-size:.75rem;color:var(--bs-secondary-color);min-height:1rem;}
        .gc-root .gc-val{font-size:1.6rem;font-weight:600;word-break:break-all;line-height:1.2;}
        .gc-root .gc-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:.4rem;padding:0 .75rem .75rem;}
        .gc-root .gc-btn{padding:.55rem 0;font-weight:500;border:1px solid var(--bs-border-color);}
        .gc-root .gc-foot{display:flex;gap:.5rem;justify-content:flex-end;padding:.6rem .75rem;border-top:1px solid var(--bs-border-color);}
      `}</style>
      <div className="gc-box" ref={boxRef} style={style}>
        <div className="gc-head" onMouseDown={startDrag}>
          <span className="gc-title"><IconCalculator size={16} className="me-1" />Hesap makinesi</span>
          <button type="button" className="btn-close" aria-label="Kapat" onClick={close} />
        </div>
        <div className="gc-screen">
          <div className="gc-hist">{history}</div>
          <div className="gc-val">{display}</div>
        </div>
        <div className="gc-grid">
          {B("C", reset, "outline-danger", "Temizle")}
          {B("CE", () => { setEntry("0"); setFresh(true); }, "outline-secondary", "Girişi sil")}
          {B(<IconBackspace size={18} />, back, "outline-secondary", "Geri")}
          {B("÷", () => operator("/"), "outline-primary")}
          {B("7", () => digit("7"))}{B("8", () => digit("8"))}{B("9", () => digit("9"))}
          {B("×", () => operator("*"), "outline-primary")}
          {B("4", () => digit("4"))}{B("5", () => digit("5"))}{B("6", () => digit("6"))}
          {B("−", () => operator("-"), "outline-primary")}
          {B("1", () => digit("1"))}{B("2", () => digit("2"))}{B("3", () => digit("3"))}
          {B("+", () => operator("+"), "outline-primary")}
          {B("±", () => unary(x => -x))}{B("0", () => digit("0"))}{B(",", () => digit("."))}
          {B("=", equals, "primary")}
          {B("%", percent, "outline-secondary")}
          {B("√", () => unary(Math.sqrt), "outline-secondary")}
          {B("x²", () => unary(x => x * x), "outline-secondary")}
          {B("1/x", () => unary(x => 1 / x), "outline-secondary")}
        </div>
        <div className="gc-foot">
          <button type="button" className="btn btn-sm btn-primary" onClick={commit} tabIndex={-1}>
            <IconCheck size={16} className="me-1" />Tamam
          </button>
          <button type="button" className="btn btn-sm btn-outline-secondary" onClick={close} tabIndex={-1}>
            <IconX size={16} className="me-1" />Vazgeç
          </button>
        </div>
      </div>
    </div>
  );
};

export default GlobalCalculator;
