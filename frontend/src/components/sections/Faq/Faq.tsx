import './faq.css';
export function Faq() {
  return (
    <>
      <section id="faq" className="start-section start-faq">
          <header className="start-head start-head--center" data-reveal>
              <p className="start-eyebrow">FAQ</p>
              <h2 className="start-h2">Questions you’re<br /><span className="start-h2__dim">allowed to ask</span></h2>
              <p className="start-lead">Worried about something? You’re not alone. Straight answers below.</p>
          </header>

          <div className="start-faq__list" data-reveal-stagger>
              <div className="start-faq__item is-open">
                  <button type="button" className="start-faq__q" aria-expanded="true">
                      <span>What is NEXA, in plain words?</span>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>
                  </button>
                  <div className="start-faq__a"><div className="start-faq__a-inner"><p>A messenger that runs in your browser. You create a username, find people, and chat. Messages are locked on your device first — so only you and the person you’re talking to can open them.</p></div></div>
              </div>
              <div className="start-faq__item">
                  <button type="button" className="start-faq__q" aria-expanded="false">
                      <span>Why should I care about privacy?</span>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>
                  </button>
                  <div className="start-faq__a"><div className="start-faq__a-inner"><p>Because free speech needs a safe room. When you’re not sure who can see your words, you start editing yourself. NEXA exists so you don’t have to.</p></div></div>
              </div>
              <div className="start-faq__item">
                  <button type="button" className="start-faq__q" aria-expanded="false">
                      <span>Can NEXA (or anyone else) read my chats?</span>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>
                  </button>
                  <div className="start-faq__a"><div className="start-faq__a-inner"><p>No. We only see the locked version of your messages — enough to deliver them, not enough to read them. Your keys never leave your device in a usable form.</p></div></div>
              </div>
              <div className="start-faq__item">
                  <button type="button" className="start-faq__q" aria-expanded="false">
                      <span>Do I need to download an app?</span>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>
                  </button>
                  <div className="start-faq__a"><div className="start-faq__a-inner"><p>No. Open the site, sign up, start chatting. No phone number, no store listing, no permission maze.</p></div></div>
              </div>
              <div className="start-faq__item">
                  <button type="button" className="start-faq__q" aria-expanded="false">
                      <span>What if I lose my password?</span>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>
                  </button>
                  <div className="start-faq__a"><div className="start-faq__a-inner"><p>Your password protects your key — and we can’t reset that for you. That’s the trade-off of real privacy: nobody, including us, can “unlock” your account from the outside. Pick something you’ll remember, and keep it safe.</p></div></div>
              </div>
          </div>
      </section>
    </>
  );
}
