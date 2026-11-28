import "./pages-you.css";
import { Link } from "@tanstack/react-router";
import { X } from "lucide-react";
import { SignInForm, useAccount } from "../lib/account";
import { useWide } from "./board";
import { Logo } from "./logo";
import { SkyScene } from "./sky";

/**
 * Signing in (brand book §11): the whole sky at the viewer's hour, the one place inside the
 * product where the display size is used. The sentence stands large on the left and the form
 * sits beside it in a pane of dark glass; on a phone the words come first and the form under
 * them. Where signing in is not possible, the pane says so in place of the form.
 */
export function SignInPage({ back }: { back: string }) {
  const account = useAccount();
  const wide = useWide();
  return (
    <div className="bx bx-signin bx-onsky bx-sin" data-theme="dark">
      {wide ? (
        <SkyScene width={1600} height={1000} horizon={0.94} stars={260} grain />
      ) : (
        <SkyScene width={800} height={1500} horizon={0.5} stars={160} grain />
      )}
      <header className="bx-sin-top">
        <Link to="/" className="bx-sin-logo" aria-label="Kiming: today">
          <Logo height={20} />
        </Link>
        <Link to={back} className="bx-sin-x" aria-label="Not now" title="Not now">
          <X size={20} />
        </Link>
      </header>
      <main className="bx-sin-main">
        <div className="bx-sin-words">
          <h1>Everything you follow, coming into view.</h1>
          {account.state === "out" || account.state === "loading" ? (
            <p>Sign in to keep your teams, players and events the same on every device.</p>
          ) : null}
        </div>
        <div className="bx-sin-pane">
          {account.state === "in" ? (
            <>
              <b>You're signed in</b>
              <p>
                {account.email ? `As ${account.email}. ` : ""}What you follow is the same on every
                device.
              </p>
              <Link to={back} className="bx-sin-go">
                Carry on
              </Link>
            </>
          ) : account.state === "none" ? (
            <>
              <b>Signing in is not available</b>
              <p>
                This copy of Kiming runs without accounts. What you follow is kept on this device.
              </p>
              <Link to={back} className="bx-sin-go">
                Carry on
              </Link>
            </>
          ) : (
            <>
              <b>Sign in or create an account</b>
              <div className="bx-sin-form">
                <SignInForm back={back}>
                  <small>No account yet? Enter your email, and one is made for you.</small>
                </SignInForm>
              </div>
              <Link to={back} className="bx-sin-alt">
                Not now, look around first
              </Link>
            </>
          )}
        </div>
      </main>
      <footer className="bx-sin-foot">
        Counter-Strike · League of Legends · Rocket League · Chess · Trackmania
      </footer>
    </div>
  );
}
