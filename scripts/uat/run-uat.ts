/**
 * UAT Test Runner
 * Automated User Acceptance Testing for WhatsApp Webhook Services
 */

// ============================================================================
// CONFIGURATION
// ============================================================================

const UAT_CONFIG = {
  baseUrl: Deno.env.get("SUPABASE_URL") || "https://lhbowpbcpwoiparwnwgt.supabase.co",
  testPhone: Deno.env.get("UAT_TEST_PHONE") || "+250788000000",
  timeout: 30000,
  retryAttempts: 3,
};

// ============================================================================
// TYPES
// ============================================================================

type UATTestCase = {
  id: string;
  name: string;
  category: string;
  priority: "critical" | "high" | "medium" | "low";
  steps: UATStep[];
};

type UATStep = {
  action: "send_text" | "send_button" | "send_list" | "send_location" | "send_image" | "wait" | "verify";
  payload?: any;
  expected?: any;
  timeout?: number;
};

type UATResult = {
  testId: string;
  testName: string;
  status: "passed" | "failed" | "skipped";
  duration: number;
  steps: {
    stepIndex: number;
    status: "passed" | "failed";
    error?: string;
  }[];
  error?: string;
};

// ============================================================================
// UAT TEST CASES
// ============================================================================

const UAT_TEST_CASES: UATTestCase[] = [
  {
    id: "UAT-HC-001",
    name: "Core Service Health Check",
    category: "Infrastructure",
    priority: "critical",
    steps: [
      {
        action: "verify",
        payload: { endpoint: "/functions/v1/wa-webhook-core/health" },
        expected: { status: 200, body: { status: "healthy" } },
      },
    ],
  },
  {
    id: "UAT-HC-002",
    name: "Profile Service Health Check",
    category: "Infrastructure",
    priority: "critical",
    steps: [
      {
        action: "verify",
        payload: { endpoint: "/functions/v1/wa-webhook-profile/health" },
        expected: { status: 200, body: { status: "healthy" } },
      },
    ],
  },
  {
    id: "UAT-HC-003",
    name: "Mobility Service Health Check",
    category: "Infrastructure",
    priority: "critical",
    steps: [
      {
        action: "verify",
        payload: { endpoint: "/functions/v1/wa-webhook-mobility/health" },
        expected: { status: 200, body: { status: "healthy" } },
      },
    ],
  },
  {
    id: "UAT-HC-004",
    name: "Insurance Service Health Check",
    category: "Infrastructure",
    priority: "critical",
    steps: [
      {
        action: "verify",
        payload: { endpoint: "/functions/v1/wa-webhook-insurance/health" },
        expected: { status: 200, body: { status: "healthy" } },
      },
    ],
  },
];

// ============================================================================
// UAT RUNNER
// ============================================================================

class UATRunner {
  private results: UATResult[] = [];

  async runAll(): Promise<void> {
    console.log("🧪 Starting UAT Test Suite");
    console.log("==========================");
    console.log(`Base URL: ${UAT_CONFIG.baseUrl}`);
    console.log(`Test Phone: ${UAT_CONFIG.testPhone}`);
    console.log(`Total Tests: ${UAT_TEST_CASES.length}`);
    console.log("");

    for (const testCase of UAT_TEST_CASES) {
      await this.runTest(testCase);
    }

    this.printSummary();
  }

  async runTest(testCase: UATTestCase): Promise<void> {
    console.log(`\n📋 [${testCase.id}] ${testCase.name}`);
    console.log(`   Category: ${testCase.category} | Priority: ${testCase.priority}`);
    
    const startTime = Date.now();
    const stepResults: UATResult["steps"] = [];
    let testStatus: "passed" | "failed" | "skipped" = "passed";
    let testError: string | undefined;

    try {
      for (let i = 0; i < testCase.steps.length; i++) {
        const step = testCase.steps[i];
        console.log(`   Step ${i + 1}: ${step.action}`);
        
        try {
          await this.executeStep(step);
          stepResults.push({ stepIndex: i, status: "passed" });
          console.log(`   ✅ Step ${i + 1} passed`);
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          stepResults.push({ stepIndex: i, status: "failed", error: errorMsg });
          console.log(`   ❌ Step ${i + 1} failed: ${errorMsg}`);
          testStatus = "failed";
          testError = errorMsg;
          break;
        }
      }
    } catch (error) {
      testStatus = "failed";
      testError = error instanceof Error ? error.message : String(error);
    }

    const duration = Date.now() - startTime;
    
    this.results.push({
      testId: testCase.id,
      testName: testCase.name,
      status: testStatus,
      duration,
      steps: stepResults,
      error: testError,
    });

    const statusEmoji = testStatus === "passed" ? "✅" : "❌";
    console.log(`   ${statusEmoji} Test ${testStatus} (${duration}ms)`);
  }

