import './product.css';
export function Product() {
  return (
    <>
      <section id="product" className="start-section start-product">
          <div className="start-product__layout" data-reveal>
              <div className="start-product__intro">
                  <p className="start-eyebrow">The product</p>
                  <h2 className="start-h2">One view.<br /><span className="start-h2__dim">Total privacy.</span></h2>
                  <p className="start-lead">All your conversations, tools, and security in one minimal interface. Encrypted by default. Designed for clarity.</p>
              </div>

              <div className="start-product__stage" id="product-stage" data-product-showcase>
                  <div className="start-product__glow" aria-hidden="true"></div>

                  <button
                      type="button"
                      className="start-product__frame"
                      data-product-frame
                      aria-label="Open screenshot fullscreen"
                      tabIndex={0}
                  >
                      <span className="start-product__corner start-product__corner--tl" aria-hidden="true"></span>
                      <span className="start-product__corner start-product__corner--tr" aria-hidden="true"></span>
                      <span className="start-product__corner start-product__corner--br" aria-hidden="true"></span>
                      <img
                          className="start-product__shot"
                          data-product-shot
                          src="/screenshots/chats.jpg?v=20260816"
                          alt="NEXA chats workspace"
                          width="1024"
                          height="631"
                          decoding="async"
                       />
                      <span className="start-product__hint" aria-hidden="true">
                          <svg className="ui-icon"><use href="#icon-search"/></svg>
                          <span>Tap to enlarge</span>
                      </span>
                  </button>

                  <div className="start-product__cap">
                      <span className="start-product__cap-kicker">Screen</span>
                      <span className="start-product__cap-title" data-product-title>Chats</span>
                      <span className="start-product__cap-desc" data-product-desc>Contacts, thread, and encryption in one calm view</span>
                  </div>

                  <div className="start-product__dots" role="tablist" aria-label="Product screens" data-product-dots>
                      <button type="button" className="start-product__dot is-active" role="tab" aria-selected="true" aria-label="Chats" data-src="/screenshots/chats.jpg?v=20260816" data-title="Chats" data-desc="Contacts, thread, and encryption in one calm view" data-alt="NEXA chats workspace"></button>
                      <button type="button" className="start-product__dot" role="tab" aria-selected="false" aria-label="Identity" data-src="/screenshots/profile.jpg?v=20260816" data-title="Identity" data-desc="Avatar, bio, username, and profile preview" data-alt="NEXA identity settings"></button>
                      <button type="button" className="start-product__dot" role="tab" aria-selected="false" aria-label="Security" data-src="/screenshots/security.jpg?v=20260816" data-title="Security" data-desc="Encryption status, device identity, and keys" data-alt="NEXA security settings"></button>
                      <button type="button" className="start-product__dot" role="tab" aria-selected="false" aria-label="Privacy" data-src="/screenshots/privacy.jpg?v=20260816" data-title="Privacy" data-desc="Presence, receipts, and typing — your call" data-alt="NEXA privacy settings"></button>
                      <button type="button" className="start-product__dot" role="tab" aria-selected="false" aria-label="Data" data-src="/screenshots/data.jpg?v=20260816" data-title="Data" data-desc="Storage overview, export, and local clear" data-alt="NEXA data and storage"></button>
                      <button type="button" className="start-product__dot" role="tab" aria-selected="false" aria-label="How it works" data-src="/screenshots/privacy-story.jpg?v=20260816" data-title="How it works" data-desc="Lock, transit, delivery — in plain language" data-alt="How NEXA privacy works"></button>
                  </div>
              </div>

              <div className="start-product__aside">
                  <ul className="start-product__pills">
                      <li className="start-product__pill">
                          <span className="start-product__pill-icon" aria-hidden="true"><svg className="ui-icon"><use href="#icon-message"/></svg></span>
                          <span className="start-product__pill-label">Encrypted Messaging</span>
                      </li>
                      <li className="start-product__pill">
                          <span className="start-product__pill-icon" aria-hidden="true"><svg className="ui-icon"><use href="#icon-shield"/></svg></span>
                          <span className="start-product__pill-label">End-to-End by Default</span>
                      </li>
                      <li className="start-product__pill">
                          <span className="start-product__pill-icon" aria-hidden="true"><svg className="ui-icon"><use href="#icon-eye-off"/></svg></span>
                          <span className="start-product__pill-label">No Tracking No Ads</span>
                      </li>
                      <li className="start-product__pill">
                          <span className="start-product__pill-icon" aria-hidden="true"><svg className="ui-icon"><use href="#icon-lock"/></svg></span>
                          <span className="start-product__pill-label">You Own Your Data</span>
                      </li>
                  </ul>

                  <a href="#product-stage" className="start-motion-btn start-product__cta" data-product-explore aria-label="Explore the interface">
                      <span className="start-motion-btn__circle" aria-hidden="true"></span>
                      <span className="start-motion-btn__icon" aria-hidden="true">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M13 5l7 7-7 7"/></svg>
                      </span>
                      <span className="start-motion-btn__label">Explore</span>
                  </a>

                  <p className="start-product__seal">
                      <svg className="ui-icon" aria-hidden="true"><use href="#icon-lock"/></svg>
                      <span>Private. Secure. Yours.</span>
                  </p>
              </div>
          </div>
      </section>
    </>
  );
}
