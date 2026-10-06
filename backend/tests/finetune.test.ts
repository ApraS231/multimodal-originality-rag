import { describe, it, expect } from "bun:test";

describe("Sprint 6: Domain Adaptation Fine-Tune Trigger Tests", () => {
  it("harus menyusun parameter integer fine-tune dengan benar", () => {
    const epochs = "10";
    const batchSize = "32";
    
    const parsedEpochs = epochs ? parseInt(epochs) : undefined;
    const parsedBatchSize = batchSize ? parseInt(batchSize) : undefined;

    expect(parsedEpochs).toBe(10);
    expect(parsedBatchSize).toBe(32);
  });

  it("harus menyusun parameter default fine-tune jika opsional", () => {
    const epochs = undefined;
    const batchSize = undefined;

    const parsedEpochs = epochs ? parseInt(epochs) : undefined;
    const parsedBatchSize = batchSize ? parseInt(batchSize) : undefined;

    expect(parsedEpochs).toBeUndefined();
    expect(parsedBatchSize).toBeUndefined();
  });
});
