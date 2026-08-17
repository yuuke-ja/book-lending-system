import { beforeEach, describe, expect, it, vi } from "vitest";
import { handleSignOut } from "@/lib/action/signout";
import { signOut } from "@/lib/auth";

vi.mock("@/lib/auth", () => ({ signOut: vi.fn() }));

const mockedSignOut = vi.mocked(signOut);

describe("handleSignOut", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("トップページへのredirectを指定して1回だけsignOutする", async () => {
    mockedSignOut.mockResolvedValueOnce(undefined as never);

    await expect(handleSignOut()).resolves.toBeUndefined();
    expect(mockedSignOut).toHaveBeenCalledOnce();
    expect(mockedSignOut).toHaveBeenCalledWith({ redirectTo: "/" });
  });

  it("signOutの例外を握りつぶさない", async () => {
    const error = new Error("sign out failed");
    mockedSignOut.mockRejectedValueOnce(error);

    await expect(handleSignOut()).rejects.toBe(error);
  });
});
