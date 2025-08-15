import { useManagement } from "../hooks/useManagement";
import ManagementHeader from "../components/management/ManagementHeader";
import UserTable from "../components/management/UserTable";
import UserPagination from "../components/management/UserPagination";
import { Card, CardContent } from "../components/ui";
import ConfirmationModal from "../components/common/ConfirmationModal";
import UserDeleteModal from "../components/management/UserDeleteModal";

export default function Management() {
  const {
    // User data
    users,
    currentUserRole,
    roleStats,
    pagination,
    loadPage,

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
    <div className="max-w-[1280px] xl:max-w-[1360px] 2xl:max-w-[1440px] mx-auto px-4 lg:px-6 space-y-6">
      {/* Header Section with Statistics */}
      <ManagementHeader
        currentUserRole={currentUserRole}
        roleStats={roleStats}
      />

      {/* User Management Table */}
      <Card className="overflow-visible">
        <CardContent className="overflow-visible">
          <UserTable
            users={users}
            getActionsForUser={getActionsForUser}
            openDropdown={openDropdown}
            onToggleDropdown={toggleDropdown}
            currentUserRole={currentUserRole}
          />
          <UserPagination
            currentPage={pagination.currentPage}
            totalPages={pagination.totalPages}
            hasNext={pagination.hasNext}
            hasPrev={pagination.hasPrev}
            onPageChange={(p) => loadPage(p)}
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
