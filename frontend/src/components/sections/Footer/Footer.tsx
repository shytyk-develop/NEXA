import './footer.css';
export function Footer() {
  return (
    <>
      <div className="start-footer-curtain" data-footer-curtain>
          <div className="start-footer-curtain__stage">
              <div className="start-footer-curtain__aurora" aria-hidden="true"></div>
              <div className="start-footer-curtain__grid" aria-hidden="true"></div>

      <footer className="start-footer">
          <div className="start-footer__top">
              <div className="start-footer__brand">
                  <img src="/brand/nexa-logo.svg" alt="NEXA" className="start-footer__mark" width="1007" height="176" decoding="async" />
                  <p>A private messenger for free speech and quiet minds — locked on your device, open in your browser.</p>
                  <div className="start-footer__social">
                      <a href="https://github.com/shytyk-develop" target="_blank" rel="noopener noreferrer" aria-label="GitHub"><svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.56 0-.27-.01-1.17-.02-2.12-3.2.7-3.87-1.36-3.87-1.36-.52-1.33-1.28-1.68-1.28-1.68-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.18 1.76 1.18 1.03 1.75 2.69 1.25 3.34.95.1-.74.4-1.25.72-1.54-2.55-.29-5.23-1.28-5.23-5.68 0-1.26.45-2.28 1.18-3.09-.12-.29-.51-1.46.11-3.05 0 0 .96-.31 3.15 1.18a10.9 10.9 0 0 1 5.74 0c2.18-1.49 3.14-1.18 3.14-1.18.63 1.59.23 2.76.12 3.05.73.81 1.18 1.83 1.18 3.09 0 4.41-2.69 5.38-5.25 5.66.41.35.77 1.05.77 2.12 0 1.53-.01 2.76-.01 3.14 0 .3.2.67.8.55A11.51 11.51 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5z"/></svg></a>
                      <a href="https://www.linkedin.com/in/jan-shytyk/" target="_blank" rel="noopener noreferrer" aria-label="LinkedIn"><svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M20.45 20.45h-3.55v-5.57c0-1.33-.03-3.04-1.85-3.04-1.86 0-2.14 1.45-2.14 2.94v5.67H9.35V9h3.41v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28zM5.34 7.43a2.06 2.06 0 1 1 0-4.12 2.06 2.06 0 0 1 0 4.12zM7.12 20.45H3.56V9h3.56v11.45z"/></svg></a>
                      <a href="#" aria-label="X"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M4 4l16 16M20 4 4 20"/></svg></a>
                  </div>
              </div>
              <nav className="start-footer__cols" aria-label="Footer">
                  <div className="start-footer__col">
                      <h4>Product</h4>
                      <a href="#features">Features</a>
                      <a href="#product">Look inside</a>
                      <a href="#security">How it stays safe</a>
                      <a href="#faq">FAQ</a>
                  </div>
                  <div className="start-footer__col">
                      <h4>Company</h4>
                      <a href="#">About</a>
                      <a href="#">Blog</a>
                      <a href="#">Careers</a>
                  </div>
                  <div className="start-footer__col">
                      <h4>Resources</h4>
                      <a href="#">Help center</a>
                      <a href="#">Self-hosting</a>
                      <a href="#">Status</a>
                  </div>
                  <div className="start-footer__col">
                      <h4>Legal</h4>
                      <a href="#">Privacy</a>
                      <a href="#">Terms</a>
                  </div>
              </nav>
          </div>

          <div className="start-footer__wordmark" aria-hidden="true">
              <img src="/brand/nexa-logo.svg" alt="" decoding="async" />
          </div>

          <div className="start-footer__bottom">
              <span>© 2026 NEXA — Speak freely</span>
              <span>Locked on your device. Open in your browser.</span>
          </div>
      </footer>
          </div>
      </div>
    </>
  );
}
