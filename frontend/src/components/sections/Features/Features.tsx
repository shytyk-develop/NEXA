import type { CSSProperties } from 'react';
import { SplitCards } from '../SplitCards/SplitCards';
import './features.css';

export function Features() {
  return (
      <section id="features" className="start-section">
          <header className="start-head start-head--center" data-reveal>
              <p className="start-eyebrow">Getting started</p>
              <h2 className="start-h2">Four steps.<br /><span className="start-h2__dim">Then you’re in.</span></h2>
              <p className="start-lead">No install maze. No phone number. Open Nexa, pick a name, find someone, and start talking — privately.</p>
          </header>

          <div className="start-fc" data-feature-carousel data-reveal>
              <div className="start-fc__shell">
                  <div className="start-fc__frame">
                      <div className="start-fc__animated" data-fc-animated>
                          <div className="start-fc__card" data-fc-card>
                              <div className="start-fc__inner">
                                  <div className="start-fc__copy" data-fc-copy>
                                      <h3 className="start-fc__title" data-fc-title>1. Open</h3>
                                      <div className="start-fc__desc-wrap" data-fc-desc-wrap>
                                          <p className="start-fc__desc" data-fc-desc>No app store. No download. Just visit the site and you’re already in the right place.</p>
                                      </div>
                                  </div>

                                  <div className="start-fc__stage" aria-hidden="true">
                                      {/* Step 1 — Open */}
                                      <div className="start-fc__panel is-active" data-fc-panel="0">
                                          <div className="start-fc__shot start-fc__shot--s1a" data-fc-shot>
                                              <div className="fcui fcui--browser">
                                                  <div className="fcui__bar">
                                                      <div className="fcui__lights" aria-hidden="true"><i></i><i></i><i></i></div>
                                                      <div className="fcui__omni">
                                                          <svg className="fcui__omni-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>
                                                          <span className="fcui__omni-url">nexa.chat</span>
                                                      </div>
                                                  </div>
                                                  <div className="fcui__body fcui__body--center fcui__body--dots">
                                                      <img className="fcui__mark fcui__seq fcui__seq--1" src="/brand/nexa-logo.svg" alt="" width="1007" height="176" decoding="async" />
                                                      <p className="fcui__tagline fcui__seq fcui__seq--2">Private · End-to-end encrypted</p>
                                                      <span className="fcui__cta fcui__seq fcui__seq--3">Get started</span>
                                                      <div className="fcui__chips fcui__seq fcui__late">
                                                          <span>No install</span>
                                                          <span>No phone number</span>
                                                          <span>No tracking</span>
                                                      </div>
                                                  </div>
                                              </div>
                                          </div>
                                      </div>

                                      {/* Step 2 — Username */}
                                      <div className="start-fc__panel" data-fc-panel="1">
                                          <div className="start-fc__shot start-fc__shot--s2a" data-fc-shot>
                                              <div className="fcui fcui--pad">
                                                  <img className="fcui__mark fcui__mark--sm fcui__seq fcui__seq--1" src="/brand/nexa-logo.svg" alt="" width="1007" height="176" decoding="async" />
                                                  <div className="fcui__field is-focus fcui__seq fcui__seq--2">
                                                      <span className="fcui__field-prefix">nexa.chat/</span>
                                                      <span className="fcui__field-value"><span className="fcui__type" style={{ ['--chars']: 5 } as CSSProperties}>alice</span><span className="fcui__caret"></span></span>
                                                      <span className="fcui__field-ok" aria-hidden="true">
                                                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="m5 12 5 5L20 7"/></svg>
                                                      </span>
                                                  </div>
                                                  <p className="fcui__hint fcui__seq fcui__seq--3">This will be your unique public username.</p>
                                                  <span className="fcui__cta fcui__cta--end fcui__seq fcui__late">Continue →</span>
                                              </div>
                                          </div>
                                      </div>

                                      {/* Step 3 — Find */}
                                      <div className="start-fc__panel" data-fc-panel="2">
                                          <div className="start-fc__shot start-fc__shot--s3b" data-fc-shot>
                                              <div className="fcui fcui--preview">
                                                  <p className="fcui__preview-kicker fcui__seq fcui__seq--1">Profile preview</p>
                                                  <div className="fcui__preview-stage">
                                                      <div className="fcui__preview-bg" aria-hidden="true">
                                                          <div className="fcui__preview-grid"></div>
                                                          <img className="fcui__preview-mark" src="/brand/nexa-logo.svg" alt="" decoding="async" />
                                                      </div>
                                                      <div className="fcui__preview-card fcui__seq fcui__seq--2">
                                                          <span className="fcui__avatar fcui__avatar--lg fcui__avatar--rose fcui__seq fcui__seq--3">AS</span>
                                                          <p className="fcui__preview-name fcui__seq fcui__seq--4">Alice Sterling</p>
                                                          <p className="fcui__preview-handle fcui__seq fcui__late">@alice</p>
                                                          <p className="fcui__preview-bio fcui__seq fcui__late--2">Private by default.</p>
                                                          <p className="fcui__preview-status fcui__seq fcui__late--3"><i></i>Available</p>
                                                      </div>
                                                  </div>
                                              </div>
                                          </div>
                                          <div className="start-fc__shot start-fc__shot--s3a" data-fc-shot>
                                              <div className="fcui fcui--pad">
                                                  <img className="fcui__mark fcui__mark--sm" src="/brand/nexa-logo.svg" alt="" width="1007" height="176" decoding="async" />
                                                  <div className="fcui__search is-focus fcui__seq fcui__seq--1">
                                                      <svg className="fcui__search-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
                                                      <span className="fcui__search-value"><span className="fcui__type" style={{ ['--chars']: 5 } as CSSProperties}>alice</span><span className="fcui__caret"></span></span>
                                                      <span className="fcui__search-x" aria-hidden="true">×</span>
                                                  </div>
                                                  <p className="fcui__label fcui__seq fcui__seq--2">Contacts</p>
                                                  <div className="fcui__contact fcui__seq fcui__late">
                                                      <span className="fcui__avatar">AS</span>
                                                      <div className="fcui__contact-meta">
                                                          <div className="fcui__contact-top"><strong>Alice Sterling</strong><span>@alice</span></div>
                                                          <div className="fcui__contact-bottom"><em>Secure channel</em><i className="fcui__presence"></i></div>
                                                      </div>
                                                  </div>
                                              </div>
                                          </div>
                                      </div>

                                      {/* Step 4 — Talk */}
                                      <div className="start-fc__panel" data-fc-panel="3">
                                          <div className="start-fc__shot start-fc__shot--s4a" data-fc-shot>
                                              <div className="fcui fcui--chat">
                                                  <div className="fcui__chat-head">
                                                      <svg className="fcui__back" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true"><path d="M15 18l-6-6 6-6"/></svg>
                                                      <span className="fcui__avatar fcui__avatar--sm">AS</span>
                                                      <div className="fcui__ident">
                                                          <strong>Alice Sterling <span>@alice</span></strong>
                                                          <span className="fcui__online"><i></i>Online</span>
                                                      </div>
                                                      <div className="fcui__chat-tools" aria-hidden="true">
                                                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
                                                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75"><path d="m6 9 6 6 6-6"/></svg>
                                                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75"><circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/></svg>
                                                      </div>
                                                  </div>
                                                  <div className="fcui__chat">
                                                      <div className="fcui__msg fcui__msg--own fcui__seq fcui__seq--2">
                                                          <div className="fcui__bubble">
                                                              <span className="fcui__bubble-text">Hi Alice! Are you free August 10?</span>
                                                              <span className="fcui__bubble-meta"><span>16:57</span><i>✓✓</i></span>
                                                          </div>
                                                      </div>
                                                      <div className="fcui__msg fcui__msg--other fcui__seq fcui__late">
                                                          <div className="fcui__bubble">
                                                              <span className="fcui__bubble-text">Yes — let’s do morning.</span>
                                                              <span className="fcui__bubble-meta"><span>16:58</span></span>
                                                          </div>
                                                          <span className="fcui__react fcui__seq fcui__late--2" aria-hidden="true">❤️</span>
                                                      </div>
                                                      <div className="fcui__msg fcui__msg--own fcui__seq fcui__late--3">
                                                          <div className="fcui__bubble">
                                                              <span className="fcui__bubble-text">Perfect. 10am works.</span>
                                                              <span className="fcui__bubble-meta"><span>16:59</span><i>✓✓</i></span>
                                                          </div>
                                                      </div>
                                                      <div className="fcui__composer">
                                                          <svg className="fcui__attach" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true"><path d="m21.44 11.05-8.49 8.49a5.5 5.5 0 0 1-7.78-7.78l8.49-8.49a3.5 3.5 0 0 1 4.95 4.95l-8.5 8.49a1.5 1.5 0 1 1-2.12-2.12l7.78-7.78"/></svg>
                                                          <span className="fcui__composer-text">Write a message…</span>
                                                          <span className="fcui__send" aria-hidden="true">
                                                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 19V5M5 12l7-7 7 7"/></svg>
                                                          </span>
                                                      </div>
                                                  </div>
                                              </div>
                                          </div>
                                      </div>
                                  </div>

                                  <div className="start-fc__steps-layer">
                                      <nav className="start-fc__steps" aria-label="Getting started steps">
                                          <ol className="start-fc__steps-list" role="list">
                                              <li className="start-fc__pill is-active" data-fc-step-pill="0" role="button" tabIndex={0} aria-current="step">
                                                  <span className="start-fc__pill-row">
                                                      <span className="start-fc__pill-dot">
                                                          <span className="start-fc__pill-num">1</span>
                                                          <svg className="start-fc__pill-check" viewBox="0 0 256 256" fill="currentColor" aria-hidden="true"><path d="m229.66 77.66-128 128a8 8 0 0 1-11.32 0l-56-56a8 8 0 0 1 11.32-11.32L96 188.69 218.34 66.34a8 8 0 0 1 11.32 11.32Z"/></svg>
                                                      </span>
                                                      <span className="start-fc__pill-label">Open</span>
                                                  </span>
                                              </li>
                                              <li className="start-fc__pill" data-fc-step-pill="1" role="button" tabIndex={0}>
                                                  <span className="start-fc__pill-row">
                                                      <span className="start-fc__pill-dot">
                                                          <span className="start-fc__pill-num">2</span>
                                                          <svg className="start-fc__pill-check" viewBox="0 0 256 256" fill="currentColor" aria-hidden="true"><path d="m229.66 77.66-128 128a8 8 0 0 1-11.32 0l-56-56a8 8 0 0 1 11.32-11.32L96 188.69 218.34 66.34a8 8 0 0 1 11.32 11.32Z"/></svg>
                                                      </span>
                                                      <span className="start-fc__pill-label">Username</span>
                                                  </span>
                                              </li>
                                              <li className="start-fc__pill" data-fc-step-pill="2" role="button" tabIndex={0}>
                                                  <span className="start-fc__pill-row">
                                                      <span className="start-fc__pill-dot">
                                                          <span className="start-fc__pill-num">3</span>
                                                          <svg className="start-fc__pill-check" viewBox="0 0 256 256" fill="currentColor" aria-hidden="true"><path d="m229.66 77.66-128 128a8 8 0 0 1-11.32 0l-56-56a8 8 0 0 1 11.32-11.32L96 188.69 218.34 66.34a8 8 0 0 1 11.32 11.32Z"/></svg>
                                                      </span>
                                                      <span className="start-fc__pill-label">Find</span>
                                                  </span>
                                              </li>
                                              <li className="start-fc__pill" data-fc-step-pill="3" role="button" tabIndex={0}>
                                                  <span className="start-fc__pill-row">
                                                      <span className="start-fc__pill-dot">
                                                          <span className="start-fc__pill-num">4</span>
                                                          <svg className="start-fc__pill-check" viewBox="0 0 256 256" fill="currentColor" aria-hidden="true"><path d="m229.66 77.66-128 128a8 8 0 0 1-11.32 0l-56-56a8 8 0 0 1 11.32-11.32L96 188.69 218.34 66.34a8 8 0 0 1 11.32 11.32Z"/></svg>
                                                      </span>
                                                      <span className="start-fc__pill-label">Talk</span>
                                                  </span>
                                              </li>
                                          </ol>
                                      </nav>
                                  </div>

                                  <button type="button" className="start-fc__hit" data-fc-hit aria-label="Next step"></button>
                              </div>
                          </div>
                      </div>
                  </div>
              </div>
          </div>

          <SplitCards />
      </section>
  );
}
