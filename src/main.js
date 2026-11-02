import { drawTable, drawBall } from "./render.js";

const canvas = document.getElementById("table");
const ctx = canvas.getContext("2d");

drawTable(ctx, canvas.width, canvas.height);
drawBall(ctx, 250, 250, 12, "white");