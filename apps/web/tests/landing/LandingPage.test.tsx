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

vi.mock("next/image", () => ({
  default: ({
    src,
    alt,
    width,
    height,
    ...props
  }: {
    src: string;
    alt: string;
    width: number;
    height: number;
    [key: string]: unknown;
  }) => <img src={src} alt={alt} width={width} height={height} {...props} />,
}));

describe("Landing Page", () => {
  it("renders app icon", () => {
    render(<RootPage />);
    expect(screen.getByRole("img", { name: "araS" })).toBeInTheDocument();
  });

  it("renders subtitle", () => {
    render(<RootPage />);
    expect(
      screen.getByText("當你了解日常的花費後，接下來好好的管理你的「資產」吧")
    ).toBeInTheDocument();
  });

  it("renders 登入 link pointing to /sign-in", () => {
    render(<RootPage />);
    const link = screen.getByRole("link", { name: "登入" });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "/sign-in");
  });

  it("renders 註冊 link pointing to /sign-up", () => {
    render(<RootPage />);
    const link = screen.getByRole("link", { name: "註冊" });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "/sign-up");
  });

  it("renders 訪客 link pointing to /assets", () => {
    render(<RootPage />);
    const link = screen.getByRole("link", { name: "訪客" });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "/assets");
  });
});
