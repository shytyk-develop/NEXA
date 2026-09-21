import { useHeroVortex } from '../../../hooks/useHeroVortex';
import './hero.css';

export function Hero() {
  useHeroVortex();
  return (
    <>
      <section className="start-hero">
          <div id="startHeroVortex" className="start-hero__vortex" aria-hidden="true">
              <canvas className="start-hero__vortex-canvas"></canvas>
          </div>
          <div className="start-hero__glow" aria-hidden="true"></div>

          <div className="start-hero__content">
              <div className="start-hero__brand-block">
                  <h1 className="start-hero__wordmark" aria-label="NEXA">
                      <span className="start-hero__wordmark-half start-hero__wordmark-half--ne" aria-hidden="true">
                          <img src="/brand/nexa-logo.svg" alt="" width="1007" height="176" decoding="async" fetchPriority="high" />
                      </span>
                      <span className="start-hero__wordmark-gap" aria-hidden="true"></span>
                      <span className="start-hero__wordmark-half start-hero__wordmark-half--xa" aria-hidden="true">
                          <img src="/brand/nexa-logo.svg" alt="" width="1007" height="176" decoding="async" fetchPriority="high" />
                      </span>
                  </h1>
              </div>

              <ul className="start-hero__features">
                  <li className="start-hero__feature">
                      <span className="start-hero__feature-icon" aria-hidden="true">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75"><path d="M13 2 4 14h7l-1 8 9-12h-7l1-8z"/></svg>
                      </span>
                      <div>
                          <strong>Powerful</strong>
                          <p>Messages land instantly — no lag, no waiting on an app store.</p>
                      </div>
                  </li>
                  <li className="start-hero__feature">
                      <span className="start-hero__feature-icon" aria-hidden="true">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75"><path d="M12 2 4 5v6c0 5.25 3.4 10.15 8 11 4.6-.85 8-5.75 8-11V5l-8-3z"/><path d="m9 12 2 2 4-4"/></svg>
                      </span>
                      <div>
                          <strong>Secure</strong>
                          <p>Locked on your device. Only you and the person you chose can open it.</p>
                      </div>
                  </li>
                  <li className="start-hero__feature">
                      <span className="start-hero__feature-icon" aria-hidden="true">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75"><path d="M12 3v18M3 12h18"/><circle cx="12" cy="12" r="9"/></svg>
                      </span>
                      <div>
                          <strong>Ready</strong>
                          <p>Open a tab. Talk freely. No phone number, no install.</p>
                      </div>
                  </li>
              </ul>

              <div className="start-hero__cta">
                  <p className="start-hero__cta-text">Nexa is a private messenger to speak freely, connect safely, and keep your thoughts your own.</p>
                  <a href="/login" data-link className="start-motion-btn" aria-label="Get started">
                      <span className="start-motion-btn__circle" aria-hidden="true"></span>
                      <span className="start-motion-btn__icon" aria-hidden="true">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M13 5l7 7-7 7"/></svg>
                      </span>
                      <span className="start-motion-btn__label">Get Started</span>
                  </a>
                  <a href="#" className="start-hero__docs">Explore Docs</a>
              </div>
          </div>
      </section>
    </>
  );
}
