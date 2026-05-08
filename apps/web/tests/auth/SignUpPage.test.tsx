import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import SignUpPage from "../../app/sign-up/[[...sign-up]]/page";

vi.mock("@clerk/nextjs", () => ({
  SignUp: () => <div data-testid="clerk-sign-up" />,
}));

describe("Sign-up Page", () => {
  it("renders Clerk SignUp component", () => {
    render(<SignUpPage />);
    expect(screen.getByTestId("clerk-sign-up")).toBeInTheDocument();
  });

  it("wraps SignUp in a full-screen centered main element", () => {
    render(<SignUpPage />);
    const main = screen.getByRole("main");
    expect(main).toHaveClass("min-h-screen");
    expect(main).toHaveClass("items-center");
    expect(main).toHaveClass("justify-center");
  });
});
