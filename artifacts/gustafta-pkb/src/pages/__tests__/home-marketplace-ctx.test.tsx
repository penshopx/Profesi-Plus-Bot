// @vitest-environment jsdom
/**
 * Marketplace course context cleanup (Task #255, regression guard for #151)
 *
 * home.tsx must clear the INTERVIEW_FROM_MARKETPLACE sessionStorage key when
 * the user abandons the new-session form (Batal or unmount) so the banner and
 * Pak Budi's course greeting never leak into a later, unrelated session — but
 * it must PRESERVE the key when a session is successfully created, because
 * chat.tsx consumes it on mount to build the marketplace greeting.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const navigateMock = vi.fn();
vi.mock("wouter", () => ({
  useLocation: () => ["/", navigateMock],
}));

const createConversationMock = vi.fn();
vi.mock("@/lib/api", () => ({
  listConversations: vi.fn().mockResolvedValue([]),
  createConversation: (...args: unknown[]) => createConversationMock(...args),
  deleteConversation: vi.fn(),
  fetchJabkerList: vi.fn().mockResolvedValue([]),
  listModels: vi.fn().mockResolvedValue({ models: [] }),
  listPersonas: vi.fn().mockResolvedValue({ personas: [], defaultPersonaId: "pak-budi" }),
  recommendPersona: vi.fn().mockResolvedValue({ personaId: "pak-budi" }),
}));

vi.mock("@/lib/api-profile", () => ({
  getMyProfile: vi.fn().mockResolvedValue(null),
  getMyPlan: vi.fn().mockResolvedValue(null),
}));

import Home from "../home";

const KEY = "INTERVIEW_FROM_MARKETPLACE";
const CTX = {
  marketplaceId: "mkt-1",
  namaMateri: "Manajemen Mutu Konstruksi",
  penyelenggara: "Diklatkerja",
  jabker: "Ahli Manajemen Konstruksi",
  isWatched: true,
};

function renderHome() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={qc}>
      <Home />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  sessionStorage.setItem(KEY, JSON.stringify(CTX));
  createConversationMock.mockResolvedValue({ id: 42 });
});

afterEach(() => {
  cleanup();
  sessionStorage.clear();
  vi.clearAllMocks();
});

describe("marketplace context cleanup in home.tsx", () => {
  it("shows the banner and clears the key + hides the banner when 'Batal' is clicked", async () => {
    const user = userEvent.setup();
    renderHome();

    // Arriving with a stored context auto-opens the form and shows the banner
    expect(screen.getByText("Konteks dari Marketplace PKB")).toBeTruthy();

    await user.click(screen.getByText("Batal"));

    expect(sessionStorage.getItem(KEY)).toBeNull();
    expect(screen.queryByText("Konteks dari Marketplace PKB")).toBeNull();
  });

  it("clears the key when the form is unmounted without submitting", async () => {
    const { unmount } = renderHome();
    expect(screen.getByText("Konteks dari Marketplace PKB")).toBeTruthy();

    unmount();

    expect(sessionStorage.getItem(KEY)).toBeNull();
  });

  it("preserves the key after successful session creation so chat.tsx can consume it", async () => {
    const user = userEvent.setup();
    const { unmount } = renderHome();

    await user.click(screen.getByTestId("mode-option-B"));
    await user.click(screen.getByTestId("button-start-session"));

    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith("/chat/42"));

    // Key survives the success handler...
    expect(sessionStorage.getItem(KEY)).toBe(JSON.stringify(CTX));

    // ...and also survives the unmount that navigation to /chat causes.
    unmount();
    expect(sessionStorage.getItem(KEY)).toBe(JSON.stringify(CTX));
  });
});
