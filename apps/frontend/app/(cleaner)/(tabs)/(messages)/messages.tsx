import { ThreadsScreen } from "../../../../components/ThreadsScreen";

// Cleaner Messages tab: the conversation list (03 B). Chats open inside this
// tab's stack (see the shared tab-stack layout).
export default function CleanerMessagesScreen() {
  return <ThreadsScreen userRole="cleaner" />;
}
