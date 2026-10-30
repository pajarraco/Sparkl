import type { SolutionProposal, SolutionVote } from "@sparkl/shared";
import { useState } from "react";
import { AssistantChat } from "../../../components/AssistantChat";
import { PostJobForm } from "../../../components/PostJobForm";
import { Screen } from "../../../components/Screen";
import { SparklButton } from "../../../components/SparklButton";
import { sparklTrpc } from "../../../providers/app-providers";
import { getStrings } from "../../../providers/i18n";
import {
  type AssistantState,
  type PostJobFormValues,
  abandonedFinishInput,
  applyTurnOutput,
  assistantErrorMessage,
  buildTurnInput,
  choosePlace,
  createAssistantState,
  deviceTimeZone,
  draftToFormValues,
  newSessionId,
  postedFinishInput,
  recordVote,
  withUserMessage,
} from "../../../providers/job-assistant";

// Post tab (02 plan): the assistant chat by default, the Post Job form on
// "Review" / "Use the form instead". The assistant state lives here so the
// host can go back and forth without losing the draft, and the form is
// re-mounted (formKey) with the latest draft each time it opens. When the
// model is down the host just uses the form; nothing is lost.

type Mode = "assistant" | "form";

export default function HostPostScreen() {
  const strings = getStrings();
  const turn = sparklTrpc.jobAssistant.turn.useMutation();
  const feedback = sparklTrpc.jobAssistant.feedback.useMutation();
  const finish = sparklTrpc.jobAssistant.finish.useMutation();
  const [mode, setMode] = useState<Mode>("assistant");
  const [assistant, setAssistant] = useState<AssistantState>(() =>
    createAssistantState(newSessionId()),
  );
  const [error, setError] = useState<string | null>(null);
  const [formKey, setFormKey] = useState(0);

  async function handleSend(text: string): Promise<void> {
    const next = withUserMessage(assistant, text);
    setAssistant(next);
    setError(null);
    try {
      const output = await turn.mutateAsync(
        buildTurnInput(next, deviceTimeZone()),
      );
      setAssistant((current) =>
        current.sessionId === next.sessionId
          ? applyTurnOutput(current, output)
          : current,
      );
    } catch (err) {
      setError(assistantErrorMessage(err));
    }
  }

  function openForm(): void {
    setFormKey((key) => key + 1);
    setMode("form");
  }

  // A chip tap is a vote at once. The chips stay if the vote fails.
  async function handleVote(
    proposal: SolutionProposal,
    vote: SolutionVote,
  ): Promise<void> {
    setError(null);
    try {
      await feedback.mutateAsync({
        sessionId: assistant.sessionId,
        proposalId: proposal.id,
        vote,
      });
      setAssistant((current) => recordVote(current, proposal.id, vote));
    } catch (err) {
      setError(assistantErrorMessage(err));
    }
  }

  // Closes the session with the posted job. Best effort: the job is saved
  // whatever happens to the learning record.
  function handlePosted(jobId: string, values: PostJobFormValues): void {
    finish
      .mutateAsync(postedFinishInput(assistant, jobId, values))
      .catch(() => undefined);
    // The session is closed now, so its chips can no longer be answered.
    setAssistant((current) => ({ ...current, proposals: [] }));
  }

  // A discarded session closes as abandoned, which takes no votes. After a
  // post the session is already closed, so the caller passes abandon=false.
  function startOver({ abandon }: { abandon: boolean }): void {
    if (abandon && assistant.messages.length > 0) {
      finish
        .mutateAsync(abandonedFinishInput(assistant))
        .catch(() => undefined);
    }
    setAssistant(createAssistantState(newSessionId()));
    setError(null);
  }

  if (mode === "form") {
    return (
      <Screen testID="host-post-screen" title={strings.postJob.title}>
        <SparklButton
          accessibilityLabel={strings.assistant.backToAssistant}
          onPress={() => setMode("assistant")}
          testID="post-back-to-assistant"
          title={strings.assistant.backToAssistant}
          variant="secondary"
        />
        <PostJobForm
          initialValues={draftToFormValues(assistant.draft)}
          key={formKey}
          onPosted={handlePosted}
          onPostAgain={() => {
            startOver({ abandon: false });
            openForm();
          }}
        />
      </Screen>
    );
  }

  return (
    <Screen testID="host-post-screen" title={strings.postJob.title}>
      <AssistantChat
        error={error}
        onChoosePlace={(place) =>
          setAssistant((current) => choosePlace(current, place))
        }
        onReview={openForm}
        onSend={(text) => {
          void handleSend(text);
        }}
        onStartOver={() => startOver({ abandon: true })}
        onVote={(proposal, vote) => {
          void handleVote(proposal, vote);
        }}
        pending={turn.isPending}
        state={assistant}
      />
    </Screen>
  );
}
