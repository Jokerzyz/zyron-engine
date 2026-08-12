import JSZip from 'jszip';

interface ZipFilePayload {
  name: string;
  data: ArrayBuffer;
}

self.onmessage = async (event: MessageEvent<{ files: ZipFilePayload[] }>) => {
  try {
    const zip = new JSZip();
    for (const file of event.data.files) zip.file(file.name, file.data);
    const blob = await zip.generateAsync({ type: 'blob' }, (meta) => {
      self.postMessage({ type: 'progress', percent: meta.percent });
    });
    self.postMessage({ type: 'complete', blob });
  } catch (error) {
    self.postMessage({ type: 'error', message: error instanceof Error ? error.message : 'ZIP generation failed.' });
  }
};
