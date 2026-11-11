import "@testing-library/jest-dom";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import MorePage from "../../app/(finance)/more/page";

const signOutMock = vi.fn();
const deleteMock = vi.fn();

vi.mock("@clerk/nextjs", () => ({
  useUser: () => ({
    user: {
      firstName: "Max",
      fullName: "Max Chen",
      hasImage: false,
      primaryEmailAddress: { emailAddress: "max@example.com" },
      emailAddresses: [{ emailAddress: "max@example.com" }],
    },
  }),
  useClerk: () => ({ signOut: signOutMock }),
}));

vi.mock("../../lib/api-client", () => ({
  api: { delete: (path: string) => deleteMock(path) },
}));

vi.mock("../../hooks/useIsPremium", () => ({
  useIsPremium: () => ({ isPremium: false, loading: false }),
}));

function openDeleteSheet() {
  fireEvent.click(screen.getByRole("button", { name: /刪除帳號/ }));
}

describe("Settings (MorePage)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    deleteMock.mockResolvedValue({ success: true, data: { deleted: true } });
  });

  it("greets the user by first name", () => {
    render(<MorePage />);
    expect(screen.getByRole("heading", { name: "Hi, Max" })).toBeInTheDocument();
  });

  it("shows the account name and email in the avatar menu", () => {
    render(<MorePage />);
    expect(screen.queryByText("max@example.com")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "帳號選單" }));
    expect(screen.getByText("Max Chen")).toBeInTheDocument();
    expect(screen.getByText("max@example.com")).toBeInTheDocument();
  });

  it("signs out to the welcome page from the avatar menu", () => {
    render(<MorePage />);
    fireEvent.click(screen.getByRole("button", { name: "帳號選單" }));
    fireEvent.click(screen.getByRole("menuitem", { name: /登出/ }));
    expect(signOutMock).toHaveBeenCalledWith({ redirectUrl: "/welcome" });
  });

  it("does not delete until the sheet is confirmed", () => {
    render(<MorePage />);
    openDeleteSheet();
    expect(deleteMock).not.toHaveBeenCalled();
  });

  it("deletes the account then signs out", async () => {
    render(<MorePage />);
    openDeleteSheet();
    fireEvent.click(screen.getByRole("button", { name: "確認刪除" }));

    expect(deleteMock).toHaveBeenCalledWith("/account");
    await waitFor(() => expect(signOutMock).toHaveBeenCalledWith({ redirectUrl: "/welcome" }));
  });

  it("keeps the sheet open and surfaces the error when deletion fails", async () => {
    deleteMock.mockResolvedValue({
      success: false,
      error: { code: "INTERNAL", message: "刪除失敗，請稍後再試" },
    });
    render(<MorePage />);
    openDeleteSheet();
    fireEvent.click(screen.getByRole("button", { name: "確認刪除" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("刪除失敗，請稍後再試");
    // A failed delete must not sign the user out — their account still exists.
    expect(signOutMock).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "確認刪除" })).toBeInTheDocument();
  });
});
