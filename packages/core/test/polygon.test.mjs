import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { polygonArea, polygonCentroid } from "../dist/utils/polygon.js";

describe("polygonArea", () => {
  it("returns 0 for fewer than 3 points", () => {
    assert.equal(polygonArea([]), 0);
    assert.equal(polygonArea([[0, 0]]), 0);
    assert.equal(polygonArea([[0, 0], [1, 1]]), 0);
  });

  it("computes correct area for a unit square", () => {
    const square = [[0, 0], [1, 0], [1, 1], [0, 1]];
    assert.equal(Math.abs(polygonArea(square)), 1);
  });

  it("computes correct area for a right triangle", () => {
    const triangle = [[0, 0], [4, 0], [0, 3]];
    assert.equal(Math.abs(polygonArea(triangle)), 6);
  });

  it("handles negative (clockwise) winding", () => {
    const cw = [[0, 0], [0, 1], [1, 1], [1, 0]];
    assert.ok(polygonArea(cw) < 0);
  });

  it("handles large polygons correctly", () => {
    const n = 100;
    const circle = Array.from({ length: n }, (_, i) => {
      const angle = (2 * Math.PI * i) / n;
      return [Math.cos(angle), Math.sin(angle)];
    });
    const area = Math.abs(polygonArea(circle));
    assert.ok(Math.abs(area - Math.PI) < 0.01, `Expected ${Math.PI}, got ${area}`);
  });
});

describe("polygonCentroid", () => {
  it("returns [0,0] for empty polygon", () => {
    const [cx, cy] = polygonCentroid([]);
    assert.equal(cx, 0);
    assert.equal(cy, 0);
  });

  it("returns center of a unit square", () => {
    const square = [[0, 0], [2, 0], [2, 2], [0, 2]];
    const [cx, cy] = polygonCentroid(square);
    assert.ok(Math.abs(cx - 1) < 0.01);
    assert.ok(Math.abs(cy - 1) < 0.01);
  });

  it("handles degenerate (collinear) points with fallback", () => {
    const line = [[0, 0], [1, 0], [2, 0]];
    const [cx, cy] = polygonCentroid(line);
    assert.ok(Math.abs(cx - 1) < 0.01);
    assert.equal(cy, 0);
  });
});
