# frozen_string_literal: true

module ActiveContext
  class BulkProcessQueue
    def self.process!(queue, shard)
      new(queue, shard).process!
    end

    attr_reader :queue, :shard

    def initialize(queue, shard)
      @queue = queue
      @shard = shard
    end

    def process!
      ActiveContext::Redis.with_redis { |redis| process(redis) }
    end

    def process(redis)
      start_time = current_time
      specs_buffer = []
      scores = {}
      @failures = []

      queue.each_queued_items_by_shard(redis, shards: [shard]) do |shard_number, specs|
        next if specs.empty?

        set_key = queue.redis_set_key(shard_number)
        first_score = specs.first.last
        last_score = specs.last.last

        logger.info(
          'queue' => queue,
          'message' => 'bulk_indexing_start',
          'meta.indexing.redis_set' => set_key,
          'meta.indexing.records_count' => specs.count,
          'meta.indexing.first_score' => first_score,
          'meta.indexing.last_score' => last_score
        )

        specs_buffer += specs

        scores[set_key] = [first_score, last_score, specs.count]
      end

      return [0, 0] if specs_buffer.blank?

      # TODO: https://gitlab.com/gitlab-org/gitlab/-/issues/507973
      # deserialize refs, preload records, submit docs, flush, etc.

      # Remove all the successes
      scores.each do |set_key, (first_score, last_score, count)|
        redis.zremrangebyscore(set_key, first_score, last_score)

        logger.info(
          'class' => self.class.name,
          'message' => 'bulk_indexing_end',
          'meta.indexing.redis_set' => set_key,
          'meta.indexing.records_count' => count,
          'meta.indexing.first_score' => first_score,
          'meta.indexing.last_score' => last_score,
          'meta.indexing.failures_count' => @failures.count,
          'meta.indexing.bulk_execution_duration_s' => current_time - start_time
        )
      end

      [specs_buffer.count, @failures.count]
    end

    private

    def logger
      @logger ||= ActiveContext::Config.logger
    end

    def current_time
      Process.clock_gettime(Process::CLOCK_MONOTONIC)
    end
  end
end
