import './stats.css';
export function Stats() {
  return (
    <>
      <section id="stats" className="start-section start-stats">
          <header className="start-head start-head--center" data-reveal>
              <p className="start-eyebrow">Why NEXA</p>
              <h2 className="start-h2">Say what you mean.<br /><span className="start-h2__dim">Without fear.</span></h2>
              <p className="start-lead">Most chats leave a trail you never asked for. NEXA is a place where your thoughts can stay between the people you chose — calm, simple, and yours.</p>
          </header>

          <div className="start-stats__grid" data-reveal-stagger>
              <div className="start-stat">
                  <span className="start-stat__tag">Phone number</span>
                  <div className="start-stat__value">None</div>
                  <p className="start-stat__note">Just a username. That’s enough.</p>
              </div>
              <div className="start-stat">
                  <span className="start-stat__tag">Who can read it</span>
                  <div className="start-stat__value">You</div>
                  <p className="start-stat__note">And the person you wrote to.</p>
              </div>
              <div className="start-stat">
                  <span className="start-stat__tag">Ads &amp; trackers</span>
                  <div className="start-stat__value"><span data-count="0">0</span></div>
                  <p className="start-stat__note">Nothing to sell. Nobody to sell you to.</p>
              </div>
              <div className="start-stat">
                  <span className="start-stat__tag">To get started</span>
                  <div className="start-stat__value">1 tab</div>
                  <p className="start-stat__note">Open it. Chat. That’s the install.</p>
              </div>
          </div>
      </section>
    </>
  );
}
