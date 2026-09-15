import { requireAuthenticatedUser, getMyMemberships } from "@/lib/server/auth";
import { getSupabase } from "@/lib/supabase/server";
import {
  getOperationsSummary,
  getRecentFailures,
  getBusinessHealth,
  getBookingFunnel,
} from "@/lib/server/operations/dashboard";
import { ApiError } from "@/lib/server/errors";

export const dynamic = "force-dynamic";

export default async function OperationsDashboardPage() {
  // Require authentication.
  const user = await requireAuthenticatedUser();
  const db = getSupabase();

  // Check the user owns at least one business.
  const memberships = await getMyMemberships(user.id, db);
  const ownerMembership = memberships.find((m) => m.role === "owner");
  if (!ownerMembership) {
    throw new ApiError(403, "FORBIDDEN", "Only business owners can access this page.");
  }

  const [summary, failures, healthArr, funnel] = await Promise.all([
    getOperationsSummary(db),
    getRecentFailures(db),
    getBusinessHealth(db),
    getBookingFunnel(db),
  ]);

  // Find this business's health from the array.
  const health = healthArr.find((h) => h.businessId === ownerMembership.business_id);

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto max-w-6xl">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">
          Operations Dashboard
        </h1>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <SummaryCard
            label="Booking Attempts"
            value={summary.bookingAttempts}
            sub={`${summary.submitAttempts} submits`}
          />
          <SummaryCard
            label="Bookings Created"
            value={summary.bookingsCreated}
            sub={`${summary.submitSuccessRate.toFixed(1)}% success`}
          />
          <SummaryCard
            label="Failures"
            value={summary.bookingsFailed}
            sub={`${summary.technicalFailures} technical`}
            alert={summary.technicalFailures > 0}
          />
          <SummaryCard
            label="Notifications"
            value={summary.notificationsSent}
            sub={`${summary.notificationsFailed} failed`}
            alert={summary.notificationsFailed > 0}
          />
        </div>

        {/* Funnel */}
        <section className="bg-white rounded-lg shadow p-6 mb-8">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">
            Booking Funnel
          </h2>
          <div className="space-y-3">
            {funnel.map((step) => (
              <div key={step.step} className="flex items-center gap-4">
                <span className="w-48 text-sm text-gray-600">{step.step}</span>
                <div className="flex-1 bg-gray-100 rounded-full h-6 overflow-hidden">
                  <div
                    className="bg-blue-500 h-full rounded-full transition-all"
                    style={{ width: `${step.percentage}%` }}
                  />
                </div>
                <span className="w-16 text-right text-sm font-medium text-gray-800">
                  {step.count}
                </span>
                <span className="w-16 text-right text-sm text-gray-500">
                  {step.percentage.toFixed(1)}%
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* Business Health */}
        {health && (
          <section className="bg-white rounded-lg shadow p-6 mb-8">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">
              Your Business Health
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <HealthStat label="Attempts" value={health.bookingAttempts} />
              <HealthStat label="Completed" value={health.completed} />
              <HealthStat
                label="Technical Failures"
                value={health.technicalFailures}
                alert={health.technicalFailures > 0}
              />
              <HealthStat
                label="Notification Failures"
                value={health.notificationFailures}
                alert={health.notificationFailures > 0}
              />
              <HealthStat
                label="Calendar Failures"
                value={health.calendarFailures}
                alert={health.calendarFailures > 0}
              />
            </div>
          </section>
        )}

        {/* Recent Failures */}
        <section className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">
            Recent Failures
          </h2>
          {failures.length === 0 ? (
            <p className="text-gray-500 text-sm">No recent failures.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-2 px-3 font-medium text-gray-600">
                      Time
                    </th>
                    <th className="text-left py-2 px-3 font-medium text-gray-600">
                      Event
                    </th>
                    <th className="text-left py-2 px-3 font-medium text-gray-600">
                      Code
                    </th>
                    <th className="text-left py-2 px-3 font-medium text-gray-600">
                      Severity
                    </th>
                    <th className="text-left py-2 px-3 font-medium text-gray-600">
                      Provider
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {failures.map((f) => (
                    <tr key={f.id} className="border-b border-gray-100">
                      <td className="py-2 px-3 text-gray-500">
                        {new Date(f.timestamp).toLocaleString()}
                      </td>
                      <td className="py-2 px-3 text-gray-800">{f.eventName}</td>
                      <td className="py-2 px-3">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                            f.severity === "technical"
                              ? "bg-red-100 text-red-700"
                              : "bg-yellow-100 text-yellow-700"
                          }`}
                        >
                          {f.errorCode ?? "—"}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-gray-600">
                        {f.severity ?? "—"}
                      </td>
                      <td className="py-2 px-3 text-gray-600">
                        {f.provider ?? "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  sub,
  alert,
}: {
  label: string;
  value: number;
  sub: string;
  alert?: boolean;
}) {
  return (
    <div
      className={`bg-white rounded-lg shadow p-4 ${
        alert ? "ring-2 ring-red-400" : ""
      }`}
    >
      <p className="text-sm text-gray-500">{label}</p>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      <p className="text-xs text-gray-400 mt-1">{sub}</p>
    </div>
  );
}

function HealthStat({
  label,
  value,
  alert,
}: {
  label: string;
  value: number;
  alert?: boolean;
}) {
  return (
    <div className={alert ? "text-red-600" : "text-gray-800"}>
      <p className="text-xs text-gray-500">{label}</p>
      <p className="text-lg font-semibold">{value}</p>
    </div>
  );
}
