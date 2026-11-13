import type { District } from "./types";

// Shared borders make one continuous city; district centers are also street junctions.
const borders = [
  [[15, 35], [172, 22], [342, 38], [488, 15], [650, 45]],
  [[24, 210], [186, 198], [320, 222], [500, 205], [646, 222]],
  [[12, 390], [162, 374], [348, 396], [484, 382], [654, 375]],
  [[28, 558], [174, 574], [326, 550], [504, 567], [640, 555]],
];

export function districtPolygon(d: Pick<District, "row" | "col">): number[][] {
  return [borders[d.row][d.col], borders[d.row][d.col + 1], borders[d.row + 1][d.col + 1], borders[d.row + 1][d.col]];
}

export function districtPoint(d: Pick<District, "row" | "col">): { x: number; y: number } {
  const points = districtPolygon(d);
  return { x: points.reduce((sum, p) => sum + p[0], 0) / 4, y: points.reduce((sum, p) => sum + p[1], 0) / 4 };
}
