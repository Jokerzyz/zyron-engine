type FrameCallback = () => void;
type ContinuePredicate = () => boolean;

export class VideoFrameScheduler {
  private animationFrameId: number | null = null;
  private videoFrameCallbackId: number | null = null;
  private video: HTMLVideoElement | null = null;
  private generation = 0;

  stop(): void {
    this.generation += 1;
    if (this.video && this.videoFrameCallbackId !== null && typeof this.video.cancelVideoFrameCallback === 'function') {
      this.video.cancelVideoFrameCallback(this.videoFrameCallbackId);
    }
    if (this.animationFrameId !== null) cancelAnimationFrame(this.animationFrameId);
    this.videoFrameCallbackId = null;
    this.animationFrameId = null;
    this.video = null;
  }

  start(video: HTMLVideoElement, shouldContinue: ContinuePredicate, renderFrame: FrameCallback, onError: (error: unknown) => void): void {
    this.stop();
    this.video = video;
    const generation = this.generation;
    const active = () => this.video === video && generation === this.generation && shouldContinue();

    if (typeof video.requestVideoFrameCallback === 'function') {
      const onVideoFrame: VideoFrameRequestCallback = () => {
        if (!active()) return;
        try { renderFrame(); } catch (error) { onError(error); }
        this.videoFrameCallbackId = video.requestVideoFrameCallback(onVideoFrame);
      };
      this.videoFrameCallbackId = video.requestVideoFrameCallback(onVideoFrame);
      return;
    }

    const onAnimationFrame = () => {
      if (!active()) return;
      try { renderFrame(); } catch (error) { onError(error); }
      this.animationFrameId = requestAnimationFrame(onAnimationFrame);
    };
    this.animationFrameId = requestAnimationFrame(onAnimationFrame);
  }
}
