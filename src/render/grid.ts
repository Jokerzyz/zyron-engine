export type RenderMode = 'dot' | 'ascii' | 'dither' | 'glass';
export type DitherMethod = 'none' | 'bayer' | 'stucki';

export interface GridGeometry {
  baseGrid: number;
  stepX: number;
  stepY: number;
  numCols: number;
  numRows: number;
  offsetX: number;
  offsetY: number;
}

export interface GridSamplingOptions {
  mode: RenderMode;
  asciiRatio: number;
  gridValue: number;
  currentScale: number;
  sourceBrightness: number;
  sourceContrast: number;
  brightness: number;
  contrast: number;
  invertMapping: boolean;
  smooth: boolean;
  dotStyle: string;
  dotCutoff: number;
  ditherThreshold: number;
  ditherMethod: DitherMethod;
  stuckiFactor: number;
}

export interface GridSample extends GridGeometry {
  gridLuma: Float32Array;
  gridColorsR: Uint8ClampedArray;
  gridColorsG: Uint8ClampedArray;
  gridColorsB: Uint8ClampedArray;
  cutoff: number;
  ditherMethod: DitherMethod;
  dStyle: string;
}

export const BAYER_8X8 = [
  [0, 32, 8, 40, 2, 34, 10, 42], [48, 16, 56, 24, 50, 18, 58, 26],
  [12, 44, 4, 36, 14, 46, 6, 38], [60, 28, 52, 20, 62, 30, 54, 22],
  [3, 35, 11, 43, 1, 33, 9, 41], [51, 19, 59, 27, 49, 17, 57, 25],
  [15, 47, 7, 39, 13, 45, 5, 37], [63, 31, 55, 23, 61, 29, 53, 21],
].map((row) => row.map((value) => (value + 0.5) / 64));

export function createGridGeometry(
  procW: number,
  procH: number,
  mode: RenderMode,
  asciiRatio: number,
  gridValue: number,
  currentScale: number,
): GridGeometry {
  const safeWidth = Math.max(1, procW);
  const safeHeight = Math.max(1, procH);
  const baseGrid = Math.min(Math.max(1, gridValue * currentScale), safeWidth, safeHeight);
  const stepX = Math.min(safeWidth, Math.max(1, mode === 'ascii' ? baseGrid * asciiRatio : baseGrid));
  const stepY = Math.min(safeHeight, Math.max(1, baseGrid));
  const numCols = Math.max(1, Math.floor(safeWidth / stepX));
  const numRows = Math.max(1, Math.floor(safeHeight / stepY));
  return {
    baseGrid,
    stepX,
    stepY,
    numCols,
    numRows,
    offsetX: (safeWidth - numCols * stepX) / 2,
    offsetY: (safeHeight - numRows * stepY) / 2,
  };
}

export function applyStuckiDither(
  gridLuma: Float32Array,
  numCols: number,
  numRows: number,
  cutoff: number,
  factor: number,
): void {
  for (let row = 0; row < numRows; row += 1) {
    for (let col = 0; col < numCols; col += 1) {
      const index = row * numCols + col;
      const oldValue = gridLuma[index];
      const newValue = oldValue >= cutoff ? 1 : 0;
      gridLuma[index] = newValue;
      const error = (oldValue - newValue) * factor;
      const distribute = (rowDelta: number, colDelta: number, weight: number) => {
        const targetRow = row + rowDelta;
        const targetCol = col + colDelta;
        if (targetRow >= 0 && targetRow < numRows && targetCol >= 0 && targetCol < numCols) {
          gridLuma[targetRow * numCols + targetCol] += error * weight;
        }
      };
      distribute(0, 1, 8 / 42); distribute(0, 2, 4 / 42);
      distribute(1, -2, 2 / 42); distribute(1, -1, 4 / 42); distribute(1, 0, 8 / 42); distribute(1, 1, 4 / 42); distribute(1, 2, 2 / 42);
      distribute(2, -2, 1 / 42); distribute(2, -1, 2 / 42); distribute(2, 0, 4 / 42); distribute(2, 1, 2 / 42); distribute(2, 2, 1 / 42);
    }
  }
}

export class GridSampler {
  private readonly canvas = document.createElement('canvas');
  private readonly context = this.canvas.getContext('2d', { alpha: false, willReadFrequently: true });

  sample(source: CanvasImageSource, sourceWidth: number, sourceHeight: number, procW: number, procH: number, options: GridSamplingOptions): GridSample {
    if (!this.context) throw new Error('Canvas 2D sampling context is unavailable.');
    const geometry = createGridGeometry(procW, procH, options.mode, options.asciiRatio, options.gridValue, options.currentScale);
    const { stepX, stepY, numCols, numRows, offsetX, offsetY } = geometry;
    if (this.canvas.width !== numCols) this.canvas.width = numCols;
    if (this.canvas.height !== numRows) this.canvas.height = numRows;
    this.context.fillStyle = '#fff';
    this.context.fillRect(0, 0, numCols, numRows);

    const sourceRatio = sourceWidth / sourceHeight;
    const destinationRatio = procW / procH;
    let drawW = procW; let drawH = procH; let drawX = 0; let drawY = 0;
    if (sourceRatio > destinationRatio) {
      drawH = procW / sourceRatio;
      drawY = (procH - drawH) / 2;
    } else {
      drawW = procH * sourceRatio;
      drawX = (procW - drawW) / 2;
    }

    this.context.filter = `brightness(${100 + options.sourceBrightness}%) contrast(${100 + options.sourceContrast}%)`;
    try {
      this.context.drawImage(source, (drawX - offsetX) / stepX, (drawY - offsetY) / stepY, drawW / stepX, drawH / stepY);
    } finally {
      this.context.filter = 'none';
    }

    const pixels = this.context.getImageData(0, 0, numCols, numRows).data;
    const contrastFactor = (259 * (options.contrast + 255)) / (255 * (259 - options.contrast));
    const cellCount = numCols * numRows;
    const gridLuma = new Float32Array(cellCount);
    const gridColorsR = new Uint8ClampedArray(cellCount);
    const gridColorsG = new Uint8ClampedArray(cellCount);
    const gridColorsB = new Uint8ClampedArray(cellCount);

    for (let cellIndex = 0; cellIndex < cellCount; cellIndex += 1) {
      const pixelIndex = cellIndex * 4;
      const r = pixels[pixelIndex]; const g = pixels[pixelIndex + 1]; const b = pixels[pixelIndex + 2];
      const adjusted = contrastFactor * ((0.299 * r + 0.587 * g + 0.114 * b) - 128) + 128 + options.brightness;
      const normalized = Math.max(0, Math.min(255, adjusted)) / 255;
      let ratio = options.invertMapping ? normalized : 1 - normalized;
      if (options.smooth && options.mode !== 'dither') ratio = ratio * ratio * (3 - 2 * ratio);
      gridLuma[cellIndex] = Math.max(0, Math.min(1, ratio));
      if (options.dotStyle === 'original') {
        gridColorsR[cellIndex] = r; gridColorsG[cellIndex] = g; gridColorsB[cellIndex] = b;
      }
    }

    const cutoff = options.mode === 'dither' ? options.ditherThreshold : options.dotCutoff;
    if (options.mode === 'dither' && options.ditherMethod === 'stucki') {
      applyStuckiDither(gridLuma, numCols, numRows, cutoff, options.stuckiFactor);
    }

    return { ...geometry, gridLuma, gridColorsR, gridColorsG, gridColorsB, cutoff, ditherMethod: options.mode === 'dither' ? options.ditherMethod : 'none', dStyle: options.dotStyle };
  }
}
