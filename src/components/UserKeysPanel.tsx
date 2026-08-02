import { useEffect, useState } from "react";
import {
  clearUserKeys,
  getUserKeys,
  saveUserKeys,
  type UserKeys,
  userKeysStatus,
} from "@/lib/userKeys";

export function UserKeysPanel() {
  const [keys, setKeys] = useState<UserKeys>(() => getUserKeys());
  const [saved, setSaved] = useState(false);
  const [ready, setReady] = useState(() => userKeysStatus().openrouter);

  useEffect(() => {
    setKeys(getUserKeys());
    setReady(userKeysStatus().openrouter);
  }, []);

  function onSave(e: React.FormEvent) {
    e.preventDefault();
    saveUserKeys(keys);
    setReady(userKeysStatus().openrouter);
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2000);
  }

  return (
    <form
      className="panel form-grid"
      onSubmit={onSave}
      style={{ maxWidth: 560, marginTop: "1.25rem" }}
    >
      <div>
        <h2
          style={{
            margin: "0 0 0.35rem",
            fontFamily: "var(--display)",
            fontSize: "1.35rem",
          }}
        >
          OpenRouter AI key (optional)
        </h2>
        <p className="muted" style={{ margin: 0, fontSize: "0.9rem" }}>
          AI match brief + WhatsApp text use the <strong>admin OpenRouter key</strong> by
          default. Optionally paste your own key to use your credits instead. Saved only
          in this browser.
        </p>
        <p className="muted" style={{ margin: "0.55rem 0 0", fontSize: "0.88rem" }}>
          <strong>Twilio</strong> voice calls always use admin keys in <code>.env.local</code>.
        </p>
      </div>

      <span className={`badge ${ready ? "badge-ok" : "badge-ok"}`}>
        OpenRouter AI: {ready ? "using your key" : "using admin key"}
      </span>

      <label>
        OpenRouter API key
        <input
          type="password"
          value={keys.openrouterApiKey}
          onChange={(e) =>
            setKeys((prev) => ({ ...prev, openrouterApiKey: e.target.value }))
          }
          placeholder="sk-or-v1-…"
          autoComplete="off"
          spellCheck={false}
        />
      </label>

      {saved && <div className="alert alert-info">Your OpenRouter key saved in this browser.</div>}

      <div className="cta-row">
        <button className="btn btn-primary" type="submit">
          Save AI key
        </button>
        <button
          className="btn btn-ghost"
          type="button"
          onClick={() => {
            clearUserKeys();
            setKeys(getUserKeys());
            setReady(false);
          }}
        >
          Clear key
        </button>
      </div>
    </form>
  );
}
