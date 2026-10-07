/** Browser-only accumulator; monotonic samples never count time spent unfocused. */
export type EngagementProgress = { day: string; seconds: number; submitted: boolean; eventId: string };
export class ReadingClock {
  private previous: number;
  private active: boolean;
  constructor(public progress: EngagementProgress, now: number, active: boolean) {this.previous=now;this.active=active;}
  sample(now: number, active: boolean) {
    if (this.active) this.progress.seconds += Math.max(0,now-this.previous)/1000;
    this.previous=now;this.active=active;
    return this.progress.seconds >= 45 && !this.progress.submitted;
  }
}
