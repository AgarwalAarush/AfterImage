"use client";
import { useCallback, useEffect, useState } from "react";
import { X } from "lucide-react";
import styles from "./app-notifications.module.css";

type ToastAction = {label: string; run: () => void};

export function useAppNotifications() {
  const [message, setMessage] = useState("");
  const [toastRevision, setToastRevision] = useState(0);
  const [toastHovered, setToastHovered] = useState(false);
  const [toastFocused, setToastFocused] = useState(false);
  const [toastAction, setToastAction] = useState<{label: string; run: () => void; text: string} | undefined>();
  useEffect(() => {
    if (!message) {setToastHovered(false);setToastFocused(false);return;}
    if (toastHovered || toastFocused) return;
    const t = setTimeout(() => setMessage(""), 8000);
    return () => clearTimeout(t);
  }, [message, toastRevision, toastHovered, toastFocused]);
  const toast = useCallback((text: string, action?: ToastAction) => {
    if (action) {setToastAction({...action, text});setMessage("");}
    else {setMessage(text);setToastRevision(value => value + 1);}
  }, []);
  const clearNotifications = useCallback(() => {setMessage("");setToastAction(undefined);}, []);
  return {message, toastAction, setToastAction, setToastHovered, setToastFocused, toast, clearNotifications};
}

export function AppNotifications({ notifications, busy }: {notifications: ReturnType<typeof useAppNotifications>; busy: boolean}) {
  const {message, toastAction, setToastAction, setToastHovered, setToastFocused} = notifications;
  return <>
      {(message || toastAction) && <div className={`toast-stack ${styles.scope}`}>
        {message && <div className="toast" role="status" aria-atomic="true"
          onMouseEnter={() => setToastHovered(true)} onMouseLeave={() => setToastHovered(false)}
          onFocus={() => setToastFocused(true)} onBlur={event => {if (!event.currentTarget.contains(event.relatedTarget)) setToastFocused(false);}}>{message}</div>}
        {toastAction && <div className="toast" role="status" aria-atomic="true">
          <span>{toastAction.text}</span>
          <button className="text-button" disabled={busy} onClick={() => {toastAction.run();setToastAction(undefined);}}>{toastAction.label}</button>
          <button className="toast-dismiss" aria-label="Dismiss notification" onClick={() => {
            setToastAction(undefined);
            document.querySelector<HTMLElement>(".next-read-card .card-title, .reader-feedback summary, .shortlist-title h2")?.focus();
          }}><X size={16} aria-hidden="true"/></button>
        </div>}
      </div>}
  </>;
}
