import { Button } from '../../ui/Button';
import './nav.css';
export function Nav() {
  return (
    <>
      <header className="start-nav">
          <div className="start-nav__row">
              <div className="start-nav__brand">
                  <img src="/brand/nexa-logo.svg" alt="NEXA" className="start-nav__mark" width="1007" height="176" decoding="async" />
              </div>

              <nav className="start-nav__links" aria-label="Sections">
                  <a href="#features" className="start-nav__link">Features</a>
                  <a href="#product" className="start-nav__link">Product</a>
                  <a href="#security" className="start-nav__link">Safety</a>
                  <a href="#faq" className="start-nav__link">FAQ</a>
              </nav>

              <div className="start-nav__actions">
                  <Button variant="nav" href="/login" data-link>Log in</Button>
                  <Button variant="navPrimary" href="/login" data-link>Get started</Button>
              </div>

              <button id="startNavToggle" type="button" className="start-nav__toggle" aria-expanded="false" aria-controls="startNavMenu" aria-label="Open menu">
                  <span className="start-nav__burger" aria-hidden="true">
                      <span></span>
                      <span></span>
                      <span></span>
                  </span>
              </button>
          </div>

          <div id="startNavMenu" className="start-nav__menu" hidden={true} aria-hidden="true">
              <div className="start-nav__menu-panel">
                  <div className="start-nav__menu-links">
                      <a href="#features" className="start-nav__link">Features</a>
                      <a href="#product" className="start-nav__link">Product</a>
                      <a href="#security" className="start-nav__link">Safety</a>
                      <a href="#faq" className="start-nav__link">FAQ</a>
                  </div>
                  <div className="start-nav__menu-actions">
                      <Button variant="nav" href="/login" data-link>Log in</Button>
                      <Button variant="navPrimary" href="/login" data-link>Get started</Button>
                  </div>
              </div>
          </div>
      </header>
    </>
  );
}
