// Smoke test proving the scaffold + CI wiring works end to end.
// Real tests (auth, sync, matcher) get added alongside their modules;
// mock any Sony HTTP calls with `nock` rather than hitting real endpoints —
// see README.md "Testing" section.
const request = require("supertest");
const app = require("../src/server");

test("GET /health returns ok and confirms the DB opened", async () => {
  const res = await request(app).get("/health");
  expect(res.status).toBe(200);
  expect(res.body.status).toBe("ok");
  expect(typeof res.body.users).toBe("number");
});
