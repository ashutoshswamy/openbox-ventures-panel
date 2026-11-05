import { CircleCheck } from "lucide-react";

export default function Done() {
  return (
    <div className="empty py-16">
      <CircleCheck />
      <p className="text-lg font-semibold">Thank you, all done.</p>
      <p className="text-sm text-muted">Your details were saved. You can close this page.</p>
    </div>
  );
}
