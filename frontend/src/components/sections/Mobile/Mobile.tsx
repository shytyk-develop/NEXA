import './mobile.css';
export function Mobile() {
  return (
    <>
      <section id="mobile" className="start-section start-mobile">
          <div className="start-mobile__panel">
              <div className="start-mobile__copy" data-reveal>
                  <p className="start-eyebrow start-mobile__eyebrow">
                      <svg className="start-mobile__eyebrow-apple" viewBox="0 0 24 24" aria-hidden="true">
                          <path fill="currentColor" d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
                      </svg>
                      Mobile experience
                  </p>
                  <h2 className="start-h2 start-mobile__title">
                      <span className="start-h2__dim">Private.</span><br />
                      <span className="start-h2__dim">Encrypted.</span><br />
                      Always with you.
                  </h2>
                  <p className="start-lead start-mobile__lead">The full NEXA experience in your pocket. Secure messaging, end-to-end encrypted. Built for privacy. Designed for everywhere.</p>

                  <div className="start-mobile__cta">
                      <a
                          className="start-mobile__store"
                          href="https://apps.apple.com/"
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label="Download on the App Store"
                      >
                          <span className="start-mobile__store-edge start-mobile__store-edge--top" aria-hidden="true"></span>
                          <span className="start-mobile__store-edge start-mobile__store-edge--bot" aria-hidden="true"></span>
                          <svg className="start-mobile__apple" viewBox="0 0 24 24" aria-hidden="true">
                              <path fill="currentColor" d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
                          </svg>
                          <span className="start-mobile__store-text">
                              <span className="start-mobile__store-kicker">Download on the</span>
                              <span className="start-mobile__store-name">App Store</span>
                          </span>
                      </a>
                      <p className="start-mobile__note">
                          <svg className="start-mobile__note-arrow" viewBox="0 0 40 18" fill="none" aria-hidden="true">
                              <path d="M36 9H8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/>
                              <path d="M14 3.5 6 9l8 5.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                          <span>Available on iOS<br />and macOS</span>
                      </p>
                  </div>

                  <ul className="start-mobile__feats">
                      <li>
                          <span className="start-mobile__feat-ico" aria-hidden="true">
                              <span className="start-mobile__feat-edge start-mobile__feat-edge--top"></span>
                              <span className="start-mobile__feat-edge start-mobile__feat-edge--bot"></span>
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>
                          </span>
                          <span className="start-mobile__feat-text">End-to-end<br />encrypted</span>
                      </li>
                      <li>
                          <span className="start-mobile__feat-ico" aria-hidden="true">
                              <span className="start-mobile__feat-edge start-mobile__feat-edge--top"></span>
                              <span className="start-mobile__feat-edge start-mobile__feat-edge--bot"></span>
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M12 3 4.5 6.5v5c0 4.4 3.1 8.4 7.5 9.5 4.4-1.1 7.5-5.1 7.5-9.5v-5L12 3z"/></svg>
                          </span>
                          <span className="start-mobile__feat-text">No tracking<br />No ads</span>
                      </li>
                      <li>
                          <span className="start-mobile__feat-ico" aria-hidden="true">
                              <span className="start-mobile__feat-edge start-mobile__feat-edge--top"></span>
                              <span className="start-mobile__feat-edge start-mobile__feat-edge--bot"></span>
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M7 18a4.5 4.5 0 0 1 .4-9 6 6 0 0 1 11.5 1.8A3.7 3.7 0 0 1 18.5 18H7z"/></svg>
                          </span>
                          <span className="start-mobile__feat-text">Your data<br />stays yours</span>
                      </li>
                  </ul>
              </div>

              <div className="start-mobile__visual" data-reveal>
                  <picture>
                      <source media="(max-width: 1023px)" srcSet="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7" />
                      <img
                          className="start-mobile__phone"
                          src="/images/nexa-iphone.jpg"
                          alt="NEXA on iPhone — Private by default"
                          width="895"
                          height="1024"
                          decoding="async"
                          loading="lazy"
                       />
                  </picture>
              </div>
          </div>
      </section>
    </>
  );
}
