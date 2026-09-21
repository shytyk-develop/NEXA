import type { CSSProperties } from 'react';
import './orbit.css';
export function Orbit() {
  return (
    <>
      <section id="security" className="start-section start-orbit">
          <header className="start-head start-head--center" data-reveal>
              <p className="start-eyebrow">How it stays safe</p>
              <h2 className="start-h2">Strong under the hood.<br /><span className="start-h2__dim">Simple on the surface.</span></h2>
              <p className="start-lead">You don’t need to understand the math to feel protected. Everything hard runs quietly in the background — so you can just talk.</p>
          </header>

          <div className="start-orbit__stage" data-orbit data-reveal>
              <div className="start-orbit__glow" aria-hidden="true"></div>
              <div className="start-orbit__ring start-orbit__ring--outer" aria-hidden="true"></div>
              <div className="start-orbit__ring start-orbit__ring--dash" aria-hidden="true"></div>

              <div className="start-orbit__center" aria-hidden="true">
                  <span className="start-orbit__center-ping"></span>
                  <span className="start-orbit__center-ping start-orbit__center-ping--late"></span>
                  <img
                      className="start-orbit__center-mark"
                      src="/brand/nexa-icon-circle.png"
                      alt=""
                      width="177"
                      height="177"
                      decoding="async"
                   />
              </div>

              <div className="start-orbit__field">
                  <div className="start-orbit__node" role="button" tabIndex={0} data-orbit-id="1" data-related="2,4" style={{ ['--orbit-energy']: 90 } as CSSProperties} aria-expanded="false">
                      <span className="start-orbit__pulse" aria-hidden="true"></span>
                      <span className="start-orbit__tile" aria-hidden="true">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                      </span>
                      <span className="start-orbit__label">Locked</span>
                      <article className="start-orbit__card">
                          <div className="start-orbit__card-stem" aria-hidden="true"></div>
                          <header className="start-orbit__card-head">
                              <span className="start-orbit__badge">Always on</span>
                              <span className="start-orbit__meta">On device</span>
                          </header>
                          <h4>Locked on your device</h4>
                          <p>Each message is sealed before it leaves your browser. What travels the network is scrambled — useless without your key.</p>
                          <span className="start-orbit__detail">AES-GCM · RSA-OAEP</span>
                          <div className="start-orbit__links">
                              <span className="start-orbit__links-label">Connected</span>
                              <button type="button" className="start-orbit__chip" data-orbit-goto="2">Keys <span aria-hidden="true">→</span></button>
                              <button type="button" className="start-orbit__chip" data-orbit-goto="4">Delivery <span aria-hidden="true">→</span></button>
                          </div>
                      </article>
                  </div>

                  <div className="start-orbit__node" role="button" tabIndex={0} data-orbit-id="2" data-related="1,3" style={{ ['--orbit-energy']: 80 } as CSSProperties} aria-expanded="false">
                      <span className="start-orbit__pulse" aria-hidden="true"></span>
                      <span className="start-orbit__tile" aria-hidden="true">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75"><circle cx="7.5" cy="15.5" r="4.5"/><path d="m10.7 12.3 9.3-9.3M16 5l3 3M13 8l3 3"/></svg>
                      </span>
                      <span className="start-orbit__label">Keys</span>
                      <article className="start-orbit__card">
                          <div className="start-orbit__card-stem" aria-hidden="true"></div>
                          <header className="start-orbit__card-head">
                              <span className="start-orbit__badge">Local only</span>
                              <span className="start-orbit__meta">Your password</span>
                          </header>
                          <h4>Keys stay with you</h4>
                          <p>Your private key is born on your device and protected by your password. We never see it in a form we can use.</p>
                          <span className="start-orbit__detail">Generated locally · password-wrapped backup</span>
                          <div className="start-orbit__links">
                              <span className="start-orbit__links-label">Connected</span>
                              <button type="button" className="start-orbit__chip" data-orbit-goto="1">Locked <span aria-hidden="true">→</span></button>
                              <button type="button" className="start-orbit__chip" data-orbit-goto="3">Private <span aria-hidden="true">→</span></button>
                          </div>
                      </article>
                  </div>

                  <div className="start-orbit__node" role="button" tabIndex={0} data-orbit-id="3" data-related="2,4" style={{ ['--orbit-energy']: 70 } as CSSProperties} aria-expanded="false">
                      <span className="start-orbit__pulse" aria-hidden="true"></span>
                      <span className="start-orbit__tile" aria-hidden="true">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75"><path d="M3 3l18 18M10.6 5.1A10.9 10.9 0 0 1 12 5c7 0 10 7 10 7a17.6 17.6 0 0 1-3.2 4.2M6.6 6.6C3.7 8.5 2 12 2 12s3 7 10 7c1.5 0 2.8-.3 4-.8"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/></svg>
                      </span>
                      <span className="start-orbit__label">Private</span>
                      <article className="start-orbit__card">
                          <div className="start-orbit__card-stem" aria-hidden="true"></div>
                          <header className="start-orbit__card-head">
                              <span className="start-orbit__badge">Unreadable</span>
                              <span className="start-orbit__meta">In transit</span>
                          </header>
                          <h4>Talk like nobody’s listening</h4>
                          <p>Even if someone intercepts a message on the way, all they get is noise. Without your key, there’s nothing to open.</p>
                          <span className="start-orbit__detail">Ciphertext only · no plaintext path</span>
                          <div className="start-orbit__links">
                              <span className="start-orbit__links-label">Connected</span>
                              <button type="button" className="start-orbit__chip" data-orbit-goto="2">Keys <span aria-hidden="true">→</span></button>
                              <button type="button" className="start-orbit__chip" data-orbit-goto="4">Delivery <span aria-hidden="true">→</span></button>
                          </div>
                      </article>
                  </div>

                  <div className="start-orbit__node" role="button" tabIndex={0} data-orbit-id="4" data-related="1,3" style={{ ['--orbit-energy']: 85 } as CSSProperties} aria-expanded="false">
                      <span className="start-orbit__pulse" aria-hidden="true"></span>
                      <span className="start-orbit__tile" aria-hidden="true">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75"><rect x="3" y="4" width="18" height="7" rx="2"/><rect x="3" y="13" width="18" height="7" rx="2"/><path d="M7 7.5h.01M7 16.5h.01"/></svg>
                      </span>
                      <span className="start-orbit__label">Delivery</span>
                      <article className="start-orbit__card">
                          <div className="start-orbit__card-stem" aria-hidden="true"></div>
                          <header className="start-orbit__card-head">
                              <span className="start-orbit__badge">Our job</span>
                              <span className="start-orbit__meta">Servers</span>
                          </header>
                          <h4>We deliver, we don’t read</h4>
                          <p>Our servers move messages and store only the locked version. Routing is our job. Reading is not.</p>
                          <span className="start-orbit__detail">Ciphertext only · open source</span>
                          <div className="start-orbit__links">
                              <span className="start-orbit__links-label">Connected</span>
                              <button type="button" className="start-orbit__chip" data-orbit-goto="1">Locked <span aria-hidden="true">→</span></button>
                              <button type="button" className="start-orbit__chip" data-orbit-goto="3">Private <span aria-hidden="true">→</span></button>
                          </div>
                      </article>
                  </div>
              </div>
          </div>
      </section>
    </>
  );
}
