import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { programService } from "../services/api";
import type { EventData } from "../types/event";

type Program = {
  id: string;
  title: string;
  programType: "EMBA Mentor Circles" | "Effective Communication Workshops";
  hostedBy?: string;
  period?: {
    startYear?: string;
    startMonth?: string;
    endYear?: string;
    endMonth?: string;
  };
  introduction?: string;
  flyerUrl?: string;
  mentors?: Array<{
    userId: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    gender?: "male" | "female";
    avatar?: string;
    roleInAtCloud?: string;
  }>;
  mentorsByCircle?: {
    E?: Array<{
      userId: string;
      firstName?: string;
      lastName?: string;
      email?: string;
      gender?: "male" | "female";
      avatar?: string;
      roleInAtCloud?: string;
    }>;
    M?: Array<{
      userId: string;
      firstName?: string;
      lastName?: string;
      email?: string;
      gender?: "male" | "female";
      avatar?: string;
      roleInAtCloud?: string;
    }>;
    B?: Array<{
      userId: string;
      firstName?: string;
      lastName?: string;
      email?: string;
      gender?: "male" | "female";
      avatar?: string;
      roleInAtCloud?: string;
    }>;
    A?: Array<{
      userId: string;
      firstName?: string;
      lastName?: string;
      email?: string;
      gender?: "male" | "female";
      avatar?: string;
      roleInAtCloud?: string;
    }>;
  };
};

export default function ProgramDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [program, setProgram] = useState<Program | null>(null);
  const [events, setEvents] = useState<EventData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const p = await programService.getById(id);
        const evts = await programService.listEvents(id);
        if (cancelled) return;
        setProgram(p as Program);
        type RawEvent = Partial<EventData> & { id?: string; _id?: string };
        setEvents(
          (evts as RawEvent[]).map((e) => ({
            id: e.id || e._id,
            title: e.title,
            type: e.type,
            date: e.date,
            endDate: e.endDate,
            time: e.time,
            endTime: e.endTime,
            location: e.location,
            organizer: e.organizer,
            roles: e.roles || [],
            signedUp: e.signedUp || 0,
            totalSlots: e.totalSlots || 0,
            format: e.format,
            createdBy: e.createdBy,
            createdAt: e.createdAt,
          })) as EventData[]
        );
      } catch (e) {
        console.error("Failed to load program", e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const periodText = (p?: Program["period"]) => {
    if (!p) return "";
    const s = [p.startMonth, p.startYear].filter(Boolean).join(" ");
    const e = [p.endMonth, p.endYear].filter(Boolean).join(" ");
    return [s, e].filter(Boolean).join(" – ");
  };

  if (loading)
    return (
      <div className="flex justify-center items-center min-h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );

  if (!program) return <div className="text-center">Program not found.</div>;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {program.title}
            </h1>
            <p className="text-sm text-gray-600 mt-1">{program.programType}</p>
            {program.period && (
              <p className="text-sm text-gray-600 mt-1">
                {periodText(program.period)}
              </p>
            )}
          </div>
        </div>
        {program.introduction && (
          <p className="text-gray-800 leading-relaxed">
            {program.introduction}
          </p>
        )}
      </div>

      {/* Mentors section */}
      {(program.mentors || program.mentorsByCircle) && (
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Mentors</h2>
          {program.mentors && (
            <ul className="list-disc ml-6 text-gray-800">
              {program.mentors.map((m) => (
                <li key={m.userId}>
                  {[m.firstName, m.lastName].filter(Boolean).join(" ")}
                </li>
              ))}
            </ul>
          )}
          {program.mentorsByCircle && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {(["E", "M", "B", "A"] as const).map((c) => {
                const arr = program.mentorsByCircle?.[c];
                if (!arr || arr.length === 0) return null;
                return (
                  <div key={c} className="bg-gray-50 rounded-md p-4 border">
                    <div className="font-medium mb-2">Circle {c}</div>
                    <ul className="list-disc ml-5 text-gray-800">
                      {arr.map((m) => (
                        <li key={`${c}-${m.userId}`}>
                          {[m.firstName, m.lastName].filter(Boolean).join(" ")}
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Events in program */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Events</h2>
        {events.length === 0 ? (
          <p className="text-gray-700">No events linked to this program yet.</p>
        ) : (
          <ul className="divide-y">
            {events.map((e) => (
              <li key={e.id} className="py-3 flex justify-between items-center">
                <div>
                  <div className="font-medium text-gray-900">{e.title}</div>
                  <div className="text-sm text-gray-600">{e.type}</div>
                </div>
                <button
                  className="text-blue-600 hover:text-blue-800 hover:underline text-sm"
                  onClick={() => navigate(`/dashboard/event/${e.id}`)}
                >
                  View
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
