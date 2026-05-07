import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import RootPage from "../../app/page";

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    className,
  }: {
    href: string;
    children: React.ReactNode;
    className?: string;
  }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

describe("Landing Page", () => {
  it("renders app name", () => {
    render(<RootPage />);
    expect(screen.getByRole("heading", { name: "araS" })).toBeInTheDocument();
  });

  it("renders subtitle", () => {
    render(<RootPage />);
    expect(screen.getByText("個人財務管理工具")).toBeInTheDocument();
  });

  it("renders 登入 link", () => {
    render(<RootPage />);
    expect(screen.getByRole("link", { name: "登入" })).toBeInTheDocument();
  });

  it("renders 註冊 link", () => {
    render(<RootPage />);
    expect(screen.getByRole("link", { name: "註冊" })).toBeInTheDocument();
  });

  it("renders 訪客瀏覽 link pointing to /assets", () => {
    render(<RootPage />);
    const link = screen.getByRole("link", { name: "訪客瀏覽" });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "/assets");
  });
});
