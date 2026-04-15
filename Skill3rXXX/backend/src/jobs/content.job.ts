/**
 * Content Publishing Job — runs every minute to publish scheduled posts.
 * In a full implementation, each platform would have its own API client.
 * Right now we mark them published (extend with real API calls per platform).
 */
import { contentQueue } from "./queue";
import { getDuePosts, markPublished, markFailed } from "../modules/content/content.service";
import { logger } from "../utils/logger";

/** Schedule: check for due posts every 60 seconds */
const POLL_INTERVAL_MS = 60 * 1000;

export function processContentQueue(): void {
  // Recurring scheduler: re-adds itself every interval
  setInterval(async () => {
    try {
      const duePosts = await getDuePosts();
      for (const post of duePosts) {
        await contentQueue.add(
          { postId: post.id, platform: post.platform },
          { attempts: 3, backoff: { type: "exponential", delay: 5000 } }
        );
      }
      if (duePosts.length > 0) {
        logger.info(`Queued ${duePosts.length} content posts for publishing`);
      }
    } catch (err) {
      logger.error("Content scheduler error", { err });
    }
  }, POLL_INTERVAL_MS);

  // Worker: processes queued publishing jobs
  contentQueue.process(async (job) => {
    const { postId, platform } = job.data as { postId: string; platform: string };
    logger.info(`Publishing post ${postId} to ${platform}`);

    try {
      // Platform-specific publish logic would go here:
      // e.g., twitterClient.tweet(post.body)
      // For now we mark it published with a placeholder metadata
      await markPublished(postId, {
        publishedAt: new Date().toISOString(),
        platform,
        publishedBy: "scheduler",
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await markFailed(postId, message);
      throw err; // Triggers Bull retry
    }
  });
}
