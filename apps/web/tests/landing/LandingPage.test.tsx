import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import RootPage from "../../app/welcome/page";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
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

  it("renders 登入 button", () => {
    render(<RootPage />);
    expect(screen.getByRole("button", { name: "登入" })).toBeInTheDocument();
  });

  it("renders 註冊 button", () => {
    render(<RootPage />);
    expect(screen.getByRole("button", { name: "註冊" })).toBeInTheDocument();
  });

  it("renders 訪客 button", () => {
    render(<RootPage />);
    expect(screen.getByRole("button", { name: "訪客" })).toBeInTheDocument();
  });
});
