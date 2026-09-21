import './splitcards.css';
export function SplitCards() {
  return (
    <>
      <div className="start-split start-split--flip">
          <div className="start-split__visual" data-reveal>
              <div className="start-card start-card--chat">
                  <div className="start-chatmock">
                      <div className="start-chatmock__row">
                          <span className="start-chatmock__avatar" aria-hidden="true"></span>
                          <div className="start-chatmock__bubble">Can I say this here?</div>
                      </div>
                      <div className="start-chatmock__row start-chatmock__row--out">
                          <div className="start-chatmock__bubble start-chatmock__bubble--out">Yes. Only we can open it.</div>
                      </div>
                      <div className="start-chatmock__row">
                          <span className="start-chatmock__avatar" aria-hidden="true"></span>
                          <div className="start-chatmock__bubble start-chatmock__bubble--typing"><span></span><span></span><span></span></div>
                      </div>
                      <p className="start-chatmock__meta">Read · just now</p>
                  </div>
              </div>
          </div>
          <div className="start-split__copy" data-reveal>
              <p className="start-eyebrow">The feeling</p>
              <h3 className="start-h3">Talk like nobody’s listening</h3>
              <p className="start-lead">Freedom of speech starts with feeling safe. NEXA is still a normal chat — replies, reactions, “typing…” — just without the quiet worry that someone else is in the room.</p>
              <ul className="start-checks">
                  <li><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75"><circle cx="12" cy="12" r="9"/><path d="m8.5 12.2 2.4 2.4 4.6-5"/></svg>Instant messages, just like you’d expect</li>
                  <li><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75"><circle cx="12" cy="12" r="9"/><path d="m8.5 12.2 2.4 2.4 4.6-5"/></svg>You choose what others can see about you</li>
                  <li><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75"><circle cx="12" cy="12" r="9"/><path d="m8.5 12.2 2.4 2.4 4.6-5"/></svg>Messages wait safely if someone’s offline</li>
              </ul>
              <a href="/login" data-link className="start-btn start-btn--ghost">Try a real conversation<span className="start-btn__arrow" aria-hidden="true">→</span></a>
          </div>
      </div>
    </>
  );
}
