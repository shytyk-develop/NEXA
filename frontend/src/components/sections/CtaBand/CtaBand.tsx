import './ctaband.css';
export function CtaBand() {
  return (
    <>
      <div className="start-cta-band" data-reveal data-cta-band>
          <div className="start-cta-band__group" data-cta-group>
              <div className="start-cta-band__item" data-cta-item>
                  <div className="start-cta-band__inner">
                      <div className="start-cta-band__particles" data-cta-particles aria-hidden="true"></div>
                      <img
                          className="start-cta-band__watermark"
                          src="/brand/nexa-logo.svg"
                          alt=""
                          width="1007"
                          height="176"
                          decoding="async"
                          aria-hidden="true"
                       />

                      <div className="start-cta-band__layout">
                          <div className="start-cta-band__copy">
                              <p className="start-cta-band__eyebrow">Ready when you are</p>
                              <div className="start-cta-band__headline">
                                  <h2 className="start-cta-band__title">Speak freely.<br />Start here.</h2>
                                  <div className="start-cta-band__actions">
                                      <a href="/login" data-link className="start-btn start-btn--primary">Open messenger<span className="start-btn__arrow" aria-hidden="true">→</span></a>
                                  </div>
                              </div>
                              <p className="start-cta-band__text">No install. No phone number. Just a quiet place to say what you mean — and keep it between you and the people you trust.</p>
                          </div>

                          <div className="start-cta-band__stage" data-cta-stage>
                              <span className="start-cta-band__chip" data-cta-chip>Encrypted</span>
                              <span className="start-cta-band__chip" data-cta-chip>No phone number</span>
                              <span className="start-cta-band__chip" data-cta-chip>Device keys</span>
                              <span className="start-cta-band__chip" data-cta-chip>Browser-only</span>
                              <div className="start-cta-band__rail" aria-hidden="true"></div>
                              <div className="start-cta-band__pointer" data-cta-pointer aria-hidden="true">
                                  <svg width="17" height="18" viewBox="0 0 12 13" fill="currentColor" stroke="#0a0a0a" strokeWidth="1" xmlns="http://www.w3.org/2000/svg">
                                      <path fillRule="evenodd" clipRule="evenodd" d="M12 5.50676L0 0L2.83818 13L6.30623 7.86537L12 5.50676V5.50676Z"/>
                                  </svg>
                                  <span className="start-cta-band__pointer-label" data-cta-pointer-label>You</span>
                              </div>
                          </div>
                      </div>
                  </div>
              </div>
          </div>
      </div>
    </>
  );
}
