import { useEffect, useRef } from "react";

export default function RetroBackground() {
  const canvasRef = useRef(null);
  const mouseRef = useRef({ x: 0.5, y: 0.5 });
  const rafRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    const onResize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    onResize();
    window.addEventListener("resize", onResize);

    const onMouseMove = (e) => {
      mouseRef.current = {
        x: e.clientX / window.innerWidth,
        y: e.clientY / window.innerHeight,
      };
    };
    window.addEventListener("mousemove", onMouseMove);

    const draw = () => {
      const { width, height } = canvas;
      const mx = mouseRef.current.x - 0.5; // -0.5 to 0.5
      const my = mouseRef.current.y - 0.5;

      ctx.clearRect(0, 0, width, height);

      const horizonY = height * 0.58 + my * 35;
      const vanishX  = width  * 0.5  + mx * 90;

      ctx.strokeStyle = "rgba(57,255,20,0.5)";
      ctx.lineWidth = 1;

      // Vertical convergence lines: spread across the bottom, all meeting at the vanishing point
      const NUM_V = 18;
      for (let i = 0; i <= NUM_V; i++) {
        const bx = (width / NUM_V) * i;
        ctx.beginPath();
        ctx.moveTo(bx, height);
        ctx.lineTo(vanishX, horizonY);
        ctx.stroke();
      }

      // Horizontal foreshortened lines between horizon and bottom
      const NUM_H = 12;
      for (let i = 1; i <= NUM_H; i++) {
        const frac = Math.pow(i / NUM_H, 1.9);
        const y = horizonY + (height - horizonY) * frac;
        // Clip the line to where the vertical lines actually are at this y
        const depth = (y - horizonY) / (height - horizonY);
        const lx = vanishX + (0     - vanishX) * depth;
        const rx = vanishX + (width - vanishX) * depth;
        ctx.globalAlpha = 0.15 + 0.65 * frac;
        ctx.beginPath();
        ctx.moveTo(lx, y);
        ctx.lineTo(rx, y);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;

      // Neon glow stripe at the horizon
      const grad = ctx.createLinearGradient(0, horizonY - 24, 0, horizonY + 24);
      grad.addColorStop(0,   "transparent");
      grad.addColorStop(0.5, "rgba(57,255,20,0.22)");
      grad.addColorStop(1,   "transparent");
      ctx.fillStyle = grad;
      ctx.fillRect(0, horizonY - 24, width, 48);

      // Faint sky glow above the horizon
      const skyGrad = ctx.createLinearGradient(0, 0, 0, horizonY);
      skyGrad.addColorStop(0,   "rgba(10,0,30,0)");
      skyGrad.addColorStop(1,   "rgba(57,255,20,0.04)");
      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, width, horizonY);

      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("mousemove", onMouseMove);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{ position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none" }}
    />
  );
}
