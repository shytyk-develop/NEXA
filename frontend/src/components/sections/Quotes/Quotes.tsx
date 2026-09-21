import './quotes.css';
export function Quotes() {
  return (
    <>
      <section className="start-section start-quotes">
          <header className="start-head start-head--center" data-reveal>
              <p className="start-eyebrow">People like you</p>
              <h2 className="start-h2">Finally, a chat that<br /><span className="start-h2__dim">doesn’t feel watched</span></h2>
              <p className="start-lead">Stories from people who wanted a quieter, freer place to talk.</p>
          </header>

          <div className="start-quotes__stage" data-reveal>
              <figure className="start-quote is-active" data-quote>
                  <blockquote>“I used to delete half of what I typed. Here I just… write. Knowing it stays between us changed everything.”</blockquote>
                  <figcaption>
                      <span className="start-quote__avatar" aria-hidden="true"></span>
                      <div>
                          <strong>Maya</strong>
                          <span>Journalist</span>
                      </div>
                  </figcaption>
              </figure>
              <figure className="start-quote" data-quote>
                  <blockquote>“No app store, no phone number, no weird permissions. I opened a tab and felt lighter in five minutes.”</blockquote>
                  <figcaption>
                      <span className="start-quote__avatar" aria-hidden="true"></span>
                      <div>
                          <strong>Leo</strong>
                          <span>Student</span>
                      </div>
                  </figcaption>
              </figure>
              <figure className="start-quote" data-quote>
                  <blockquote>“I care about privacy, but I’m not an engineer. NEXA doesn’t make me feel dumb for wanting both safety and a normal chat.”</blockquote>
                  <figcaption>
                      <span className="start-quote__avatar" aria-hidden="true"></span>
                      <div>
                          <strong>Nina</strong>
                          <span>Teacher</span>
                      </div>
                  </figcaption>
              </figure>
          </div>

          <div className="start-quotes__dots" data-reveal-stagger>
              <button type="button" className="is-active" data-quote-dot aria-label="Testimonial 1"></button>
              <button type="button" data-quote-dot aria-label="Testimonial 2"></button>
              <button type="button" data-quote-dot aria-label="Testimonial 3"></button>
          </div>
      </section>
    </>
  );
}
