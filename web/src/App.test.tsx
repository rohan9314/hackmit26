import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import App, { ROUTES } from "./App";

const fetchMock = vi.fn(async (input: RequestInfo) => {
  const url = String(input);
  const empty = {
    invoices: [],
    samples: [],
    emails: [],
    bots: [],
    scenarios: [],
    briefing: [],
    operations: [],
    recent_decisions: [],
    activity: [],
    metrics: {},
    company: { company: { legal_name: "Maximor Demo Corp" } },
    buckets: {},
    payouts: [],
    tasks: [],
    weeks: [],
    events: [],
    catalog: [],
    controls: [],
    population: {},
  };
  return {
    ok: true,
    json: async () => empty,
  } as Response;
});

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

test("route table includes the operations shell", () => {
  expect(ROUTES).toEqual(
    expect.arrayContaining(["/", "/inbox", "/ap", "/ar", "/cash", "/stripe", "/close", "/forecast", "/audit", "/memory", "/agents", "/evaluations", "/scenarios", "/architecture", "/simulations", "/videos", "/workflow", "/coverage"])
  );
});

test.each(ROUTES)("renders %s without hardcoded demo success copy", async (route) => {
  render(
    <MemoryRouter initialEntries={[route]}>
      <App />
    </MemoryRouter>
  );
  expect(screen.getAllByText(/Office of the CFO/).length).toBeGreaterThan(0);
  expect(screen.queryByText("Invoice approved")).not.toBeInTheDocument();
});

test("inbox lists documents to try even when the API returns empty samples", async () => {
  render(
    <MemoryRouter initialEntries={["/inbox"]}>
      <App />
    </MemoryRouter>
  );
  expect(await screen.findByText(/Documents to try/i)).toBeInTheDocument();
  expect(screen.getAllByText(/August warehouse supplies invoice/i).length).toBeGreaterThan(0);
  expect(screen.getAllByText(/Quote for office renovation/i).length).toBeGreaterThan(0);
  expect(screen.getAllByText(/Receipt for software purchase/i).length).toBeGreaterThan(0);
  expect(screen.getAllByText(/September vendor statement/i).length).toBeGreaterThan(0);
  expect(screen.getAllByText(/Purchase order for 40 monitors/i).length).toBeGreaterThan(0);
  expect(screen.queryByText(/\[object Object\]/)).not.toBeInTheDocument();
});

test("agents page uses finance team framing", async () => {
  render(
    <MemoryRouter initialEntries={["/agents"]}>
      <App />
    </MemoryRouter>
  );
  expect(await screen.findByText(/The finance team/i)).toBeInTheDocument();
  expect(screen.queryByText("Fifteen bots")).not.toBeInTheDocument();
  expect(screen.queryByText(/43 autonomous agents/i)).not.toBeInTheDocument();
});

test("evaluations route is the evaluation lab", async () => {
  render(
    <MemoryRouter initialEntries={["/evaluations"]}>
      <App />
    </MemoryRouter>
  );
  expect(await screen.findByText(/connected finance work/i)).toBeInTheDocument();
  expect(screen.getAllByText(/Evaluation Lab/i).length).toBeGreaterThan(0);
});
