import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import SignInPage from "../../app/sign-in/[[...sign-in]]/page";

const replaceMock = vi.fn();
const backMock = vi.fn();
let isSignedIn = false;

vi.mock("@clerk/nextjs", () => ({
  useAuth: () => ({ isSignedIn }),
  useClerk: () => ({
    client: { signIn: { authenticateWithRedirect: vi.fn() } },
  }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: replaceMock, back: backMock }),
}));

describe("Sign-in Page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isSignedIn = false;
  });

  it("renders Google and LINE OAuth buttons", () => {
    render(<SignInPage />);
    expect(screen.getByRole("button", { name: /以 Google 繼續/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /以 LINE 繼續/ })).toBeInTheDocument();
  });

  it("renders a full-screen main element", () => {
    render(<SignInPage />);
    const main = screen.getByRole("main");
    expect(main).toHaveClass("min-h-[100dvh]");
  });

  it("redirects to /assets when already signed in", () => {
    isSignedIn = true;
    render(<SignInPage />);
    expect(replaceMock).toHaveBeenCalledWith("/assets");
  });
});
