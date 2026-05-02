function sanitizeUser(user) {
  if (!user) return null;

  return {
    id: user.id,
    fullName: user.full_name,
    email: user.email,
    phoneNumber: user.phone_number,
    role: user.role,
    status: user.status,
    createdAt: user.created_at,
    updatedAt: user.updated_at
  };
}

module.exports = sanitizeUser;
