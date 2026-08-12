export interface ZipFrame {
  name: string;
  data: ArrayBuffer;
}
export function packageZipFrames(
  files: ZipFrame[],
  signal: AbortSignal,
  onProgress: (percent: number) => void,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./zip-worker.ts', import.meta.url), { type: 'module' });
    const abort = () => {
      worker.terminate();
      reject(new DOMException('Export cancelled.', 'AbortError'));
    };
    if (signal.aborted) {
      abort();
      return;
    }
    signal.addEventListener('abort', abort, { once: true });
    worker.onmessage = (event: MessageEvent<{ type: string; percent?: number; blob?: Blob; message?: string }>) => {
      if (event.data.type === 'progress') onProgress(event.data.percent ?? 0);
      if (event.data.type === 'complete' && event.data.blob) {
        signal.removeEventListener('abort', abort);
        worker.terminate();
        resolve(event.data.blob);
      }
      if (event.data.type === 'error') {
        signal.removeEventListener('abort', abort);
        worker.terminate();
        reject(new Error(event.data.message ?? 'ZIP generation failed.'));
      }
    };
    worker.onerror = (event) => {
      signal.removeEventListener('abort', abort);
      worker.terminate();
      reject(new Error(event.message || 'ZIP worker failed.'));
    };
    const transferables = files.map((file) => file.data);
    worker.postMessage({ files }, transferables);
  });
}
