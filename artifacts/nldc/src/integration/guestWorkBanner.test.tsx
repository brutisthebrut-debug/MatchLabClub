import React from "react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";

// --- Mocks ----------------------------------------------------------------

const mockUseAuth = vi.fn();
vi.mock("@workspace/replit-auth-web", () => ({
  useAuth: () => mockUseAuth(),
}));

let mockLocation = "/dashboard";
vi.mock("wouter", () => ({
  useLocation: () => [mockLocation, vi.fn()] as const,
}));

// Import AFTER mocks are registered.
import { GuestWorkBanner } from "@/components/auth/GuestWorkBanner";
import { rememberAnonymousId } from "@/lib/anonymousIds";

const loginSpy = vi.fn();

function anonWithWork() {
  mockUseAuth.mockReturnValue({
    isAuthenticated: false,
    isLoading: false,
    login: loginSpy,
  });
  rememberAnonymousId("audits", 42);
}

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  mockUseAuth.mockReset();
  loginSpy.mockReset();
  mockLocation = "/dashboard";
});

afterEach(() => {
  cleanup();
  localStorage.clear();
  sessionStorage.clear();
});

describe("GuestWorkBanner", () => {
  it("shows for an anonymous visitor who has saved work", () => {
    anonWithWork();
    render(<GuestWorkBanner />);
    expect(screen.queryByTestId("guest-work-banner")).not.toBeNull();
    expect(screen.queryByTestId("button-guest-banner-signin")).not.toBeNull();
  });

  it("calls login() when the sign-in button is clicked", () => {
    anonWithWork();
    render(<GuestWorkBanner />);
    fireEvent.click(screen.getByTestId("button-guest-banner-signin"));
    expect(loginSpy).toHaveBeenCalledTimes(1);
  });

  it("hides for an authenticated user even if local work exists", () => {
    rememberAnonymousId("audits", 42);
    mockUseAuth.mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
      login: loginSpy,
    });
    render(<GuestWorkBanner />);
    expect(screen.queryByTestId("guest-work-banner")).toBeNull();
  });

  it("hides for an anonymous visitor with no saved work", () => {
    mockUseAuth.mockReturnValue({
      isAuthenticated: false,
      isLoading: false,
      login: loginSpy,
    });
    render(<GuestWorkBanner />);
    expect(screen.queryByTestId("guest-work-banner")).toBeNull();
  });

  it("hides while auth state is still loading", () => {
    rememberAnonymousId("audits", 42);
    mockUseAuth.mockReturnValue({
      isAuthenticated: false,
      isLoading: true,
      login: loginSpy,
    });
    render(<GuestWorkBanner />);
    expect(screen.queryByTestId("guest-work-banner")).toBeNull();
  });

  it("stays out of the way on the checkout flow", () => {
    anonWithWork();
    mockLocation = "/checkout/dating-reset";
    render(<GuestWorkBanner />);
    expect(screen.queryByTestId("guest-work-banner")).toBeNull();
  });

  it("dismisses and persists the dismissal for the session", () => {
    anonWithWork();
    const { unmount } = render(<GuestWorkBanner />);
    fireEvent.click(screen.getByTestId("button-guest-banner-dismiss"));
    expect(screen.queryByTestId("guest-work-banner")).toBeNull();

    // A fresh mount in the same session stays hidden.
    unmount();
    render(<GuestWorkBanner />);
    expect(screen.queryByTestId("guest-work-banner")).toBeNull();
  });
});
