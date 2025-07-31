import { Request, Response, NextFunction } from "express";
import fs from "fs";
import path from "path";

interface RequestStats {
  endpoint: string;
  method: string;
  userAgent: string;
  ip: string;
  userId?: string;
  timestamp: number;
  responseTime?: number;
  statusCode?: number;
  errorMessage?: string;
}

interface EndpointMetrics {
  count: number;
  totalResponseTime: number;
  averageResponseTime: number;
  errorCount: number;
  lastAccessed: number;
  uniqueIPs: Set<string>;
  userAgents: Set<string>;
}

class RequestMonitorService {
  private static instance: RequestMonitorService;
  private requestStats: RequestStats[] = [];
  private endpointMetrics: Map<string, EndpointMetrics> = new Map();
  private alertThresholds = {
    requestsPerMinute: 1000, // Alert if more than 1000 requests per minute
    requestsPerSecond: 50, // Alert if more than 50 requests per second
    duplicateRequestsFromSameIP: 100, // Alert if same IP makes 100+ requests in 1 minute
    suspiciousUserAgent: 20, // Alert if same user agent makes 20+ requests in 1 minute
  };
  private logFile = path.join(process.cwd(), "request-monitor.log");
  private alertFile = path.join(process.cwd(), "request-alerts.log");

  private constructor() {
    // Clean up old stats every 5 minutes to prevent memory bloat
    setInterval(() => this.cleanupOldStats(), 5 * 60 * 1000);

    // Generate alerts every minute
    setInterval(() => this.checkForAlerts(), 60 * 1000);
  }

  public static getInstance(): RequestMonitorService {
    if (!RequestMonitorService.instance) {
      RequestMonitorService.instance = new RequestMonitorService();
    }
    return RequestMonitorService.instance;
  }

  public middleware() {
    return (req: Request, res: Response, next: NextFunction) => {
      const startTime = Date.now();
      const requestId = Math.random().toString(36).substr(2, 9);

      // Log the incoming request
      const requestStat: RequestStats = {
        endpoint: `${req.method} ${req.path}`,
        method: req.method,
        userAgent: req.get("User-Agent") || "Unknown",
        ip: this.getClientIP(req),
        userId: (req as any).user?.id,
        timestamp: startTime,
      };

      // Store request
      this.requestStats.push(requestStat);

      // Log to console for immediate monitoring
      console.log(
        `[${new Date().toISOString()}] [${requestId}] ${req.method} ${
          req.path
        } - IP: ${
          requestStat.ip
        } - UserAgent: ${requestStat.userAgent.substring(0, 50)}...`
      );

      // Override res.end to capture response details
      const originalEnd = res.end.bind(res);
      res.end = function (chunk?: any, encoding?: any) {
        const responseTime = Date.now() - startTime;
        requestStat.responseTime = responseTime;
        requestStat.statusCode = res.statusCode;

        // Update endpoint metrics
        RequestMonitorService.getInstance().updateEndpointMetrics(requestStat);

        // Log completion
        console.log(
          `[${new Date().toISOString()}] [${requestId}] ${req.method} ${
            req.path
          } - ${res.statusCode} - ${responseTime}ms`
        );

        return originalEnd(chunk, encoding);
      } as any;

      next();
    };
  }

  private getClientIP(req: Request): string {
    return (
      (req.headers["x-forwarded-for"] as string) ||
      (req.headers["x-real-ip"] as string) ||
      req.connection.remoteAddress ||
      req.socket.remoteAddress ||
      "unknown"
    );
  }

