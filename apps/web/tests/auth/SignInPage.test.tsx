import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import SignInPage from "../../app/sign-in/[[...sign-in]]/page";

vi.mock("@clerk/nextjs", () => ({
  SignIn: () => <div data-testid="clerk-sign-in" />,
}));

describe("Sign-in Page", () => {
  it("renders Clerk SignIn component", () => {
    render(<SignInPage />);
    expect(screen.getByTestId("clerk-sign-in")).toBeInTheDocument();
  });

  it("wraps SignIn in a full-screen centered main element", () => {
    render(<SignInPage />);
    const main = screen.getByRole("main");
    expect(main).toHaveClass("min-h-screen");
    expect(main).toHaveClass("items-center");
    expect(main).toHaveClass("justify-center");
  });
});