  async executeStep(step: UATStep): Promise<void> {
    switch (step.action) {
      case "verify":
        await this.verifyEndpoint(step.payload, step.expected);
        break;
      case "wait":
        await this.wait(step.timeout || 1000);
        break;
      default:
        console.log(`      Simulating ${step.action}`);
    }
  }

  async verifyEndpoint(
    payload: { endpoint: string },
    expected: { status: number; body?: any }
  ): Promise<void> {
    const url = `${UAT_CONFIG.baseUrl}${payload.endpoint}`;
    const response = await fetch(url, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });

    if (response.status !== expected.status) {
      throw new Error(`Expected status ${expected.status}, got ${response.status}`);
    }

    if (expected.body) {
      const body = await response.json();
      for (const [key, value] of Object.entries(expected.body)) {
        if (body[key] !== value) {
          throw new Error(`Expected ${key}=${value}, got ${body[key]}`);
        }
      }
    }
  }

  async wait(ms: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }

  printSummary(): void {
    console.log("\n");
    console.log("========================================");
    console.log("📊 UAT Test Summary");
    console.log("========================================");

    const passed = this.results.filter((r) => r.status === "passed").length;
    const failed = this.results.filter((r) => r.status === "failed").length;
    const skipped = this.results.filter((r) => r.status === "skipped").length;
    const totalDuration = this.results.reduce((sum, r) => sum + r.duration, 0);

    console.log(`Total Tests: ${this.results.length}`);
    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`⏭️ Skipped: ${skipped}`);
    console.log(`⏱️ Duration: ${totalDuration}ms`);
    console.log("");

    if (failed > 0) {
      console.log("Failed Tests:");
      console.log("-------------");
      for (const result of this.results.filter((r) => r.status === "failed")) {
        console.log(`  ❌ [${result.testId}] ${result.testName}`);
        console.log(`     Error: ${result.error}`);
      }
    }

    console.log("");
    console.log("========================================");
    
    const passRate = ((passed / this.results.length) * 100).toFixed(1);
    if (failed === 0) {
      console.log(`✅ All tests passed! (${passRate}% pass rate)`);
    } else {
      console.log(`⚠️ ${failed} test(s) failed (${passRate}% pass rate)`);
    }
  }

  exportResults(format: "json" | "markdown"): string {
    if (format === "json") {
      return JSON.stringify(this.results, null, 2);
    }

    let md = "# UAT Test Results\n\n";
    md += `**Date:** ${new Date().toISOString()}\n\n`;
    md += "## Summary\n\n";
    
    const passed = this.results.filter((r) => r.status === "passed").length;
    const failed = this.results.filter((r) => r.status === "failed").length;
    
    md += `| Status | Count |\n`;
    md += `|--------|-------|\n`;
    md += `| ✅ Passed | ${passed} |\n`;
    md += `| ❌ Failed | ${failed} |\n`;
    md += `| Total | ${this.results.length} |\n\n`;

    return md;
  }
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================

if (import.meta.main) {
  const runner = new UATRunner();
  await runner.runAll();
  
  // Export results
  try {
    const jsonResults = runner.exportResults("json");
    await Deno.writeTextFile("coverage/uat-results.json", jsonResults);
    
    const mdResults = runner.exportResults("markdown");
    await Deno.writeTextFile("coverage/uat-results.md", mdResults);
    
    console.log("\n📄 Results exported to coverage/uat-results.json and coverage/uat-results.md");
  } catch {
    console.log("\n⚠️ Could not export results (coverage directory may not exist)");
  }
  
  const failed = runner.results.filter((r) => r.status === "failed").length;
  Deno.exit(failed > 0 ? 1 : 0);
}

export { UAT_TEST_CASES,UATRunner };