  private updateEndpointMetrics(requestStat: RequestStats) {
    const key = requestStat.endpoint;

    if (!this.endpointMetrics.has(key)) {
      this.endpointMetrics.set(key, {
        count: 0,
        totalResponseTime: 0,
        averageResponseTime: 0,
        errorCount: 0,
        lastAccessed: 0,
        uniqueIPs: new Set(),
        userAgents: new Set(),
      });
    }

    const metrics = this.endpointMetrics.get(key)!;
    metrics.count++;
    metrics.lastAccessed = requestStat.timestamp;
    metrics.uniqueIPs.add(requestStat.ip);
    metrics.userAgents.add(requestStat.userAgent);

    if (requestStat.responseTime) {
      metrics.totalResponseTime += requestStat.responseTime;
      metrics.averageResponseTime = metrics.totalResponseTime / metrics.count;
    }

    // Count errors, but exclude expected authentication failures
    if (requestStat.statusCode && requestStat.statusCode >= 400) {
      // Don't count 401 (Unauthorized) or 403 (Forbidden) as errors for auth endpoints
      // These are expected responses when checking authentication status or permissions
      const isAuthEndpoint = requestStat.endpoint.includes("/auth/");
      const isAuthFailure =
        requestStat.statusCode === 401 || requestStat.statusCode === 403;

      if (!(isAuthEndpoint && isAuthFailure)) {
        metrics.errorCount++;
      }
    }
  }

  private cleanupOldStats() {
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    const oldCount = this.requestStats.length;
    this.requestStats = this.requestStats.filter(
      (stat) => stat.timestamp > oneHourAgo
    );

    if (oldCount > this.requestStats.length) {
      console.log(
        `[REQUEST-MONITOR] Cleaned up ${
          oldCount - this.requestStats.length
        } old request stats`
      );
    }
  }

  private checkForAlerts() {
    const now = Date.now();
    const oneMinuteAgo = now - 60 * 1000;
    const oneSecondAgo = now - 1 * 1000;

    const recentRequests = this.requestStats.filter(
      (stat) => stat.timestamp > oneMinuteAgo
    );
    const veryRecentRequests = this.requestStats.filter(
      (stat) => stat.timestamp > oneSecondAgo
    );

    // Check for high request rate
    if (recentRequests.length > this.alertThresholds.requestsPerMinute) {
      this.logAlert(
        `HIGH_REQUEST_RATE`,
        `${recentRequests.length} requests in the last minute (threshold: ${this.alertThresholds.requestsPerMinute})`
      );
    }

    if (veryRecentRequests.length > this.alertThresholds.requestsPerSecond) {
      this.logAlert(
        `VERY_HIGH_REQUEST_RATE`,
        `${veryRecentRequests.length} requests in the last second (threshold: ${this.alertThresholds.requestsPerSecond})`
      );
    }

    // Check for duplicate requests from same IP
    const ipCounts = new Map<string, number>();
    recentRequests.forEach((req) => {
      ipCounts.set(req.ip, (ipCounts.get(req.ip) || 0) + 1);
    });

    ipCounts.forEach((count, ip) => {
      if (count > this.alertThresholds.duplicateRequestsFromSameIP) {
        this.logAlert(
          `SUSPICIOUS_IP_ACTIVITY`,
          `IP ${ip} made ${count} requests in the last minute (threshold: ${this.alertThresholds.duplicateRequestsFromSameIP})`
        );
      }
    });

    // Check for suspicious user agent activity
    const userAgentCounts = new Map<string, number>();
    recentRequests.forEach((req) => {
      userAgentCounts.set(
        req.userAgent,
        (userAgentCounts.get(req.userAgent) || 0) + 1
      );
    });

    userAgentCounts.forEach((count, userAgent) => {
      if (count > this.alertThresholds.suspiciousUserAgent) {
        this.logAlert(
          `SUSPICIOUS_USER_AGENT`,
          `User Agent "${userAgent.substring(
            0,
            100
          )}..." made ${count} requests in the last minute (threshold: ${
            this.alertThresholds.suspiciousUserAgent
          })`
        );
      }
    });
  }

  private logAlert(type: string, message: string) {
    const alertMessage = `[${new Date().toISOString()}] [${type}] ${message}`;
    console.error(`🚨 ALERT: ${alertMessage}`);

    // Write to alert file
    fs.appendFileSync(this.alertFile, alertMessage + "\n");
  }

