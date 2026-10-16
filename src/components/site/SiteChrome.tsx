"use client";

import { useEffect, useState, type ReactNode } from "react";

export type SiteScreen = "home" | "guide" | "game" | "results";

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
          <img src="/logo.svg" alt="" width="32" height="32" />
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
          <p>Birth and death places, with the years. The historical figure stays hidden until you name them.</p>
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
