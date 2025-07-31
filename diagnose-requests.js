// Quick diagnostic script to identify request patterns
const axios = require("axios");

async function diagnoseRequestPatterns() {
  try {
    console.log("🔍 Diagnosing request patterns...\n");

    const response = await axios.get(
      "http://localhost:3001/api/v1/monitor/stats"
    );
    const stats = response.data.data;

    console.log("📊 REQUEST VOLUME ANALYSIS");
    console.log("=========================");
    console.log(`Total requests last hour: ${stats.totalRequestsLastHour}`);
    console.log(`Total requests last minute: ${stats.totalRequestsLastMinute}`);
    console.log(`Requests per second: ${stats.requestsPerSecond}`);
    console.log("");

    console.log("🔥 TOP ENDPOINTS BY REQUEST COUNT");
    console.log("=================================");
    stats.endpointMetrics.slice(0, 10).forEach((endpoint, index) => {
      console.log(
        `${index + 1}. ${endpoint.endpoint} - ${
          endpoint.count
        } requests (avg: ${endpoint.averageResponseTime}ms)`
      );
    });
    console.log("");

    console.log("🚨 SUSPICIOUS PATTERNS");
    console.log("======================");
    if (stats.suspiciousPatterns.length === 0) {
      console.log("✅ No suspicious patterns detected");
    } else {
      stats.suspiciousPatterns.forEach((pattern) => {
        console.log(
          `${pattern.severity === "HIGH" ? "🔴" : "🟡"} ${pattern.type}: ${
            pattern.description
          }`
        );
      });
    }
    console.log("");

    console.log("🌐 TOP IPs BY REQUEST COUNT");
    console.log("===========================");
    stats.topIPs.slice(0, 5).forEach((ip, index) => {
      console.log(`${index + 1}. ${ip.ip} - ${ip.count} requests`);
    });
    console.log("");

    console.log("🤖 TOP USER AGENTS");
    console.log("==================");
    stats.topUserAgents.slice(0, 3).forEach((ua, index) => {
      console.log(`${index + 1}. ${ua.userAgent} - ${ua.count} requests`);
    });
    console.log("");

    // Provide recommendations
    console.log("💡 RECOMMENDATIONS");
    console.log("==================");

    if (stats.requestsPerSecond > 20) {
      console.log(
        "🚨 HIGH LOAD: Consider emergency disabling rate limiting temporarily"
      );
    }

    const pollingEndpoints = stats.endpointMetrics.filter(
      (e) =>
        e.endpoint.includes("notifications") ||
        e.endpoint.includes("system-messages") ||
        e.endpoint.includes("GET")
    );

    if (pollingEndpoints.some((e) => e.count > 100)) {
      console.log(
        "🔄 POLLING DETECTED: High frequency polling detected. Consider:"
      );
      console.log("   - Increasing polling intervals");
      console.log("   - Using WebSocket instead of polling");
      console.log("   - Implementing push notifications");
    }

    if (stats.totalRequestsLastMinute > 500) {
      console.log(
        "⚡ IMMEDIATE ACTION NEEDED: Very high request volume detected"
      );
      console.log(
        "   Run: ./emergency-monitor.sh and select option 3 to disable rate limiting"
      );
    }
  } catch (error) {
    console.error("❌ Failed to get diagnostics:", error.message);
    console.log("\n🔧 TROUBLESHOOTING:");
    console.log("1. Make sure the backend server is running");
    console.log("2. Check if monitoring routes are properly set up");
    console.log("3. Verify the server is accessible at http://localhost:3001");
  }
}

diagnoseRequestPatterns();
