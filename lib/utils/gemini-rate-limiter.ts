/**
 * Gemini Rate Limiter & Token Manager
 * Prevents hitting TPM (Tokens Per Minute) limits with intelligent batching
 */

interface QueueItem {
  execute: () => Promise<any>;
  resolve: (value: any) => void;
  reject: (error: any) => void;
  estimatedTokens: number;
}

class GeminiRateLimiter {
  private queue: QueueItem[] = [];
  private processing = false;
  private tokenUsage: { timestamp: number; tokens: number }[] = [];
  
  // Configuration
  private readonly MAX_TPM = 15000; // Conservative limit for Gemini 2.5 Flash
  private readonly MAX_RPM = 15; // Requests per minute
  private readonly WINDOW_MS = 60000; // 1 minute window
  private readonly MIN_DELAY_MS = 1000; // Minimum delay between requests
  
  private lastRequestTime = 0;

  /**
   * Add a request to the queue with token estimation
   */
  async enqueue<T>(
    execute: () => Promise<T>,
    estimatedTokens: number = 5000
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push({
        execute,
        resolve,
        reject,
        estimatedTokens,
      });
      this.processQueue();
    });
  }

  /**
   * Process queued requests with rate limiting
   */
  private async processQueue() {
    if (this.processing || this.queue.length === 0) return;
    
    this.processing = true;

    while (this.queue.length > 0) {
      const item = this.queue[0];
      
      // Check if we can make this request
      if (!this.canMakeRequest(item.estimatedTokens)) {
        // Wait for the oldest token usage to expire
        const waitTime = this.getWaitTime();
        console.log(`[RateLimiter] Waiting ${waitTime}ms to avoid TPM limit`);
        await this.sleep(waitTime);
        continue;
      }

      // Enforce minimum delay between requests
      const timeSinceLastRequest = Date.now() - this.lastRequestTime;
      if (timeSinceLastRequest < this.MIN_DELAY_MS) {
        await this.sleep(this.MIN_DELAY_MS - timeSinceLastRequest);
      }

      // Remove from queue and execute
      this.queue.shift();
      this.lastRequestTime = Date.now();
      
      try {
        const result = await item.execute();
        this.recordTokenUsage(item.estimatedTokens);
        item.resolve(result);
      } catch (error) {
        item.reject(error);
      }
    }

    this.processing = false;
  }

  /**
   * Check if we can make a request without exceeding limits
   */
  private canMakeRequest(estimatedTokens: number): boolean {
    this.cleanOldUsage();
    
    const currentTokens = this.tokenUsage.reduce((sum, item) => sum + item.tokens, 0);
    const currentRequests = this.tokenUsage.length;
    
    // Check both TPM and RPM limits
    return (
      currentTokens + estimatedTokens <= this.MAX_TPM &&
      currentRequests < this.MAX_RPM
    );
  }

  /**
   * Get time to wait before next request
   */
  private getWaitTime(): number {
    this.cleanOldUsage();
    
    if (this.tokenUsage.length === 0) return 0;
    
    // Wait until the oldest usage expires
    const oldestTimestamp = this.tokenUsage[0].timestamp;
    const timeToExpire = this.WINDOW_MS - (Date.now() - oldestTimestamp);
    
    return Math.max(timeToExpire, this.MIN_DELAY_MS);
  }

  /**
   * Record token usage for rate limiting
   */
  private recordTokenUsage(tokens: number) {
    this.tokenUsage.push({
      timestamp: Date.now(),
      tokens,
    });
  }

  /**
   * Remove token usage older than the window
   */
  private cleanOldUsage() {
    const cutoff = Date.now() - this.WINDOW_MS;
    this.tokenUsage = this.tokenUsage.filter((item) => item.timestamp > cutoff);
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Get current usage statistics
   */
  getStats() {
    this.cleanOldUsage();
    return {
      queueLength: this.queue.length,
      tokensInWindow: this.tokenUsage.reduce((sum, item) => sum + item.tokens, 0),
      requestsInWindow: this.tokenUsage.length,
      maxTPM: this.MAX_TPM,
      maxRPM: this.MAX_RPM,
    };
  }
}

// Singleton instance
export const geminiRateLimiter = new GeminiRateLimiter();

/**
 * Estimate token count for text (rough approximation)
 * ~1 token ≈ 4 characters for English text
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}
