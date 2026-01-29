import { prisma } from "@/lib/prisma";
export async function Admin(email?: string) {
  if (!email) return false;
  const admin = await prisma.admin.findUnique({
    where: { email },
  });
  return admin !== null;
}