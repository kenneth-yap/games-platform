import { useState } from "react";
import { register, login } from "./api/scores";

function AuthForm({ onAuthChange }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState(null);
  const [isError, setIsError] = useState(false);

  async function handleLogin() {
    setMessage(null);
    try {
      await login(username, password);
      onAuthChange();
    } catch (err) {
      setIsError(true);
      setMessage(err.message);
    }
  }

  async function handleRegister() {
    setMessage(null);
    try {
      await register(username, password);
      setIsError(false);
      setMessage("ACCOUNT CREATED — NOW LOG IN.");
    } catch (err) {
      setIsError(true);
      setMessage(err.message);
    }
  }

  return (
    <div style={styles.wrap}>
      <input
        type="text"
        placeholder="USERNAME"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        style={styles.input}
      />
      <input
        type="password"
        placeholder="PASSWORD"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        style={styles.input}
        onKeyDown={(e) => e.key === "Enter" && handleLogin()}
      />
      <div style={styles.btnRow}>
        <button onClick={handleLogin} style={{ ...styles.btn, ...styles.btnLogin }}>LOG IN</button>
        <button onClick={handleRegister} style={styles.btn}>REGISTER</button>
      </div>
      {message && (
        <p style={{ ...styles.msg, color: isError ? "#ff8c00" : "#39ff14" }}>{message}</p>
      )}
    </div>
  );
}

const styles = {
  wrap: { display: "flex", flexDirection: "column", gap: "0.8rem" },
  input: {
    padding: "0.6rem 0.8rem",
    background: "rgba(0,245,255,0.05)",
    border: "1px solid rgba(0,245,255,0.3)",
    color: "#00f5ff",
    fontSize: "0.7rem",
    letterSpacing: "0.1em",
    outline: "none",
    width: "100%",
  },
  btnRow: { display: "flex", gap: "0.6rem" },
  btn: {
    flex: 1,
    padding: "0.6rem 0",
    fontSize: "0.65rem",
    background: "transparent",
    color: "rgba(0,245,255,0.7)",
    border: "1px solid rgba(0,245,255,0.3)",
    letterSpacing: "0.12em",
    cursor: "pointer",
  },
  btnLogin: {
    color: "#ff2d78",
    border: "1px solid #ff2d78",
    textShadow: "0 0 6px #ff2d78",
  },
  msg: { fontSize: "0.65rem", letterSpacing: "0.08em", marginTop: "0.2rem" },
};

export default AuthForm;
