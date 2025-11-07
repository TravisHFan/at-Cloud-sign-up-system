import { useState, useEffect } from "react";
import type { EventData } from "../types/event";
import { programService, purchaseService } from "../services/api";

export interface ProgramAccessResult {
  programNames: Record<string, string>;
  showAccessModal: boolean;
  setShowAccessModal: (show: boolean) => void;
  blockedProgramId: string | null;
  blockedProgramName: string;
  checkingAccess: boolean;
}

export interface UseProgramAccessParams {
  event: EventData | null;
  currentUser: { id: string; role?: string } | null;
}

export function useProgramAccess({
  event,
  currentUser,
}: UseProgramAccessParams): ProgramAccessResult {
  const [programNames, setProgramNames] = useState<Record<string, string>>({});
  const [showAccessModal, setShowAccessModal] = useState(false);
  const [blockedProgramId, setBlockedProgramId] = useState<string | null>(null);
  const [blockedProgramName, setBlockedProgramName] = useState<string>("");
  const [checkingAccess, setCheckingAccess] = useState(false);

  // Fetch program names for programLabels
  useEffect(() => {
    if (!event?.programLabels || event.programLabels.length === 0) {
      setProgramNames({});
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const names: Record<string, string> = {};
        const labels = event.programLabels || [];
        for (const programId of labels) {
          try {
            const program = await programService.getById(programId);
            if (!cancelled && program) {
              names[programId] =
                (program as { title?: string }).title || "Unknown Program";
            }
          } catch {
            // If program not found, use ID as fallback
            if (!cancelled) {
              names[programId] = programId;
            }
          }
        }
        if (!cancelled) {
          setProgramNames(names);
        }
      } catch (error) {
        console.error("Error fetching program names:", error);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [event?.programLabels]);

  // Check program access for paid programs
  useEffect(() => {
    if (!event || !event.programLabels || event.programLabels.length === 0) {
      return;
    }

    // Skip check for Super Admin, Administrator
    if (
      currentUser?.role === "Super Admin" ||
      currentUser?.role === "Administrator"
    ) {
      return;
    }

    let cancelled = false;
    setCheckingAccess(true); // Set loading state immediately

    (async () => {
      try {
        // Check access for all programs this event belongs to
        const programLabels = event.programLabels || [];
        let hasAccessToAny = false; // Track if user has access to at least one program

        for (const programId of programLabels) {
          if (cancelled) break;

          try {
            // First check if program is free
            const program = await programService.getById(programId);
            const isFree = (program as { isFree?: boolean }).isFree;

            // Skip check for free programs - they grant access
            if (isFree) {
              hasAccessToAny = true;
              break; // Found access via free program, no need to check others
            }

            // Check if user is a mentor for this program
            const mentors =
              (program as { mentors?: Array<{ userId: string }> }).mentors ||
              [];
            const isMentor = mentors.some((m) => m.userId === currentUser?.id);

            if (isMentor) {
              hasAccessToAny = true;
              break; // Found access via mentor status, no need to check others
            }

            // Check purchase access
            const accessResult = await purchaseService.checkProgramAccess(
              programId
            );

            if (accessResult.hasAccess && !cancelled) {
              // User has access to this program - grant access to event
              hasAccessToAny = true;
              break; // Found access, no need to check other programs
            }
          } catch (error) {
            console.error(
              `Error checking access for program ${programId}:`,
              error
            );
            // Continue checking other programs on error
          }
        }

        // Only block if user has NO access to ANY of the programs
        if (!hasAccessToAny && !cancelled && programLabels.length > 0) {
          // Block access - show modal for the first program
          const firstProgramId = programLabels[0];
          const firstProgram = await programService.getById(firstProgramId);
          setBlockedProgramId(firstProgramId);
          setBlockedProgramName(
            (firstProgram as { title?: string }).title || "a program"
          );
          setShowAccessModal(true);
        }
      } catch (error) {
        console.error("Error checking program access:", error);
      } finally {
        if (!cancelled) {
          setCheckingAccess(false);
        }
      }
    })();

    return () => {
      cancelled = true;
      setCheckingAccess(false); // Always reset loading state on cleanup
    };
  }, [event, event?.programLabels, currentUser]);

  return {
    programNames,
    showAccessModal,
    setShowAccessModal,
    blockedProgramId,
    blockedProgramName,
    checkingAccess,
  };
}
