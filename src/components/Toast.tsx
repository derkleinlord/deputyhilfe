import { useApp } from "../store";

export default function Toast() {
  const { toast } = useApp();
  return (
    <div className={`toast-container${toast.visible ? " visible" : ""}`}>
      <div className="toast-content">{toast.message}</div>
    </div>
  );
}
