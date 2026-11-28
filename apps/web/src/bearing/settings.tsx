import "./pages-you.css";
import { Link } from "@tanstack/react-router";
import { ChevronDown, ChevronLeft, LogIn, Settings as Gear, UserRound } from "lucide-react";
import type { ReactNode } from "react";
import { type Account, useAccount } from "../lib/account";
import { reader } from "../lib/backend";
import {
  BOARDS,
  type BoardStyle,
  PIECES,
  type PieceSet,
  type Prefs,
  setPrefs,
  usePrefs,
} from "../lib/prefs";
import { pinned, useMinute } from "../lib/world";
import { useOrigin } from "./shell";
import { CardSky } from "./sky";
import { useTimes } from "./time";
import { Segmented, TopCard } from "./ui";

const THEMES = [
  { value: "system", label: "As the device" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
] as const satisfies readonly { value: Prefs["theme"]; label: string }[];

const HOURS = [
  { value: "auto", label: "As the device" },
  { value: "24", label: "24 hours" },
  { value: "12", label: "12 hours" },
] as const satisfies readonly { value: Prefs["hours"]; label: string }[];

const PIECE_NAMES: Record<PieceSet, string> = {
  mpchess: "Modern",
  cburnett: "Classic",
  merida: "Merida",
};
const PIECE_SETS = PIECES.map((value) => ({ value, label: PIECE_NAMES[value] }));

const BOARD_NAMES: Record<BoardStyle, string> = {
  indigo: "Indigo",
  ink: "Ink",
  slate: "Slate",
  green: "Green",
  walnut: "Walnut",
};

function zones(): string[] {
  try {
    return Intl.supportedValuesOf("timeZone");
  } catch {
    return [];
  }
}

/** One setting: its name, a line under it only where the control does not say it, the control. */
function Row({ name, line, children }: { name: string; line?: ReactNode; children: ReactNode }) {
  return (
    <div className="bx-set-row">
      <div>
        <b>{name}</b>
        {line ? <span>{line}</span> : null}
      </div>
      {children}
    </div>
  );
}

/** The viewer in the top card: their picture or initial, a figure, or a gear with no accounts. */
function Face({ account }: { account: Account }) {
  if (account.state === "in") {
    return (
      <span className="bx-set-av">
        {account.image ? (
          <img src={account.image} alt="" />
        ) : (
          <b aria-hidden>{(account.name ?? account.email ?? "?").slice(0, 1).toUpperCase()}</b>
        )}
      </span>
    );
  }
  return (
    <span className="bx-set-av" aria-hidden>
      {account.state === "none" ? <Gear size={30} /> : <UserRound size={30} />}
    </span>
  );
}

function who(account: Account): string {
  switch (account.state) {
    case "in": {
      const name = account.name ?? account.email ?? "you";
      const mail = account.email && account.email !== name ? ` (${account.email})` : "";
      return `Signed in as ${name}${mail}. What you follow is the same on every device.`;
    }
    case "out":
      return "Not signed in. What you follow is kept on this device; signing in keeps it the same on every device.";
    case "none":
      return "This copy of Kiming runs without accounts. What you follow is kept on this device.";
    default:
      return "Looking for your account.";
  }
}

/** Appearance and time. These stay on this device; an account holds follows and nothing else. */
export function Settings() {
  const prefs = usePrefs();
  const times = useTimes();
  const now = useMinute();
  const origin = useOrigin();
  const account = useAccount();
  const device = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return (
    <div className="bx-page-set bx-set">
      <Link to={origin.to} className="bx-back">
        <ChevronLeft size={18} />
        {origin.label}
      </Link>

      <TopCard className="bx-stage">
        <CardSky />
        <div className="bx-ent-in">
          <div className="bx-eh">
            <Face account={account} />
            <div>
              <h1>Settings</h1>
              <p>{who(account)}</p>
            </div>
            {account.state === "in" ? (
              <div className="bx-eh-acts">
                <button type="button" className="bx-btn" data-k="quiet" onClick={account.manage}>
                  Manage account
                </button>
                <button type="button" className="bx-btn" data-k="quiet" onClick={account.signOut}>
                  Sign out
                </button>
              </div>
            ) : account.state === "out" ? (
              <div className="bx-eh-acts">
                <Link to="/sign-in" search={{ from: "/settings" }} className="bx-btn" data-k="main">
                  <LogIn size={16} aria-hidden />
                  Sign in or create an account
                </Link>
              </div>
            ) : null}
          </div>
        </div>
      </TopCard>

      <h2 className="bx-h2">Look</h2>
      <div className="bx-panel">
        <Row name="Appearance">
          <Segmented
            options={THEMES}
            value={prefs.theme}
            onChange={(theme) => setPrefs({ theme })}
            label="Appearance"
          />
        </Row>
      </div>

      <h2 className="bx-h2">Time</h2>
      <div className="bx-panel">
        <Row
          name="Clock"
          line={`It is ${times.clock(now)} on ${times.date(now)}${times.zone ? ` (${times.zone})` : ""}.`}
        >
          <Segmented
            options={HOURS}
            value={prefs.hours}
            onChange={(hours) => setPrefs({ hours })}
            label="Clock"
          />
        </Row>
        <Row name="Time zone">
          <label className="bx-set-sel">
            <span className="bx-only">Time zone</span>
            <select
              value={prefs.zone ?? ""}
              onChange={(e) => setPrefs({ zone: e.target.value || null })}
            >
              <option value="">As the device ({device})</option>
              {zones().map((z) => (
                <option key={z} value={z}>
                  {z.replaceAll("_", " ")}
                </option>
              ))}
            </select>
            <ChevronDown size={16} aria-hidden />
          </label>
        </Row>
      </div>

      <h2 className="bx-h2">Chess</h2>
      <div className="bx-panel">
        <Row name="Pieces">
          <Segmented
            options={PIECE_SETS}
            value={prefs.pieces}
            onChange={(pieces) => setPrefs({ pieces })}
            label="Pieces"
          />
        </Row>
        <Row name="Board">
          <div className="bx-set-sws" role="group" aria-label="Board">
            {BOARDS.map((name) => (
              <button
                key={name}
                type="button"
                data-board={name}
                aria-pressed={prefs.board === name}
                aria-label={BOARD_NAMES[name]}
                title={BOARD_NAMES[name]}
                onClick={() => setPrefs({ board: name })}
              />
            ))}
          </div>
        </Row>
      </div>

      <h2 className="bx-h2">The data</h2>
      <div className="bx-panel bx-set-text">
        {pinned() ? (
          <p>
            Kiming is running on sample data: real names, fictional events and generated results.
            The live matches are played forward faster than real time so that there is something to
            follow.{" "}
            {reader
              ? "The sample is kept on the server, so every open screen sees the same moment."
              : "The sample is kept in this browser and starts again when the page is reloaded."}
          </p>
        ) : (
          <p>
            What Kiming shows is real, and comes from those who publish it: schedules, results and
            line-ups from PandaScore; the inside of League of Legends games from lolesports.com and
            Leaguepedia (CC BY-SA 3.0); chess from Lichess broadcasts; the Counter-Strike ranking
            from Valve. Every match and event names its sources and when they were last asked, at
            the foot of its page.
          </p>
        )}
        {account.state === "none" ? null : (
          <p>
            An account holds an email address and the list of what you follow, nothing else. The
            settings on this page stay on this device.
          </p>
        )}
      </div>
    </div>
  );
}
