import { useState, useEffect } from "react";
import {
  ComputerDesktopIcon,
  ExclamationTriangleIcon,
  ClockIcon,
  ChartBarIcon,
  CheckCircleIcon,
  ServerIcon,
  GlobeAltIcon,
  UserGroupIcon,
} from "@heroicons/react/24/outline";
import PageHeader from "../components/ui/PageHeader";

interface MonitorStats {
  totalRequestsLastHour: number;
  totalRequestsLastMinute: number;
  requestsPerSecond: number;
  endpointMetrics: Array<{
    endpoint: string;
    count: number;
    averageResponseTime: number;
    errorCount: number;
    uniqueIPs: number;
    uniqueUserAgents: number;
  }>;
  topIPs: Array<{ ip: string; count: number }>;
  topUserAgents: Array<{ userAgent: string; count: number }>;
  suspiciousPatterns: Array<{
    type: string;
    description: string;
    severity: string;
  }>;
}

interface HealthStatus {
  healthy: boolean;
  requestsPerSecond: number;
  requestsLastMinute: number;
  suspiciousPatterns: number;
}

export default function SystemMonitor() {
  const [stats, setStats] = useState<MonitorStats | null>(null);
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const fetchMonitorData = async () => {
    try {
      // Fetch health status
      const healthResponse = await fetch("/api/v1/monitor/health");
      const healthData = await healthResponse.json();

      if (healthData.success) {
        setHealth({
          healthy: healthData.healthy,
          requestsPerSecond: healthData.requestsPerSecond,
          requestsLastMinute: healthData.requestsLastMinute,
          suspiciousPatterns: healthData.suspiciousPatterns,
        });
      }

      // Fetch detailed stats
      const statsResponse = await fetch("/api/v1/monitor/stats");
      const statsData = await statsResponse.json();

      if (statsData.success) {
        setStats(statsData.data);
      } else {
        setError("Failed to fetch monitoring data");
      }
    } catch (err) {
      setError("Error connecting to monitoring service");
      console.error("Monitoring fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  const emergencyDisableRateLimit = async () => {
    try {
      const response = await fetch("/api/v1/monitor/emergency-disable", {
        method: "POST",
      });
      const data = await response.json();

      if (data.success) {
        alert("🚨 Rate limiting has been emergency disabled!");
        fetchMonitorData(); // Refresh data
      } else {
        alert("Failed to disable rate limiting");
      }
    } catch (err) {
      alert("Error disabling rate limiting");
      console.error("Emergency disable error:", err);
    }
  };

  useEffect(() => {
    fetchMonitorData();
  }, []);

  useEffect(() => {
    if (autoRefresh) {
      const interval = setInterval(fetchMonitorData, 30000); // Refresh every 30 seconds
      return () => clearInterval(interval);
    }
  }, [autoRefresh]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <ComputerDesktopIcon className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">
            Loading System Monitor...
          </h3>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <ExclamationTriangleIcon className="mx-auto h-12 w-12 text-red-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">
            Monitor Error
          </h3>
          <p className="mt-1 text-sm text-gray-500">{error}</p>
          <button
            onClick={fetchMonitorData}
            className="mt-4 bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const getHealthStatusColor = () => {
    if (!health) return "text-gray-500";
    return health.healthy ? "text-green-500" : "text-red-500";
  };

  const getHealthStatusIcon = () => {
    if (!health) return <ClockIcon className="h-5 w-5" />;
    return health.healthy ? (
      <CheckCircleIcon className="h-5 w-5" />
    ) : (
      <ExclamationTriangleIcon className="h-5 w-5" />
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <PageHeader
        title="System Monitor"
        subtitle="Real-time server monitoring and analytics dashboard"
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header Controls */}
        <div className="mb-6 flex justify-between items-center">
          <div className="flex items-center space-x-4">
            <button
              onClick={fetchMonitorData}
              className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 transition-colors"
            >
              Refresh Data
            </button>
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="form-checkbox h-4 w-4 text-blue-600"
              />
              <span className="text-sm text-gray-700">Auto-refresh (30s)</span>
            </label>
          </div>

          <button
            onClick={emergencyDisableRateLimit}
            className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600 transition-colors"
          >
            🚨 Emergency: Disable Rate Limiting
          </button>
        </div>

        {/* Health Status */}
        <div
          className={`mb-6 p-4 rounded-lg border-2 ${
            health?.healthy
              ? "bg-green-50 border-green-200"
              : "bg-red-50 border-red-200"
          }`}
        >
          <div className="flex items-center">
            <div className={getHealthStatusColor()}>
              {getHealthStatusIcon()}
            </div>
            <h3
              className={`ml-2 text-lg font-medium ${getHealthStatusColor()}`}
            >
              System {health?.healthy ? "Healthy" : "Alert"}
            </h3>
          </div>
          {health && (
            <div className="mt-2 grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
              <div>
                Requests/sec:{" "}
                <span className="font-semibold">
                  {health.requestsPerSecond}
                </span>
              </div>
              <div>
                Requests/min:{" "}
                <span className="font-semibold">
                  {health.requestsLastMinute}
                </span>
              </div>
              <div>
                Suspicious patterns:{" "}
                <span className="font-semibold">
                  {health.suspiciousPatterns}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Stats Overview */}
        {stats && (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-8">
            <div className="bg-white p-6 rounded-lg shadow">
              <div className="flex items-center">
                <ChartBarIcon className="h-8 w-8 text-blue-500" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">Last Hour</p>
                  <p className="text-2xl font-semibold text-gray-900">
                    {stats.totalRequestsLastHour}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow">
              <div className="flex items-center">
                <ClockIcon className="h-8 w-8 text-green-500" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">
                    Last Minute
                  </p>
                  <p className="text-2xl font-semibold text-gray-900">
                    {stats.totalRequestsLastMinute}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow">
              <div className="flex items-center">
                <ServerIcon className="h-8 w-8 text-yellow-500" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">
                    Requests/Second
                  </p>
                  <p className="text-2xl font-semibold text-gray-900">
                    {stats.requestsPerSecond}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow">
              <div className="flex items-center">
                <ExclamationTriangleIcon
                  className={`h-8 w-8 ${
                    stats.suspiciousPatterns.length > 0
                      ? "text-red-500"
                      : "text-gray-300"
                  }`}
                />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">
                    Suspicious Patterns
                  </p>
                  <p className="text-2xl font-semibold text-gray-900">
                    {stats.suspiciousPatterns.length}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Suspicious Patterns Alert */}
        {stats && stats.suspiciousPatterns.length > 0 && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
            <h3 className="text-lg font-medium text-red-800 mb-2">
              🚨 Suspicious Activity Detected
            </h3>
            <div className="space-y-2">
              {stats.suspiciousPatterns.map((pattern, index) => (
                <div
                  key={index}
                  className={`p-2 rounded ${
                    pattern.severity === "HIGH" ? "bg-red-100" : "bg-yellow-100"
                  }`}
                >
                  <span className="font-semibold">{pattern.type}:</span>{" "}
                  {pattern.description}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Top Endpoints */}
          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900">
                Top Endpoints
              </h3>
            </div>
            <div className="p-6">
              {stats && stats.endpointMetrics.length > 0 ? (
                <div className="space-y-3">
                  {stats.endpointMetrics.slice(0, 10).map((endpoint, index) => (
                    <div
                      key={index}
                      className="flex justify-between items-center p-3 bg-gray-50 rounded"
                    >
                      <div className="flex-1">
                        <p className="font-medium text-sm">
                          {endpoint.endpoint}
                        </p>
                        <p className="text-xs text-gray-500">
                          {endpoint.count} requests • avg{" "}
                          {endpoint.averageResponseTime}ms
                        </p>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-semibold">
                          {endpoint.count}
                        </div>
                        {endpoint.errorCount > 0 && (
                          <div className="text-xs text-red-500">
                            {endpoint.errorCount} errors
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500">No endpoint data available</p>
              )}
            </div>
          </div>

          {/* Top IPs */}
          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900">
                Top IP Addresses
              </h3>
            </div>
            <div className="p-6">
              {stats && stats.topIPs.length > 0 ? (
                <div className="space-y-3">
                  {stats.topIPs.slice(0, 10).map((ip, index) => (
                    <div
                      key={index}
                      className="flex justify-between items-center p-3 bg-gray-50 rounded"
                    >
                      <div className="flex items-center">
                        <GlobeAltIcon className="h-4 w-4 text-gray-400 mr-2" />
                        <span className="font-mono text-sm">{ip.ip}</span>
                      </div>
                      <span className="font-semibold">{ip.count} requests</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500">No IP data available</p>
              )}
            </div>
          </div>

          {/* Top User Agents */}
          <div className="bg-white rounded-lg shadow lg:col-span-2">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900">
                Top User Agents
              </h3>
            </div>
            <div className="p-6">
              {stats && stats.topUserAgents.length > 0 ? (
                <div className="space-y-3">
                  {stats.topUserAgents.slice(0, 5).map((ua, index) => (
                    <div
                      key={index}
                      className="flex justify-between items-start p-3 bg-gray-50 rounded"
                    >
                      <div className="flex items-start flex-1">
                        <UserGroupIcon className="h-4 w-4 text-gray-400 mr-2 mt-0.5" />
                        <span className="text-sm break-all">
                          {ua.userAgent}
                        </span>
                      </div>
                      <span className="font-semibold ml-4">
                        {ua.count} requests
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500">No user agent data available</p>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center text-sm text-gray-500">
          Last updated: {new Date().toLocaleString()}
          {autoRefresh && (
            <span className="ml-2">• Auto-refreshing every 30 seconds</span>
          )}
        </div>
      </div>
    </div>
  );
}
