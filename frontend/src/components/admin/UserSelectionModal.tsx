import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { XMarkIcon, MagnifyingGlassIcon } from "@heroicons/react/24/outline";
import { useUserData } from "../../hooks/useUserData";
import { useAvatarUpdates } from "../../hooks/useAvatarUpdates";
import {
  getAvatarUrlWithCacheBust,
  getAvatarAlt,
} from "../../utils/avatarUtils";
import type { User } from "../../types/management";
import { searchService, userService } from "../../services/api";

// Minimal backend user shape
type RawUser = {
  id: string;
  username: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  role: string;
  isAtCloudLeader?: boolean | "Yes" | "No" | null;
  roleInAtCloud?: string | null;
  avatar?: string | null;
  gender?: "male" | "female" | null;
  phone?: string | null;
  createdAt?: string | null;
  joinedAt?: string | null;
  homeAddress?: string | null;
  location?: string | null;
  occupation?: string | null;
  company?: string | null;
  weeklyChurch?: string | null;
  churchAddress?: string | null;
  isActive?: boolean | null;
};

export interface SelectedUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  roleInAtCloud?: string;
  gender: "male" | "female";
  avatar: string | null;
  phone?: string;
}

interface UserSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (user: SelectedUser) => void;
  title?: string;
  description?: string;
  // Optional: filter users by role
  allowedRoles?: string[];
  // Optional: exclude specific user IDs
  excludeUserIds?: string[];
}

