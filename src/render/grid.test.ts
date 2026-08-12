import { describe, expect, it } from 'vitest';
import { applyStuckiDither, createGridGeometry } from './grid';

describe('createGridGeometry', () => {
  it('never upsamples ASCII beyond one sample per output pixel', () => {
    const geometry = createGridGeometry(1920, 1080, 'ascii', 0.3, 1, 1);
    expect(geometry.stepX).toBe(1);
    expect(geometry.numCols).toBe(1920);
    expect(geometry.numRows).toBe(1080);
  });

  it('keeps grid cells centered when dimensions do not divide evenly', () => {
    const geometry = createGridGeometry(101, 51, 'dot', 0.6, 20, 1);
    expect(geometry.numCols).toBe(5);
    expect(geometry.numRows).toBe(2);
    expect(geometry.offsetX).toBeCloseTo(0.5);
    expect(geometry.offsetY).toBeCloseTo(5.5);
  });

  it('clamps an oversized grid to the canvas bounds', () => {
    const geometry = createGridGeometry(40, 30, 'dot', 0.6, 200, 1);
    expect(geometry).toMatchObject({
      baseGrid: 30,
      stepX: 30,
      stepY: 30,
      numCols: 1,
      numRows: 1,
      offsetX: 5,
      offsetY: 0,
    });
  });
});

describe('applyStuckiDither', () => {
  it('produces binary output for every cell', () => {
    const values = new Float32Array([0.1, 0.4, 0.7, 0.9]);
    applyStuckiDither(values, 2, 2, 0.5, 1);
    expect(Array.from(values).every((value) => value === 0 || value === 1)).toBe(true);
  });
});
