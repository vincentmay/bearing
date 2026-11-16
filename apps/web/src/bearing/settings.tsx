import { Link } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";
import { useAccount } from "../lib/account";
import { convex } from "../lib/backend";
import { type Prefs, setPrefs, usePrefs } from "../lib/prefs";
import { useMinute } from "../lib/world";
import { useOrigin } from "./shell";
import { useTimes } from "./time";
import { Section, Segmented } from "./ui";

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

function zones(): string[] {
  try {
    return Intl.supportedValuesOf("timeZone");
  } catch {
    return [];
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
    <div className="bx-page-narrow">
      <Link to={origin.to} className="bx-back">
        <ChevronLeft size={18} />
        {origin.label}
      </Link>
      <header className="bx-head" style={{ marginTop: 12 }}>
        <h1 className="bx-title">Settings</h1>
      </header>

      <Section label="Appearance">
        <Segmented
          options={THEMES}
          value={prefs.theme}
          onChange={(theme) => setPrefs({ theme })}
          label="Appearance"
        />
      </Section>

      <Section label="Clock">
        <Segmented
          options={HOURS}
          value={prefs.hours}
          onChange={(hours) => setPrefs({ hours })}
          label="Clock"
        />
        <p className="bx-note">
          It is {times.clock(now)} on {times.date(now)}
          {times.zone ? ` (${times.zone})` : ""}. Every time in Bearing is shown this way.
        </p>
      </Section>

      <Section label="Time zone">
        <label className="bx-field" style={{ marginTop: 0 }}>
          <span className="bx-only">Time zone</span>
          <select
            value={prefs.zone ?? ""}
            onChange={(e) => setPrefs({ zone: e.target.value || null })}
            style={{
              all: "unset",
              flex: 1,
              minWidth: 0,
              font: "500 14px var(--face)",
              color: "var(--ink)",
              cursor: "pointer",
            }}
          >
            <option value="">As the device ({device})</option>
            {zones().map((z) => (
              <option key={z} value={z}>
                {z.replaceAll("_", " ")}
              </option>
            ))}
          </select>
        </label>
      </Section>

      <Section label="Account">
        <div className="bx-list">
          {account.state === "in" ? (
            <div className="bx-result">
              <span>
                <b>{account.email ?? "Signed in"}</b>
                <span className="bx-sub">
                  What you follow is kept in your account and is the same on every device.
                </span>
              </span>
            </div>
          ) : (
            <p className="bx-empty">
              {account.state === "none"
                ? "This copy of Bearing runs without accounts. What you follow is kept on this device."
                : "You do not need an account. What you follow is kept on this device; signing in keeps it the same on every device."}
            </p>
          )}
        </div>
        {account.state === "out" ? (
          <p style={{ margin: "12px 0 0" }}>
            <button type="button" className="bx-button" onClick={account.signIn}>
              Sign in or create an account
            </button>
          </p>
        ) : null}
        {account.state === "in" ? (
          <p className="bx-row" style={{ margin: "12px 0 0", gap: 8, flexWrap: "wrap" }}>
            <button type="button" className="bx-button" onClick={account.manage}>
              Manage account
            </button>
            <button type="button" className="bx-button bx-button-quiet" onClick={account.signOut}>
              Sign out
            </button>
          </p>
        ) : null}
        <p className="bx-note">
          An account holds an email address and the list of what you follow, nothing else. The
          settings above stay on this device.
        </p>
      </Section>

      <Section label="The data">
        <div className="bx-list">
          <p className="bx-empty">
            Bearing is running on sample data: real names, fictional events and generated results.
            The live matches are played forward faster than real time so that there is something to
            follow.{" "}
            {convex
              ? "The sample is kept on the server, so every open screen sees the same moment."
              : "The sample is kept in this browser and starts again when the page is reloaded."}
          </p>
        </div>
      </Section>
    </div>
  );
}