export default function UserSelectionModal({
  isOpen,
  onClose,
  onSelect,
  title = "Select User",
  description = "Search and select a user from the list",
  allowedRoles,
  excludeUserIds = [],
}: UserSelectionModalProps) {
  useAvatarUpdates(); // Listen for avatar updates
  const { users } = useUserData();
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [page, setPage] = useState(1);
  const [hasNext, setHasNext] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [loadingAll, setLoadingAll] = useState(false);
  const [allLoaded, setAllLoaded] = useState(false);
  const fetchingRef = useRef(false);

  // Convert User to SelectedUser format
  const convertUserToSelectedUser = (user: User): SelectedUser => ({
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    role: user.role,
    roleInAtCloud: user.roleInAtCloud,
    gender: user.gender,
    avatar: user.avatar || null,
    phone: user.phone,
  });

  // Base filter for allowed users
  const baseFilter = useCallback(
    (user: User) => {
      // Exclude specified user IDs
      if (excludeUserIds.includes(user.id)) return false;

      // Filter by allowed roles if specified
      if (allowedRoles && allowedRoles.length > 0) {
        return allowedRoles.includes(user.role);
      }

      return true;
    },
    [excludeUserIds, allowedRoles]
  );

  const availableUsers = users.filter(baseFilter);

  const handleSelectUser = (user: User) => {
    const selectedUser = convertUserToSelectedUser(user);
    onSelect(selectedUser);
    handleClose();
  };

  const handleClose = () => {
    setQuery("");
    setSearchResults([]);
    setPage(1);
    setHasNext(false);
    setAllUsers([]);
    setLoadingAll(false);
    setAllLoaded(false);
    fetchingRef.current = false;
    onClose();
  };

  // Map backend AppUser -> management User
  const mapAppUserToMgmtUser = (u: RawUser): User => ({
    id: u.id,
    username: u.username,
    firstName: u.firstName || "",
    lastName: u.lastName || "",
    email: u.email,
    phone: u.phone ?? undefined,
    role: (u.role as User["role"]) || "Participant",
    isAtCloudLeader:
      u.isAtCloudLeader === true || u.isAtCloudLeader === "Yes" ? "Yes" : "No",
    roleInAtCloud: u.roleInAtCloud ?? undefined,
    joinDate: (u.createdAt || u.joinedAt || new Date().toISOString()).split(
      "T"
    )[0],
    gender: (u.gender as User["gender"]) || "male",
    avatar: u.avatar ?? undefined,
    homeAddress: u.homeAddress ?? u.location ?? undefined,
    occupation: u.occupation ?? undefined,
    company: u.company ?? undefined,
    weeklyChurch: u.weeklyChurch ?? undefined,
    churchAddress: u.churchAddress ?? undefined,
    isActive: u.isActive !== false,
  });

  // Focus the search input when opening
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // When opening with empty query, load all users
  useEffect(() => {
    let cancelled = false;
    const fetchAllUsers = async () => {
      // Only fetch if modal is open and no search query
      if (!isOpen || query.trim()) return;

      // Prevent duplicate fetches using ref
      if (fetchingRef.current) {
        console.log("UserSelectionModal: Already fetching, skipping");
        return;
      }

      // Check if already loaded
      if (allLoaded) {
        console.log("UserSelectionModal: Already loaded, skipping");
        return;
      }

      console.log("UserSelectionModal: Starting to fetch all users");
      fetchingRef.current = true;
      setLoadingAll(true);

      try {
        const rolesToFetch =
          allowedRoles && allowedRoles.length > 0
            ? allowedRoles
            : ["Super Admin", "Administrator", "Leader", "Participant"];

        console.log("UserSelectionModal: Fetching roles:", rolesToFetch);
        const acc: Record<string, User> = {};

        for (const role of rolesToFetch) {
          let p = 1;
          for (;;) {
            console.log(`UserSelectionModal: Fetching role ${role}, page ${p}`);
            const resp = await userService.getUsers({
              page: p,
              limit: 100,
              role,
              isActive: true,
              sortBy: "firstName",
              sortOrder: "asc",
            });
            console.log(
              `UserSelectionModal: Got ${
                resp.users?.length || 0
              } users for role ${role}, page ${p}`
            );

            const mapped = (resp.users as unknown as RawUser[])
              .map((u) => mapAppUserToMgmtUser(u))
              .filter(baseFilter);
            for (const u of mapped) acc[u.id] = u;
            if (!resp.pagination?.hasNext) break;
            p += 1;
          }
        }

        if (!cancelled) {
          const combined = Object.values(acc).sort((a, b) =>
            `${a.firstName} ${a.lastName}`.localeCompare(
              `${b.firstName} ${b.lastName}`
            )
          );
          console.log(
            "UserSelectionModal: Total users loaded:",
            combined.length
          );
          setAllUsers(combined);
          setAllLoaded(true);
        }
      } catch (e) {
        console.error("UserSelectionModal: Failed to load all users:", e);
        if (!cancelled) {
          setAllUsers([]);
          setAllLoaded(false);
        }
      } finally {
        if (!cancelled) {
          console.log("UserSelectionModal: Finished loading");
          fetchingRef.current = false;
          setLoadingAll(false);
        }
      }
    };
    fetchAllUsers();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, query]);

  // Debounced search effect
  useEffect(() => {
    let cancelled = false;
    const doSearch = async () => {
      if (!query.trim()) {
        setSearchResults([]);
        setHasNext(false);
        return;
      }
      setSearching(true);
      try {
        const result = await searchService.searchUsers(query.trim(), {
          page,
          limit: 100,
          isActive: true,
        });

        type SearchUsersResponse = {
          results?: RawUser[];
          users?: RawUser[];
          pagination?: { hasNext?: boolean };
        };
        const r = result as unknown as SearchUsersResponse;
        const resultsRaw: RawUser[] = r.results || r.users || [];
        const converted: User[] = resultsRaw
          .map(mapAppUserToMgmtUser)
          .filter(baseFilter);

        setSearchResults((prev) => {
          if (page === 1) return converted;
          const seen = new Set(prev.map((u) => u.id));
          const merged = [...prev];
          for (const u of converted) if (!seen.has(u.id)) merged.push(u);
          return merged;
        });

        const pg = (result as unknown as SearchUsersResponse).pagination;
        setHasNext(Boolean(pg?.hasNext));
      } catch (err) {
        console.error("Search users failed:", err);
      } finally {
        if (!cancelled) setSearching(false);
      }
    };

    const t = setTimeout(doSearch, 300);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [query, page, baseFilter]);

  if (!isOpen) return null;

  return createPortal(
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 z-40"
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">{title}</h2>
              <p className="text-sm text-gray-600 mt-1">{description}</p>
            </div>
            <button
              onClick={handleClose}
              className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <XMarkIcon className="h-6 w-6" />
            </button>
          </div>

          {/* Search */}
          <div className="p-4 border-b border-gray-200">
            <div className="relative">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => {
                  setPage(1);
                  setQuery(e.target.value);
                }}
                placeholder="Search by name or email..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* User List */}
          <div className="flex-1 overflow-y-auto p-4">
            {query && searchResults.length === 0 && !searching ? (
              <div className="text-center py-12">
                <p className="text-gray-500">
                  No users found matching "{query}"
                </p>
              </div>
            ) : !query ? (
              loadingAll ? (
                <div className="text-center py-12">
                  <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-purple-600 border-r-transparent"></div>
                  <p className="text-gray-500 mt-4">Loading users...</p>
                </div>
              ) : allUsers.length === 0 && availableUsers.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-gray-500">No users available</p>
                  {allowedRoles && allowedRoles.length > 0 && (
                    <p className="text-sm text-gray-400 mt-2">
                      Only {allowedRoles.join(", ")} roles can be selected
                    </p>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  {(allUsers.length > 0 ? allUsers : availableUsers).map(
                    (user) => (
                      <button
                        key={user.id}
                        type="button"
                        onClick={() => handleSelectUser(user)}
                        className="w-full flex items-center space-x-4 p-4 hover:bg-gray-50 rounded-lg transition-colors border border-transparent hover:border-gray-200"
                      >
                        <img
                          src={getAvatarUrlWithCacheBust(
                            user.avatar || null,
                            user.gender
                          )}
                          alt={getAvatarAlt(
                            user.firstName,
                            user.lastName,
                            !!user.avatar
                          )}
                          className="h-12 w-12 rounded-full object-cover"
                        />
                        <div className="flex-1 text-left">
                          <div className="font-medium text-gray-900">
                            {user.firstName} {user.lastName}
                          </div>
                          <div className="text-sm text-gray-600">
                            {user.email}
                          </div>
                          <div className="text-sm text-gray-500 mt-1">
                            {user.role}
                            {user.roleInAtCloud && (
                              <span className="ml-2">
                                • {user.roleInAtCloud}
                              </span>
                            )}
                          </div>
                        </div>
                      </button>
                    )
                  )}
                </div>
              )
            ) : (
              <div className="space-y-2">
                {searchResults.map((user) => (
                  <button
                    key={user.id}
                    type="button"
                    onClick={() => handleSelectUser(user)}
                    className="w-full flex items-center space-x-4 p-4 hover:bg-gray-50 rounded-lg transition-colors border border-transparent hover:border-gray-200"
                  >
                    <img
                      src={getAvatarUrlWithCacheBust(
                        user.avatar || null,
                        user.gender
                      )}
                      alt={getAvatarAlt(
                        user.firstName,
                        user.lastName,
                        !!user.avatar
                      )}
                      className="h-12 w-12 rounded-full object-cover"
                    />
                    <div className="flex-1 text-left">
                      <div className="font-medium text-gray-900">
                        {user.firstName} {user.lastName}
                      </div>
                      <div className="text-sm text-gray-600">{user.email}</div>
                      <div className="text-sm text-gray-500 mt-1">
                        {user.role}
                        {user.roleInAtCloud && (
                          <span className="ml-2">• {user.roleInAtCloud}</span>
                        )}
                      </div>
                    </div>
                  </button>
                ))}
                {hasNext && (
                  <div className="pt-4">
                    <button
                      type="button"
                      className="w-full px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                      onClick={() => setPage((p) => p + 1)}
                      disabled={searching}
                    >
                      {searching ? "Loading..." : "Load more"}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-gray-200 flex justify-end">
            <button
              onClick={handleClose}
              className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </>,
    document.body
  );
}