  public getStats() {
    const now = Date.now();
    const oneHourAgo = now - 60 * 60 * 1000;
    const oneMinuteAgo = now - 60 * 1000;

    const recentRequests = this.requestStats.filter(
      (stat) => stat.timestamp > oneHourAgo
    );
    const veryRecentRequests = this.requestStats.filter(
      (stat) => stat.timestamp > oneMinuteAgo
    );

    return {
      totalRequestsLastHour: recentRequests.length,
      totalRequestsLastMinute: veryRecentRequests.length,
      requestsPerSecond: Math.round(veryRecentRequests.length / 60),
      endpointMetrics: Array.from(this.endpointMetrics.entries())
        .map(([endpoint, metrics]) => ({
          endpoint,
          count: metrics.count,
          averageResponseTime: Math.round(metrics.averageResponseTime),
          errorCount: metrics.errorCount,
          uniqueIPs: metrics.uniqueIPs.size,
          uniqueUserAgents: metrics.userAgents.size,
        }))
        .sort((a, b) => b.count - a.count),
      topIPs: this.getTopIPs(recentRequests),
      topUserAgents: this.getTopUserAgents(recentRequests),
      suspiciousPatterns: this.detectSuspiciousPatterns(recentRequests),
    };
  }

  private getTopIPs(requests: RequestStats[]) {
    const ipCounts = new Map<string, number>();
    requests.forEach((req) => {
      ipCounts.set(req.ip, (ipCounts.get(req.ip) || 0) + 1);
    });

    return Array.from(ipCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([ip, count]) => ({ ip, count }));
  }

  private getTopUserAgents(requests: RequestStats[]) {
    const userAgentCounts = new Map<string, number>();
    requests.forEach((req) => {
      userAgentCounts.set(
        req.userAgent,
        (userAgentCounts.get(req.userAgent) || 0) + 1
      );
    });

    return Array.from(userAgentCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([userAgent, count]) => ({
        userAgent: userAgent.substring(0, 100),
        count,
      }));
  }

  private detectSuspiciousPatterns(
    requests: RequestStats[]
  ): Array<{ type: string; description: string; severity: string }> {
    const patterns: Array<{
      type: string;
      description: string;
      severity: string;
    }> = [];

    // Detect potential polling loops
    const pathCounts = new Map<string, number>();
    requests.forEach((req) => {
      pathCounts.set(req.endpoint, (pathCounts.get(req.endpoint) || 0) + 1);
    });

    pathCounts.forEach((count, path) => {
      if (count > 100) {
        // More than 100 requests to same endpoint in an hour
        patterns.push({
          type: "POTENTIAL_POLLING_LOOP",
          description: `Endpoint ${path} received ${count} requests in the last hour`,
          severity: count > 500 ? "HIGH" : "MEDIUM",
        });
      }
    });

    return patterns;
  }

  public emergencyDisableRateLimit() {
    console.error(
      "🚨 EMERGENCY: Rate limiting disabled due to abnormal traffic patterns!"
    );
    process.env.ENABLE_RATE_LIMITING = "false";

    // Log this emergency action
    const emergencyMessage = `[${new Date().toISOString()}] EMERGENCY: Rate limiting disabled due to abnormal traffic patterns`;
    fs.appendFileSync(this.alertFile, emergencyMessage + "\n");
  }

  public emergencyEnableRateLimit() {
    console.log(
      "✅ RECOVERY: Rate limiting re-enabled after emergency disable"
    );
    process.env.ENABLE_RATE_LIMITING = "true";

    // Log this recovery action
    const recoveryMessage = `[${new Date().toISOString()}] RECOVERY: Rate limiting re-enabled after emergency disable`;
    fs.appendFileSync(this.alertFile, recoveryMessage + "\n");
  }

  public getRateLimitingStatus() {
    return {
      enabled: process.env.ENABLE_RATE_LIMITING !== "false",
      status:
        process.env.ENABLE_RATE_LIMITING !== "false"
          ? "enabled"
          : "emergency_disabled",
    };
  }
}

export default RequestMonitorService;
