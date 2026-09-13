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
import { submitScore } from "./api/scores";

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

function TicTacToe({ loggedIn }) {
  const [board, setBoard] = useState(Array(9).fill(null));
  const [playerTurn, setPlayerTurn] = useState(true);
  const [result, setResult] = useState(null);
  const [submitMsg, setSubmitMsg] = useState(null);
  const [moves, setMoves] = useState(0);

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

    submitScore("tictactoe", {
      outcome: outcome,
      moves: movesPlayed,
      went_first: true,
    })
      .then(() => setSubmitMsg(loggedIn ? "RESULT SAVED!" : "GUEST SCORE (28 DAYS)"))
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
  wrap: { textAlign: "center", color: "#00f5ff" },
  title: { letterSpacing: "0.3em", fontSize: "1.5rem", marginBottom: "0.8rem", color: "#bf5fff", textShadow: "0 0 8px #bf5fff, 0 0 20px #bf5fff" },
  status: { fontSize: "0.72rem", color: "rgba(0,245,255,0.55)", marginBottom: "1.2rem", minHeight: "1.2rem", letterSpacing: "0.1em" },
  board: {
    display: "grid", gridTemplateColumns: "repeat(3, 80px)",
    gridTemplateRows: "repeat(3, 80px)", gap: "4px",
    justifyContent: "center", margin: "0 auto",
  },
  cell: {
    width: 80, height: 80, fontSize: "1.8rem",
    background: "#060010", border: "1px solid rgba(191,95,255,0.3)",
    cursor: "pointer", color: "#ff2d78",
  },
  overlay: { marginTop: "1.2rem" },
  msg: { fontSize: "0.75rem", color: "#39ff14", marginBottom: "0.6rem" },
  button: {
    padding: "0.6rem 1.6rem", fontSize: "0.72rem", background: "transparent",
    color: "#bf5fff", border: "2px solid #bf5fff", cursor: "pointer",
    letterSpacing: "0.15em", textShadow: "0 0 6px #bf5fff",
    boxShadow: "0 0 10px rgba(191,95,255,0.3)",
  },
};

export default TicTacToe;
