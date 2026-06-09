// Tic-Tac-Toe — a React component matching the platform's patterns.
//
// WHERE THIS GOES: clients/tetris-client/src/TicTacToe.jsx
// (You'll wire it into the app yourself — see homework.md)
//
// Like the Tetris component, this plays the game entirely on the frontend,
// and on game-over submits a score through the EXISTING API layer
// (submitScore from ./api/scores). The score submission is the ONLY backend
// touch — gameplay produces a result, then one call hands it over.
//
// IMPORTANT: this submits to game "tictactoe". For that to work, your BACKEND
// must have a tictactoe game registered that conforms to the Game contract.
// Building that backend piece is your homework.
//
// Scoring choice (you can change this): a win = 100 points, a draw = 30,
// a loss = 0. The raw payload sent to the backend reflects the outcome so
// your backend contract can validate and score it.

import { useState } from "react";
import { submitScore, isLoggedIn } from "./api/scores";

// The 8 winning lines (rows, columns, diagonals) as board-index triples.
const WIN_LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],   // rows
  [0, 3, 6], [1, 4, 7], [2, 5, 8],   // columns
  [0, 4, 8], [2, 4, 6],              // diagonals
];

// Given a board, return "X", "O", or null for the winner.
function getWinner(board) {
  for (const [a, b, c] of WIN_LINES) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return board[a];
    }
  }
  return null;
}

// A simple computer opponent: take a win if available, block the player's
// win if needed, otherwise take centre, else a random free cell.
function computerMove(board) {
  const free = board.map((v, i) => (v === null ? i : null)).filter((i) => i !== null);

  // 1. Win if possible.
  for (const i of free) {
    const test = [...board];
    test[i] = "O";
    if (getWinner(test) === "O") return i;
  }
  // 2. Block the player's win.
  for (const i of free) {
    const test = [...board];
    test[i] = "X";
    if (getWinner(test) === "X") return i;
  }
  // 3. Take centre.
  if (board[4] === null) return 4;
  // 4. Otherwise random.
  return free[Math.floor(Math.random() * free.length)];
}

function TicTacToe() {
  const [board, setBoard] = useState(Array(9).fill(null));
  const [playerTurn, setPlayerTurn] = useState(true);   // player is "X"
  const [result, setResult] = useState(null);            // "win" | "loss" | "draw" | null
  const [submitMsg, setSubmitMsg] = useState(null);
  const [moves, setMoves] = useState(0);
  const [loggedIn] = useState(isLoggedIn());

  // Resolve the board into a result, and if the game is over, submit a score.
  function resolve(newBoard, movesPlayed) {
    const winner = getWinner(newBoard);
    const full = newBoard.every((c) => c !== null);

    if (winner === "X") return finish(newBoard, "win", movesPlayed);
    if (winner === "O") return finish(newBoard, "loss", movesPlayed);
    if (full) return finish(newBoard, "draw", movesPlayed);
    return false;   // game continues
  }

  function finish(finalBoard, outcome, movesPlayed) {
    setBoard(finalBoard);
    setResult(outcome);

    if (!loggedIn) {
      setSubmitMsg("Sign in to save your result!");
      return true;
    }

    // Submit the result to the backend. The raw payload describes the
    // outcome; your backend contract validates it and computes the value.
    submitScore("tictactoe", {
      outcome: outcome,          // "win" | "loss" | "draw"
      moves: movesPlayed,        // how many moves the player made
      went_first: true,          // player always goes first here
    })
      .then(() => setSubmitMsg("Result saved!"))
      .catch((err) => setSubmitMsg(err.message));
    return true;
  }

  function handleClick(i) {
    if (board[i] !== null || result || !playerTurn) return;

    // Player ("X") moves.
    const afterPlayer = [...board];
    afterPlayer[i] = "X";
    const movesPlayed = moves + 1;
    setMoves(movesPlayed);

    if (resolve(afterPlayer, movesPlayed)) return;  // player's move ended it
    setBoard(afterPlayer);
    setPlayerTurn(false);

    // Computer ("O") responds after a short pause.
    setTimeout(() => {
      const compIndex = computerMove(afterPlayer);
      const afterComp = [...afterPlayer];
      afterComp[compIndex] = "O";
      if (resolve(afterComp, movesPlayed)) return;
      setBoard(afterComp);
      setPlayerTurn(true);
    }, 350);
  }

  function reset() {
    setBoard(Array(9).fill(null));
    setPlayerTurn(true);
    setResult(null);
    setSubmitMsg(null);
    setMoves(0);
  }

  const statusText = result
    ? result === "win" ? "You win!" : result === "loss" ? "You lose." : "Draw."
    : playerTurn ? "Your move (X)" : "Thinking...";

  return (
    <div style={styles.wrap}>
      <h2 style={styles.title}>TIC-TAC-TOE</h2>
      <p style={styles.status}>{statusText}</p>

      <div style={styles.board}>
        {board.map((cell, i) => (
          <button
            key={i}
            style={styles.cell}
            onClick={() => handleClick(i)}
            disabled={cell !== null || result !== null}
          >
            {cell}
          </button>
        ))}
      </div>

      {result && (
        <div style={styles.overlay}>
          {submitMsg && <p style={styles.msg}>{submitMsg}</p>}
          <button style={styles.button} onClick={reset}>Play again</button>
        </div>
      )}
    </div>
  );
}

const styles = {
  wrap: { textAlign: "center", fontFamily: "'Courier New', monospace", color: "#e6e8ec" },
  title: { letterSpacing: "0.3em", fontWeight: 700, fontSize: "1.5rem", marginBottom: "0.5rem" },
  status: { fontSize: "0.9rem", color: "#8a8f99", marginBottom: "1rem", minHeight: "1.2rem" },
  board: {
    display: "grid", gridTemplateColumns: "repeat(3, 72px)",
    gridTemplateRows: "repeat(3, 72px)", gap: "4px",
    justifyContent: "center", margin: "0 auto",
  },
  cell: {
    width: 72, height: 72, fontSize: "2rem", fontWeight: 700,
    background: "#10131a", color: "#5ad1c8", border: "1px solid #1c2029",
    borderRadius: "4px", cursor: "pointer", fontFamily: "inherit",
  },
  overlay: { marginTop: "1rem" },
  msg: { fontSize: "0.85rem", color: "#7bc96f", marginBottom: "0.5rem" },
  button: {
    padding: "0.6rem 1.6rem", fontSize: "1rem", background: "#5ad1c8",
    color: "#0a0c10", border: "none", borderRadius: "4px", cursor: "pointer",
    fontWeight: 700, fontFamily: "inherit", letterSpacing: "0.1em",
  },
};

export default TicTacToe;
