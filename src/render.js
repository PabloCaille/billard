export function drawTable(ctx, width, height) {
  ctx.fillStyle = "#5a3a1a";            // bois
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = "#1e7a3c";            // tapis
  ctx.fillRect(30, 30, width - 60, height - 60);
}

export function drawBall(ctx, x, y, radius, color) {
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
}