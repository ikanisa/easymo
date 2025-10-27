import { metricsCollector, measureDuration, trackOperation } from './utils/metrics';

describe('Metrics Utilities', () => {
  beforeEach(() => {
    metricsCollector.reset();
  });

  describe('metricsCollector', () => {
    describe('counters', () => {
      it('should increment counter', () => {
        metricsCollector.incrementCounter('test_counter', 'Test counter', 1);
        
        const metrics = metricsCollector.getMetrics();
        expect(metrics).toContain('test_counter 1');
      });

      it('should accumulate counter values', () => {
        metricsCollector.incrementCounter('requests_total', 'Total requests', 1);
        metricsCollector.incrementCounter('requests_total', 'Total requests', 2);
        metricsCollector.incrementCounter('requests_total', 'Total requests', 3);
        
        const metrics = metricsCollector.getMetrics();
        expect(metrics).toContain('requests_total 6');
      });

      it('should support counter labels', () => {
        metricsCollector.incrementCounter(
          'http_requests',
          'HTTP requests',
          1,
          { method: 'GET', status: '200' }
        );
        
        const metrics = metricsCollector.getMetrics();
        expect(metrics).toContain('http_requests{method="GET",status="200"} 1');
      });
    });

    describe('histograms', () => {
      it('should record histogram observations', () => {
        metricsCollector.recordHistogram('request_duration', 'Request duration', 100);
        metricsCollector.recordHistogram('request_duration', 'Request duration', 200);
        metricsCollector.recordHistogram('request_duration', 'Request duration', 150);
        
        const metrics = metricsCollector.getMetrics();
        expect(metrics).toContain('request_duration_sum 450');
        expect(metrics).toContain('request_duration_count 3');
      });

      it('should calculate percentiles', () => {
        // Add values: 10, 20, 30, ..., 100
        for (let i = 1; i <= 10; i++) {
          metricsCollector.recordHistogram('latency', 'Latency', i * 10);
        }
        
        const metrics = metricsCollector.getMetrics();
        // With sorted array [10, 20, 30, 40, 50, 60, 70, 80, 90, 100]:
        // p50 at index 5 = 60
        // p95 at index 9 = 100
        // p99 at index 9 = 100
        expect(metrics).toContain('latency_p50 60');
        expect(metrics).toContain('latency_p95 100');
        expect(metrics).toContain('latency_p99 100');
      });

      it('should support histogram labels', () => {
        metricsCollector.recordHistogram(
          'api_latency',
          'API latency',
          150,
          { endpoint: '/users', method: 'GET' }
        );
        
        const metrics = metricsCollector.getMetrics();
        expect(metrics).toContain('api_latency{endpoint="/users",method="GET"}_sum 150');
      });
    });

    describe('gauges', () => {
      it('should set gauge value', () => {
        metricsCollector.setGauge('active_connections', 'Active connections', 42);
        
        const metrics = metricsCollector.getMetrics();
        expect(metrics).toContain('active_connections 42');
      });

      it('should overwrite gauge value', () => {
        metricsCollector.setGauge('memory_usage', 'Memory usage', 100);
        metricsCollector.setGauge('memory_usage', 'Memory usage', 150);
        
        const metrics = metricsCollector.getMetrics();
        expect(metrics).toContain('memory_usage 150');
        expect(metrics).not.toContain('memory_usage 100');
      });

      it('should support gauge labels', () => {
        metricsCollector.setGauge(
          'queue_size',
          'Queue size',
          25,
          { queue: 'emails' }
        );
        
        const metrics = metricsCollector.getMetrics();
        expect(metrics).toContain('queue_size{queue="emails"} 25');
      });
    });

    describe('Prometheus format', () => {
      it('should generate valid Prometheus metrics', () => {
        metricsCollector.incrementCounter('test_counter', 'Test counter help', 5);
        metricsCollector.recordHistogram('test_histogram', 'Test histogram help', 100);
        metricsCollector.setGauge('test_gauge', 'Test gauge help', 42);
        
        const metrics = metricsCollector.getMetrics();
        
        // Check format
        expect(metrics).toContain('# HELP Test counter help');
        expect(metrics).toContain('# TYPE counter');
        expect(metrics).toContain('# HELP Test histogram help');
        expect(metrics).toContain('# TYPE histogram');
        expect(metrics).toContain('# HELP Test gauge help');
        expect(metrics).toContain('# TYPE gauge');
      });
    });
  });

  describe('measureDuration', () => {
    it('should measure operation duration', async () => {
      const operation = async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
        return 'result';
      };

      const result = await measureDuration('test_operation', operation);
      
      expect(result).toBe('result');
      
      const metrics = metricsCollector.getMetrics();
      expect(metrics).toContain('test_operation_sum');
      expect(metrics).toContain('test_operation_count 1');
    });

    it('should record duration on error', async () => {
      const operation = async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        throw new Error('Test error');
      };

      await expect(
        measureDuration('failing_operation', operation)
      ).rejects.toThrow('Test error');

      const metrics = metricsCollector.getMetrics();
      expect(metrics).toContain('failing_operation{status="error"}_count 1');
    });

    it('should support labels', async () => {
      const operation = async () => 'done';

      await measureDuration('api_call', operation, { endpoint: '/test' });

      const metrics = metricsCollector.getMetrics();
      expect(metrics).toContain('api_call{endpoint="/test"}_count 1');
    });
  });

  describe('trackOperation', () => {
    it('should track successful operations', async () => {
      const operation = jest.fn().mockResolvedValue('success');

      const result = await trackOperation('db_query', operation);
      
      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(1);

      const metrics = metricsCollector.getMetrics();
      expect(metrics).toContain('db_query_total{status="success"} 1');
    });

    it('should track failed operations', async () => {
      const operation = jest.fn().mockRejectedValue(new Error('Failed'));

      await expect(
        trackOperation('api_request', operation)
      ).rejects.toThrow('Failed');

      const metrics = metricsCollector.getMetrics();
      expect(metrics).toContain('api_request_total{status="error"} 1');
    });

    it('should track success and failure separately', async () => {
      const successOp = jest.fn().mockResolvedValue('ok');
      const failOp = jest.fn().mockRejectedValue(new Error('fail'));

      await trackOperation('operation', successOp);
      await trackOperation('operation', successOp);
      await expect(trackOperation('operation', failOp)).rejects.toThrow();

      const metrics = metricsCollector.getMetrics();
      expect(metrics).toContain('operation_total{status="success"} 2');
      expect(metrics).toContain('operation_total{status="error"} 1');
    });

    it('should support custom labels', async () => {
      const operation = jest.fn().mockResolvedValue('done');

      await trackOperation('process', operation, { type: 'batch' });

      const metrics = metricsCollector.getMetrics();
      expect(metrics).toContain('process_total{type="batch",status="success"} 1');
    });
  });
});
