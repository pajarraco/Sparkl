// Scripted model for the e2e boot (LLM_MODE=fake, 04 step 10). It steers by
// a marker in the host's last message, so the browser suite can drive the
// solution tools without a live model. resolveLlmConfig refuses fake mode
// outside test and development, so this never answers in production.
// Markers: [e2e:save] saves a clean checklist, [e2e:save-phone] tries to save
// one with a phone number, [e2e:find] looks up saved checklists.
import type { FakeLlmResponder } from "./llm.js";
import type { LlmMessage } from "./llm.js";

const REFUSED = "personal details";

export function e2eScriptedResponder(): FakeLlmResponder {
  return (request) => {
    const messages = request.messages;
    let lastUser = -1;
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i]?.role === "user") {
        lastUser = i;
        break;
      }
    }
    const text = lastUser >= 0 ? (messages[lastUser]?.content ?? "") : "";
    // What this turn did so far: tool calls and their results after the
    // host's last message.
    const turn: LlmMessage[] = messages.slice(lastUser + 1);
    const results = turn.filter(
      (m): m is Extract<LlmMessage, { role: "tool" }> => m.role === "tool",
    );

    const save = (items: string[], tags: string[]) =>
      results.length === 0
        ? {
            toolCalls: [
              {
                id: "e2e-save",
                name: "save_solution",
                arguments: JSON.stringify({
                  kind: "checklist",
                  tags,
                  payload: { items },
                }),
              },
            ],
          }
        : null;

    if (text.includes("[e2e:save-phone]")) {
      const call = save(["Call 0412 345 678 at the gate"], ["studio"]);
      if (call) return call;
      const refused = results.some((r) => r.content.includes(REFUSED));
      return {
        content: refused
          ? "[e2e:refused] I could not save that checklist."
          : "Saved.",
      };
    }
    if (text.includes("[e2e:save]")) {
      const call = save(["Mop the hall", "Dust the shelves"], ["studio"]);
      if (call) return call;
      return { content: "Saved this checklist for next time." };
    }
    if (text.includes("[e2e:find]")) {
      if (results.length === 0) {
        return {
          toolCalls: [
            {
              id: "e2e-find",
              name: "find_solutions",
              arguments: JSON.stringify({ kind: "checklist", tags: [] }),
            },
          ],
        };
      }
      return { content: "Here are the saved checklists." };
    }
    return { content: "Thanks. Tell me the address when you are ready." };
  };
}
