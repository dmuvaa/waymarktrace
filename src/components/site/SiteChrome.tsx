"use client";

import { useEffect, useState, type ReactNode } from "react";

export type SiteScreen = "home" | "guide" | "game" | "results";

function CompassMark() {
  return (
    <svg viewBox="0 0 42 42" aria-hidden="true">
      <circle cx="21" cy="21" r="18.5" />
      <path d="M26.8 14.1 23.4 23.4 14.1 26.8l3.4-9.3 9.3-3.4Z" />
      <circle cx="21" cy="21" r="2" />
    </svg>
  );
}

type SiteChromeProps = {
  current: SiteScreen;
  onHome: () => void;
  onGuide: () => void;
  onPlay: () => void;
  children: ReactNode;
};

export function SiteChrome({ current, onHome, onGuide, onPlay, children }: SiteChromeProps) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  const choose = (action: () => void) => {
    setOpen(false);
    action();
  };

  return (
    <div className={`site-frame${current === "game" ? " site-frame--game" : ""}`}>
      <header className="navbar">
        <button className="brand" type="button" onClick={() => choose(onHome)}>
          <CompassMark />
          <span>waymarktrace</span>
        </button>
        <button
          className="nav-toggle"
          type="button"
          aria-expanded={open}
          aria-controls="site-nav"
          onClick={() => setOpen((value) => !value)}
        >
          <span className="nav-toggle__label">{open ? "Close" : "Menu"}</span>
          <span className="nav-toggle__icon" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
        </button>
        <nav id="site-nav" className={open ? "site-nav is-open" : "site-nav"}>
          <button
            type="button"
            aria-current={current === "guide" ? "page" : undefined}
            onClick={() => choose(onGuide)}
          >
            How it works
          </button>
          <button
            type="button"
            aria-current={current === "home" || current === "game" ? "page" : undefined}
            onClick={() => choose(onPlay)}
          >
            Play
          </button>
        </nav>
      </header>
      {open && (
        <button className="nav-backdrop" type="button" aria-label="Close menu" onClick={() => setOpen(false)} />
      )}
      <div className="site-content">{children}</div>
      <footer className="site-footer">
        <div>
          <strong>waymarktrace</strong>
          <p>Two places and two years. The name stays hidden until you find it.</p>
        </div>
        <div className="footer-links">
          <button type="button" onClick={() => choose(onPlay)}>Play</button>
          <button type="button" onClick={() => choose(onGuide)}>How it works</button>
        </div>
        <p className="footer-note">
          Progress stays in this browser. Map data from OpenStreetMap, served by OpenFreeMap.
        </p>
      </footer>
    </div>
  );
}
