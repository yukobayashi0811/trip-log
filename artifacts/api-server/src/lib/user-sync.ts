import { clerkClient } from "@clerk/express";
import { db, users } from "@workspace/db";
import type { User } from "@workspace/db";

// Only server-verified Clerk identity is accepted here. Never trust request body,
// query parameters, or an unverified email claim to choose an internal account.
export async function synchronizeUser(clerkUserId: string): Promise<User> {
  const profile = await clerkClient.users.getUser(clerkUserId);
  const primaryEmail = profile.emailAddresses.find(
    (email) => email.id === profile.primaryEmailAddressId,
  );
  if (!primaryEmail || primaryEmail.verification?.status !== "verified") {
    throw new Error("A verified primary email is required");
  }
  const [user] = await db
    .insert(users)
    .values({ clerkUserId, email: primaryEmail.emailAddress })
    .onConflictDoUpdate({
      target: users.clerkUserId,
      set: { email: primaryEmail.emailAddress },
    })
    .returning();
  if (!user) throw new Error("Account synchronization failed");
  return user;
}
