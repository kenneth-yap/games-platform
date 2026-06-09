// A minimal login/register form. Calls the auth functions and reports
// success/failure. On login success, notifies the parent via onAuthChange.

import { useState } from "react";
import { register, login } from "./api/scores";

function AuthForm({ onAuthChange }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState(null);

  async function handleLogin() {
    setMessage(null);
    try {
      await login(username, password);
      onAuthChange();              // tell the app we're now logged in
    } catch (err) {
      setMessage(err.message);
    }
  }

  async function handleRegister() {
    setMessage(null);
    try {
      await register(username, password);
      setMessage("Account created — now log in.");
    } catch (err) {
      setMessage(err.message);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", maxWidth: "240px", margin: "0 auto" }}>
      <input
        type="text"
        placeholder="Username"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        style={{ padding: "0.4rem" }}
      />
      <input
        type="password"
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        style={{ padding: "0.4rem" }}
      />
      <div style={{ display: "flex", gap: "0.5rem" }}>
        <button onClick={handleLogin} style={{ flex: 1 }}>Log in</button>
        <button onClick={handleRegister} style={{ flex: 1 }}>Register</button>
      </div>
      {message && <p style={{ fontSize: "0.8rem", color: "#e0a96c" }}>{message}</p>}
    </div>
  );
}

export default AuthForm;