import { CHAT_POLICY_PINNED_NOTICE } from "@tourpilot/shared";

export function ChatPolicyNotice() {
  return (
    <p className="chat-policy-notice" role="note">
      {CHAT_POLICY_PINNED_NOTICE}
    </p>
  );
}
