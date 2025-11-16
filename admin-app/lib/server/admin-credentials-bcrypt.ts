import bcrypt from 'bcrypt';

interface AdminCredential {
  actorId: string;
  email: string;
  password?: string;        // Plain text (deprecated)
  passwordHash?: string;    // Bcrypt hash (preferred)
  label?: string;
  username?: string;
}

const credentials: AdminCredential[] = JSON.parse(
  process.env.ADMIN_ACCESS_CREDENTIALS || '[]'
);

export function verifyAdminCredentialWithBcrypt(
  email: string,
  password: string
): AdminCredential | null {
  const credential = credentials.find(
    (c) => c.email.toLowerCase() === email.toLowerCase()
  );

  if (!credential) {
    return null;
  }

  // Check bcrypt hash (preferred)
  if (credential.passwordHash) {
    const isValid = bcrypt.compareSync(password, credential.passwordHash);
    return isValid ? credential : null;
  }

  // Fallback to plain text (legacy, log warning)
  if (credential.password) {
    console.warn(
      `⚠️  Plain text password used for ${email}. Please migrate to bcrypt hashes.`
    );
    return credential.password === password ? credential : null;
  }

  return null;
}

// Utility to generate password hash
export function hashPassword(password: string): string {
  return bcrypt.hashSync(password, 10);
}

// For backward compatibility
export { verifyAdminCredentialWithBcrypt as verifyAdminCredential };
