"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";

export function PasswordField() {
  const [visible, setVisible] = useState(false);

  return (
    <label>
      Password
      <span className="password-wrap">
        <input
          name="password"
          type={visible ? "text" : "password"}
          autoComplete="current-password"
          required
        />
        <button
          aria-label={visible ? "Hide password" : "Show password"}
          className="icon-button"
          onClick={() => setVisible((value) => !value)}
          title={visible ? "Hide password" : "Show password"}
          type="button"
        >
          {visible ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </span>
    </label>
  );
}
