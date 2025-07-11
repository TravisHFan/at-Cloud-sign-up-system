import { useManagement } from "../hooks/useManagement";
import ManagementHeader from "../components/management/ManagementHeader";
import UserTable from "../components/management/UserTable";
import { Card, CardContent } from "../components/ui";
import ConfirmationModal from "../components/common/ConfirmationModal";
import UserDeleteModal from "../components/management/UserDeleteModal";

export default function Management() {
  const {
    // User data
    users,
    currentUserRole,
    roleStats,

    // Dropdown state
    openDropdown,
    toggleDropdown,

    // User actions
    getActionsForUser,

    // Confirmation modal state
    confirmationAction,
    isProcessing,
    handleConfirmAction,
    handleCancelConfirmation,
  } = useManagement();

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header Section with Statistics */}
      <ManagementHeader
        currentUserRole={currentUserRole}
        roleStats={roleStats}
      />

      {/* User Management Table */}
      <Card>
        <CardContent>
          <UserTable
            users={users}
            getActionsForUser={getActionsForUser}
            openDropdown={openDropdown}
            onToggleDropdown={toggleDropdown}
          />
        </CardContent>
      </Card>

      {/* Confirmation Modals */}
      {confirmationAction && confirmationAction.type === "delete" && (
        <UserDeleteModal
          isOpen={!!confirmationAction}
          onClose={handleCancelConfirmation}
          onConfirm={handleConfirmAction}
          userName={`${confirmationAction.user.firstName} ${confirmationAction.user.lastName}`}
          title={confirmationAction.title}
          message={confirmationAction.message}
          isLoading={isProcessing}
        />
      )}

      {confirmationAction && confirmationAction.type !== "delete" && (
        <ConfirmationModal
          isOpen={!!confirmationAction}
          onClose={handleCancelConfirmation}
          onConfirm={handleConfirmAction}
          title={confirmationAction.title}
          message={confirmationAction.message}
          confirmText={confirmationAction.confirmText}
          type={confirmationAction.actionType}
          isLoading={isProcessing}
        />
      )}
    </div>
  );
}
