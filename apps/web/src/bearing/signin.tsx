import { Link } from "@tanstack/react-router";
import { X } from "lucide-react";
import { SignInForm, useAccount } from "../lib/account";
import { useWide } from "./board";
import { Logo } from "./logo";
import { SkyScene } from "./sky";

/**
 * Signing in (brand book §11): the whole sky at the viewer's hour, the one place inside the
 * product where the display size is used. The form is plain; the sky does the welcoming. On a
 * phone the sky holds the top of the screen and the form sits where it has faded into the night.
 */
export function SignInPage({ back }: { back: string }) {
  const account = useAccount();
  const wide = useWide();
  return (
    <div className="bx bx-signin bx-onsky" data-theme="dark">
      {wide ? (
        <SkyScene width={1600} height={1000} horizon={0.94} stars={260} grain />
      ) : (
        <SkyScene width={800} height={1500} horizon={0.5} stars={160} grain />
      )}
      <header className="bx-si-top">
        <Link to="/" aria-label="Kiming: today">
          <Logo height={20} />
        </Link>
        <Link to={back} className="bx-si-close" aria-label="Not now" title="Not now">
          <X size={20} />
        </Link>
      </header>
      <main className="bx-si-main">
        <div className="bx-si-words">
          <h1>Everything you follow, coming into view.</h1>
          {account.state === "in" ? (
            <p>You're signed in{account.email ? ` as ${account.email}` : ""}.</p>
          ) : account.state === "none" ? (
            <p>
              This copy of Kiming runs without accounts. What you follow is kept on this device.
            </p>
          ) : (
            <p>Sign in to keep your teams, players and events the same on every device.</p>
          )}
          {account.state === "in" || account.state === "none" ? (
            <Link to={back} className="bx-ghost">
              Carry on
            </Link>
          ) : null}
        </div>
        {account.state === "in" || account.state === "none" ? null : (
          <div className="bx-si-side">
            <div className="bx-si-form">
              <SignInForm back={back} />
              <small>No account yet? Enter your email, and one is made for you.</small>
            </div>
          </div>
        )}
      </main>
      <footer className="bx-si-foot">
        Counter-Strike · League of Legends · Rocket League · Chess · Trackmania
      </footer>
    </div>
  );
}
