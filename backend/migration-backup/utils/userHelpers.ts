// Type assertion helper for User model
export const getUserFields = (user: any) => ({
  _id: user._id,
  username: user.username,
  email: user.email,
  firstName: user.firstName,
  lastName: user.lastName,
  gender: user.gender,
  avatar: user.avatar,
  homeAddress: user.homeAddress,
  phone: user.phone,
  role: user.role,
  isAtCloudLeader: user.isAtCloudLeader,
  roleInAtCloud: user.roleInAtCloud,
  occupation: user.occupation,
  company: user.company,
  weeklyChurch: user.weeklyChurch,
  churchAddress: user.churchAddress,
  isActive: user.isActive,
  isVerified: user.isVerified,
  lastLogin: user.lastLogin,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
});

export const getUserMethods = (user: any) => ({
  comparePassword: user.comparePassword?.bind(user),
  generateEmailVerificationToken:
    user.generateEmailVerificationToken?.bind(user),
  generatePasswordResetToken: user.generatePasswordResetToken?.bind(user),
  incrementLoginAttempts: user.incrementLoginAttempts?.bind(user),
  resetLoginAttempts: user.resetLoginAttempts?.bind(user),
  updateLastLogin: user.updateLastLogin?.bind(user),
  isAccountLocked: user.isAccountLocked?.bind(user),
  save: user.save?.bind(user),
});
