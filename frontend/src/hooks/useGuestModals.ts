import { useState } from "react";

export interface GuestModalState {
  open: boolean;
  roleId?: string;
  guest?: { id?: string; fullName: string; email?: string; phone?: string };
}

export interface ResendLinkModalState {
  open: boolean;
  guestId?: string;
  guestName?: string;
}

export interface GuestModalsResult {
  cancelConfirm: GuestModalState;
  setCancelConfirm: React.Dispatch<React.SetStateAction<GuestModalState>>;
  editGuest: GuestModalState;
  setEditGuest: React.Dispatch<React.SetStateAction<GuestModalState>>;
  resendLinkConfirm: ResendLinkModalState;
  setResendLinkConfirm: React.Dispatch<
    React.SetStateAction<ResendLinkModalState>
  >;
}

export function useGuestModals(): GuestModalsResult {
  // Guest management modals
  const [cancelConfirm, setCancelConfirm] = useState<GuestModalState>({
    open: false,
  });
  const [editGuest, setEditGuest] = useState<GuestModalState>({
    open: false,
  });
  const [resendLinkConfirm, setResendLinkConfirm] =
    useState<ResendLinkModalState>({
      open: false,
    });

  return {
    cancelConfirm,
    setCancelConfirm,
    editGuest,
    setEditGuest,
    resendLinkConfirm,
    setResendLinkConfirm,
  };
}
