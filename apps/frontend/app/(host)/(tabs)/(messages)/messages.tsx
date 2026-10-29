import { ThreadsScreen } from "../../../../components/ThreadsScreen";

// Host Messages tab: the conversation list (03 B). Chats open inside this
// tab's stack (see the shared tab-stack layout).
export default function HostMessagesScreen() {
  return <ThreadsScreen userRole="host" />;
}
