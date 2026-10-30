import { describe, expect, it } from "vitest";
import { e2eScriptedResponder } from "./llm-scripted.js";
import type { LlmRequest } from "./llm.js";

const respond = (request: LlmRequest) => e2eScriptedResponder()(request, 0);

const user = (content: string) => ({ role: "user" as const, content });

describe("e2eScriptedResponder", () => {
  it("asks for save_solution on the save marker", async () => {
    const result = await respond({ messages: [user("[e2e:save] checklist")] });
    expect(result.toolCalls?.[0]?.name).toBe("save_solution");
    expect(
      JSON.parse(result.toolCalls?.[0]?.arguments ?? "{}").payload.items,
    ).toHaveLength(2);
  });

  it("tries the phone number on the phone marker and reports a refusal", async () => {
    const first = await respond({ messages: [user("[e2e:save-phone]")] });
    expect(
      JSON.parse(first.toolCalls?.[0]?.arguments ?? "{}").payload.items[0],
    ).toContain("0412 345 678");

    const refused = await respond({
      messages: [
        user("[e2e:save-phone]"),
        {
          role: "assistant",
          content: "",
          toolCalls: [
            { id: "e2e-save", name: "save_solution", arguments: "{}" },
          ],
        },
        {
          role: "tool",
          toolCallId: "e2e-save",
          content: JSON.stringify({
            error: "contains personal details",
            reasons: ["phone"],
          }),
        },
      ],
    });
    expect(refused.content).toBe(
      "[e2e:refused] I could not save that checklist.",
    );
  });

  it("looks up solutions on the find marker", async () => {
    const result = await respond({ messages: [user("[e2e:find]")] });
    expect(result.toolCalls?.[0]).toMatchObject({ name: "find_solutions" });
  });

  it("answers ordinary messages in plain text", async () => {
    const result = await respond({ messages: [user("Hello there")] });
    expect(result.toolCalls).toBeUndefined();
    expect(result.content).toContain("address");
  });
});
