import "@testing-library/jest-dom";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { LandingButtons } from "../../app/landing-buttons";

const mockPush = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

describe("LandingButtons", () => {
  beforeEach(() => {
    mockPush.mockClear();
  });

  it("renders 登入 button", () => {
    render(<LandingButtons />);
    expect(screen.getByRole("button", { name: "登入" })).toBeInTheDocument();
  });

  it("renders 註冊 button", () => {
    render(<LandingButtons />);
    expect(screen.getByRole("button", { name: "註冊" })).toBeInTheDocument();
  });

  it("renders 訪客 button", () => {
    render(<LandingButtons />);
    expect(screen.getByRole("button", { name: "訪客" })).toBeInTheDocument();
  });

  it("navigates to /sign-in when 登入 is clicked", () => {
    render(<LandingButtons />);
    fireEvent.click(screen.getByRole("button", { name: "登入" }));
    expect(mockPush).toHaveBeenCalledWith("/sign-in");
  });

  it("navigates to /sign-up when 註冊 is clicked", () => {
    render(<LandingButtons />);
    fireEvent.click(screen.getByRole("button", { name: "註冊" }));
    expect(mockPush).toHaveBeenCalledWith("/sign-up");
  });

  it("navigates to /assets when 訪客 is clicked", () => {
    render(<LandingButtons />);
    fireEvent.click(screen.getByRole("button", { name: "訪客" }));
    expect(mockPush).toHaveBeenCalledWith("/assets");
  });

  it("disables all buttons after one is clicked", () => {
    render(<LandingButtons />);
    fireEvent.click(screen.getByRole("button", { name: "登入" }));
    screen.getAllByRole("button").forEach((btn) => expect(btn).toBeDisabled());
  });

  it("does not trigger a second navigation when buttons are disabled", () => {
    render(<LandingButtons />);
    fireEvent.click(screen.getByRole("button", { name: "登入" }));
    // All buttons are now disabled — clicking a second one must not push again
    fireEvent.click(screen.getAllByRole("button")[1]);
    expect(mockPush).toHaveBeenCalledTimes(1);
  });
});
