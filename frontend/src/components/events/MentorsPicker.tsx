import React, { useEffect, useMemo, useRef, useState } from "react";
import { PlusIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { getAvatarAlt, getAvatarUrl } from "../../utils/avatarUtils";
import { programService, searchService, userService } from "../../services/api";

export type MentorLite = {
  id: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  gender?: "male" | "female";
  avatar?: string | null;
  roleInAtCloud?: string;
  role?: string;
};

type MentorsPickerProps = {
  programId: string;
  circle: string;
  onMentorIdsChange: (ids: string[]) => void;
  initialCustomMentors?: MentorLite[];
};

const MentorsPicker: React.FC<MentorsPickerProps> = ({
  programId,
  circle,
  onMentorIdsChange,
  initialCustomMentors,
}) => {
  // stabilize the callback reference
  const onMentorIdsChangeRef = useRef(onMentorIdsChange);
  useEffect(() => {
    onMentorIdsChangeRef.current = onMentorIdsChange;
  }, [onMentorIdsChange]);

  const [inheritedMentors, setInheritedMentors] = useState<MentorLite[]>([]);
  const [customMentors, setCustomMentors] = useState<MentorLite[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);
  const [excludedMentorIds, setExcludedMentorIds] = useState<Set<string>>(
    new Set()
  );
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<MentorLite[]>([]);
  const [searching, setSearching] = useState(false);

  // Prevent re-initialization with the same mentors
  const initializedWithRef = useRef<MentorLite[] | null>(null);
  useEffect(() => {
    if (
      !isInitialized &&
      initialCustomMentors &&
      initialCustomMentors.length > 0 &&
      JSON.stringify(initializedWithRef.current) !==
        JSON.stringify(initialCustomMentors)
    ) {
      initializedWithRef.current = initialCustomMentors;
      setCustomMentors(initialCustomMentors);
      setIsInitialized(true);
    } else if (!initialCustomMentors || initialCustomMentors.length === 0) {
      if (!isInitialized) {
        initializedWithRef.current = [];
        setCustomMentors([]);
        setIsInitialized(true);
      }
    }
  }, [initialCustomMentors, isInitialized]);

  // Load inherited mentors based on program + circle
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!programId || !circle) {
        if (!cancelled) setInheritedMentors([]);
        return;
      }
      try {
        type ProgMentor = {
          userId?: string;
          firstName?: string;
          lastName?: string;
          email?: string;
          gender?: "male" | "female";
          avatar?: string;
          roleInAtCloud?: string;
        };
        const prog = (await programService.getById(programId)) as {
          mentorsByCircle?: Record<string, Array<ProgMentor>>;
        };
        const byCircle = prog?.mentorsByCircle || {};
        const src = (byCircle[circle] || []) as Array<ProgMentor>;
        const mapped: MentorLite[] = src
          .map((m) => ({
            id: m.userId || "",
            firstName: m.firstName,
            lastName: m.lastName,
            email: m.email,
            gender: m.gender,
            avatar: m.avatar,
            roleInAtCloud: m.roleInAtCloud,
          }))
          .filter((m) => !!m.id);
        if (!cancelled) setInheritedMentors(mapped);
      } catch (e) {
        console.error("Failed to load mentorsByCircle for program:", e);
        if (!cancelled) setInheritedMentors([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [programId, circle]);

  // Search eligible mentors
  useEffect(() => {
    let cancelled = false;
    const ALLOWED = new Set([
      "Super Admin",
      "Administrator",
      "Leader",
      "Guest Expert",
    ]);
    const doSearch = async () => {
      if (!searchOpen) {
        setResults([]);
        return;
      }
      setSearching(true);
      try {
        let allResults: MentorLite[] = [];
        if (query.trim()) {
          const resp = await searchService.searchUsers(query.trim(), {
            page: 1,
            limit: 50,
            isActive: true,
          });
          type SearchUser = {
            id?: string;
            _id?: string;
            firstName?: string;
            lastName?: string;
            email?: string;
            gender?: "male" | "female";
            avatar?: string | null;
            roleInAtCloud?: string;
            role?: string;
          };
          const respObj = resp as Partial<{
            results: SearchUser[];
            users: SearchUser[];
          }>;
          const arr: SearchUser[] = respObj.results ?? respObj.users ?? [];
          const filtered = arr.filter((u) =>
            ALLOWED.has(u.role || u.roleInAtCloud || "")
          );
          allResults = filtered
            .map((u) => ({
              id: u.id || u._id || "",
              firstName: u.firstName || "",
              lastName: u.lastName || "",
              email: u.email || "",
              gender: u.gender || undefined,
              avatar: u.avatar ?? null,
              roleInAtCloud: u.roleInAtCloud || undefined,
              role: u.role || undefined,
            }))
            .filter((m) => !!m.id);
        } else {
          const rolesToFetch = [
            "Super Admin",
            "Administrator",
            "Leader",
            "Guest Expert",
          ] as const;
          const roleResults: Record<string, MentorLite> = {};
          for (const role of rolesToFetch) {
            try {
              const resp = await userService.getUsers({
                page: 1,
                limit: 50,
                role,
                isActive: true,
                sortBy: "firstName",
                sortOrder: "asc",
              });
              type RoleUser = {
                id?: string;
                firstName?: string;
                lastName?: string;
                email?: string;
                gender?: "male" | "female";
                avatar?: string | null;
                roleInAtCloud?: string;
                role?: string;
              };
              const users = (resp.users || []) as RoleUser[];
              users.forEach((u) => {
                if (u.id) {
                  roleResults[u.id] = {
                    id: u.id,
                    firstName: u.firstName || "",
                    lastName: u.lastName || "",
                    email: u.email || "",
                    gender: u.gender || undefined,
                    avatar: u.avatar ?? null,
                    roleInAtCloud: u.roleInAtCloud || undefined,
                    role: u.role || undefined,
                  };
                }
              });
            } catch (roleError) {
              console.warn(`Failed to fetch ${role} users:`, roleError);
            }
          }
          allResults = Object.values(roleResults);
        }
        if (!cancelled) setResults(allResults);
      } catch (e) {
        console.error("Mentor search failed:", e);
        if (!cancelled) setResults([]);
      } finally {
        if (!cancelled) setSearching(false);
      }
    };
    const t = setTimeout(doSearch, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [query, searchOpen]);

  // Emit only custom mentor IDs to parent when actually changed and initialized
  const prevCustomMentorsRef = useRef<MentorLite[] | null>(null);
  useEffect(() => {
    if (
      isInitialized &&
      JSON.stringify(prevCustomMentorsRef.current) !==
        JSON.stringify(customMentors)
    ) {
      prevCustomMentorsRef.current = customMentors;
      onMentorIdsChangeRef.current(customMentors.map((m) => m.id));
    }
  }, [customMentors, isInitialized]);

  const mergedMentors = useMemo(() => {
    const acc: Record<string, MentorLite> = {};
    for (const m of inheritedMentors) {
      if (!excludedMentorIds.has(m.id)) acc[m.id] = m;
    }
    for (const m of customMentors) acc[m.id] = m;
    return Object.values(acc);
  }, [inheritedMentors, customMentors, excludedMentorIds]);

  const MentorCard = ({
    mentor,
    isInherited = false,
    onRemove,
  }: {
    mentor: MentorLite;
    isInherited?: boolean;
    onRemove?: () => void;
  }) => (
    <div className="flex items-center space-x-3 p-4 bg-gray-50 rounded-lg border">
      <img
        src={getAvatarUrl(mentor.avatar || null, mentor.gender || "male")}
        alt={getAvatarAlt(
          mentor.firstName || "Unknown",
          mentor.lastName || "User",
          !!mentor.avatar
        )}
        className="h-12 w-12 rounded-full object-cover"
      />
      <div className="flex-1">
        <div className="font-medium text-gray-900">
          {mentor.firstName} {mentor.lastName}
          {isInherited && (
            <span className="ml-2 text-sm text-blue-600 font-normal">
              (Inherited)
            </span>
          )}
        </div>
        <div className="text-sm text-gray-600">
          {mentor.roleInAtCloud || mentor.role || "Mentor"}
        </div>
      </div>
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="p-1 text-gray-400 hover:text-red-500 transition-colors"
          title={isInherited ? "Exclude from this event" : "Remove"}
        >
          <XMarkIcon className="h-5 w-5" />
        </button>
      )}
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="block text-sm font-medium text-gray-700">Mentors</div>

      {mergedMentors.map((mentor) => {
        const isInherited = inheritedMentors.some((m) => m.id === mentor.id);
        return (
          <MentorCard
            key={mentor.id}
            mentor={mentor}
            isInherited={isInherited}
            onRemove={
              isInherited
                ? () => {
                    setExcludedMentorIds((prev) => {
                      const next = new Set(prev);
                      next.add(mentor.id);
                      return next;
                    });
                  }
                : () => {
                    setCustomMentors((prev) =>
                      prev.filter((x) => x.id !== mentor.id)
                    );
                  }
            }
          />
        );
      })}

      <div className="relative">
        <button
          type="button"
          onClick={() => setSearchOpen(!searchOpen)}
          className="flex items-center space-x-2 px-4 py-2 border border-dashed border-gray-300 rounded-lg text-gray-600 hover:text-gray-800 hover:border-gray-400 transition-colors w-full justify-center"
        >
          <PlusIcon className="h-5 w-5" />
          <span>Add Mentors for this event only</span>
        </button>

        {searchOpen && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-300 rounded-md shadow-lg z-10 max-h-64 overflow-hidden">
            <div className="p-3 border-b border-gray-200">
              <input
                type="text"
                placeholder="Search mentors by name or email"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                autoFocus
              />
            </div>

            <div className="max-h-48 overflow-y-auto">
              {searching && (
                <div className="p-3 text-sm text-gray-500">Searching…</div>
              )}
              {!searching && results.length === 0 && (
                <div className="p-3 text-sm text-gray-500">
                  {query
                    ? `No mentors found matching "${query}"`
                    : "No eligible mentors found"}
                </div>
              )}
              {!searching &&
                results.length > 0 &&
                results.filter(
                  (user) =>
                    !mergedMentors.some((existing) => existing.id === user.id)
                ).length === 0 && (
                  <div className="p-3 text-sm text-gray-500">
                    All available mentors are already selected
                  </div>
                )}
              {results
                .filter(
                  (user) =>
                    !mergedMentors.some((existing) => existing.id === user.id)
                )
                .map((user) => (
                  <button
                    key={user.id}
                    type="button"
                    onClick={() => {
                      setCustomMentors((prev) => {
                        if (prev.some((x) => x.id === user.id)) return prev;
                        return [...prev, user];
                      });
                      setSearchOpen(false);
                      setQuery("");
                    }}
                    className="w-full flex items-center space-x-3 p-3 hover:bg-gray-50 transition-colors"
                  >
                    <img
                      src={getAvatarUrl(
                        user.avatar || null,
                        user.gender || "male"
                      )}
                      alt={getAvatarAlt(
                        user.firstName || "Unknown",
                        user.lastName || "User",
                        !!user.avatar
                      )}
                      className="h-8 w-8 rounded-full object-cover"
                    />
                    <div className="flex-1 text-left">
                      <div className="text-sm font-medium text-gray-900">
                        {user.firstName} {user.lastName}
                      </div>
                      <div className="text-xs text-gray-600">{user.email}</div>
                    </div>
                  </button>
                ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MentorsPicker;
