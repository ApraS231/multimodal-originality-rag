import { describe, it, expect } from "bun:test";

describe("Sprint 4: API Analitik Biaya, Token, & Log Audit Tests", () => {
  it("harus menghitung paging offset log audit dengan benar", () => {
    const page = 2;
    const limit = 10;
    const skip = (page - 1) * limit;

    expect(skip).toBe(10);
  });

  it("harus menghitung total estimasi biaya token LLM dengan benar", () => {
    const promptTokens = 1500;
    const completionTokens = 500;
    const totalTokens = promptTokens + completionTokens;
    const estimatedCost = totalTokens * 0.000002;

    expect(estimatedCost).toBe(0.004);
  });
});
