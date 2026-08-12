import { afterEach, describe, expect, it, vi } from 'vitest';
import { VideoFrameScheduler } from './video-frame-scheduler';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('VideoFrameScheduler', () => {
  it('renders once per decoded frame and cancels the current callback', () => {
    let callback: VideoFrameRequestCallback | undefined;
    let nextId = 0;
    const cancel = vi.fn();
    const video = {
      requestVideoFrameCallback: vi.fn((nextCallback: VideoFrameRequestCallback) => {
        callback = nextCallback;
        nextId += 1;
        return nextId;
      }),
      cancelVideoFrameCallback: cancel,
    } as unknown as HTMLVideoElement;
    const render = vi.fn();
    const scheduler = new VideoFrameScheduler();

    scheduler.start(video, () => true, render, vi.fn());
    expect(video.requestVideoFrameCallback).toHaveBeenCalledTimes(1);

    callback?.(0, {} as VideoFrameCallbackMetadata);
    expect(render).toHaveBeenCalledTimes(1);
    expect(video.requestVideoFrameCallback).toHaveBeenCalledTimes(2);

    scheduler.stop();
    expect(cancel).toHaveBeenCalledWith(2);
    callback?.(1, {} as VideoFrameCallbackMetadata);
    expect(render).toHaveBeenCalledTimes(1);
  });

  it('falls back to requestAnimationFrame when rVFC is unavailable', () => {
    let callback: FrameRequestCallback | undefined;
    const cancel = vi.fn();
    vi.stubGlobal('requestAnimationFrame', vi.fn((nextCallback: FrameRequestCallback) => {
      callback = nextCallback;
      return 9;
    }));
    vi.stubGlobal('cancelAnimationFrame', cancel);
    const video = {} as HTMLVideoElement;
    const render = vi.fn();
    const scheduler = new VideoFrameScheduler();

    scheduler.start(video, () => true, render, vi.fn());
    callback?.(0);
    expect(render).toHaveBeenCalledTimes(1);

    scheduler.stop();
    expect(cancel).toHaveBeenCalledWith(9);
  });
});
