/**
 * Metrics Registry Unit Tests
 */

import { describe, it, expect, beforeEach } from "vitest";
import { registry, METRIC_DEFINITIONS } from "../../src/metrics/registry";

describe("Metrics Registry", () => {
    beforeEach(() => {
        registry.reset();
    });

    describe("Counter operations", () => {
        it("should increment counter without labels", () => {
            registry.incrementCounter("test_counter", {}, 1);
            registry.incrementCounter("test_counter", {}, 1);

            const prometheus = registry.exportPrometheus();
            expect(prometheus).toContain("test_counter 2");
        });

        it("should increment counter with labels", () => {
            registry.incrementCounter("test_counter", { env: "test" }, 1);
            registry.incrementCounter("test_counter", { env: "prod" }, 3);

            const prometheus = registry.exportPrometheus();
            expect(prometheus).toContain('test_counter{env="test"} 1');
            expect(prometheus).toContain('test_counter{env="prod"} 3');
        });

        it("should increment by custom value", () => {
            registry.incrementCounter("test_counter", {}, 5);
            registry.incrementCounter("test_counter", {}, 3);

            const json = registry.toJSON();
            expect(json.counters).toHaveProperty("test_counter");
            expect((json.counters as Record<string, number>)["test_counter"]).toBe(8);
        });
    });

    describe("Gauge operations", () => {
        it("should set gauge value", () => {
            registry.setGauge("test_gauge", {}, 42);

            const prometheus = registry.exportPrometheus();
            expect(prometheus).toContain("test_gauge 42");
        });

        it("should overwrite gauge value", () => {
            registry.setGauge("test_gauge", {}, 10);
            registry.setGauge("test_gauge", {}, 20);

            const json = registry.toJSON();
            expect((json.gauges as Record<string, number>)["test_gauge"]).toBe(20);
        });
    });

    describe("Histogram operations", () => {
        it("should observe histogram values", () => {
            registry.observeHistogram("test_histogram", {}, 1.5);
            registry.observeHistogram("test_histogram", {}, 2.5);
            registry.observeHistogram("test_histogram", {}, 3.5);

            const prometheus = registry.exportPrometheus();
            expect(prometheus).toContain("test_histogram_sum 7.5");
            expect(prometheus).toContain("test_histogram_count 3");
        });

        it("should track histogram statistics in JSON", () => {
            registry.observeHistogram("test_histogram", {}, 10);
            registry.observeHistogram("test_histogram", {}, 20);
            registry.observeHistogram("test_histogram", {}, 30);

            const json = registry.toJSON();
            const histograms = json.histograms as Record<
                string,
                { count: number; sum: number; min: number; max: number; avg: number }
            >;

            expect(histograms["test_histogram"].count).toBe(3);
            expect(histograms["test_histogram"].sum).toBe(60);
            expect(histograms["test_histogram"].min).toBe(10);
            expect(histograms["test_histogram"].max).toBe(30);
            expect(histograms["test_histogram"].avg).toBe(20);
        });
    });

    describe("Label handling", () => {
        it("should sort labels alphabetically", () => {
            registry.incrementCounter("test", { z: "1", a: "2" }, 1);

            const prometheus = registry.exportPrometheus();
            // Should be sorted as a="2",z="1"
            expect(prometheus).toContain('test{a="2",z="1"} 1');
        });
    });

    describe("METRIC_DEFINITIONS", () => {
        it("should have all required metrics defined", () => {
            expect(METRIC_DEFINITIONS.requests_created_total).toBeDefined();
            expect(METRIC_DEFINITIONS.time_to_shortlist_seconds).toBeDefined();
            expect(METRIC_DEFINITIONS.vendor_messages_sent_total).toBeDefined();
            expect(METRIC_DEFINITIONS.ocr_jobs_total).toBeDefined();
            expect(METRIC_DEFINITIONS.moltbot_calls_total).toBeDefined();
            expect(METRIC_DEFINITIONS.budget_exceeded_total).toBeDefined();
        });

        it("should have correct metric types", () => {
            expect(METRIC_DEFINITIONS.requests_created_total.type).toBe("counter");
            expect(METRIC_DEFINITIONS.time_to_shortlist_seconds.type).toBe("histogram");
            expect(METRIC_DEFINITIONS.vendor_reply_rate.type).toBe("gauge");
        });
    });

    describe("reset()", () => {
        it("should clear all metrics", () => {
            registry.incrementCounter("counter", {}, 5);
            registry.setGauge("gauge", {}, 10);
            registry.observeHistogram("histogram", {}, 15);

            registry.reset();

            const json = registry.toJSON();
            expect(Object.keys(json.counters as object)).toHaveLength(0);
            expect(Object.keys(json.gauges as object)).toHaveLength(0);
            expect(Object.keys(json.histograms as object)).toHaveLength(0);
        });
    });
});
