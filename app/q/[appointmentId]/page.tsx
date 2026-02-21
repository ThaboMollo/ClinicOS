"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { RefreshCw, WifiOff, ClipboardList, CheckCircle2, Stethoscope } from "lucide-react";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Spinner from "@/components/ui/Spinner";
import { getAppointment } from "@/lib/api";
import { loadSession } from "@/lib/session";
import type { AppointmentView, AppointmentStatus } from "@/lib/supabase/types";

const POLL_INTERVAL_MS = 7000;

export default function QueueViewPage() {
  const params = useParams();
  const router = useRouter();
  const appointmentId = params.appointmentId as string;

  const [data, setData] = useState<AppointmentView | null>(null);
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const sessionRef = useRef(loadSession());
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchData = useCallback(
    async (isManual = false) => {
      const session = sessionRef.current;
      if (!session || session.appointmentId !== appointmentId) {
        router.push("/");
        return;
      }

      if (isManual) setRefreshing(true);

      try {
        const result = await getAppointment({
          appointment_id: session.appointmentId,
          access_token: session.accessToken,
        });
        setData(result);
        setOffline(false);
        setLastUpdated(new Date());
      } catch {
        setOffline(true);
      } finally {
        setLoading(false);
        if (isManual) setRefreshing(false);
      }
    },
    [appointmentId, router]
  );

  useEffect(() => {
    // Validate session first
    const session = loadSession();
    sessionRef.current = session;

    if (!session || session.appointmentId !== appointmentId) {
      router.push("/");
      return;
    }

    fetchData();
    pollRef.current = setInterval(() => fetchData(), POLL_INTERVAL_MS);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [appointmentId, fetchData, router]);

  // Stop polling when terminal status reached
  useEffect(() => {
    if (
      data?.appointment.status === "done" ||
      data?.appointment.status === "cancelled"
    ) {
      if (pollRef.current) clearInterval(pollRef.current);
    }
  }, [data?.appointment.status]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Spinner size={32} />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen px-md text-center">
        <WifiOff size={32} className="text-text-secondary mb-md" />
        <p className="text-text-primary font-semibold">Unable to load your queue position</p>
        <p className="text-text-secondary text-sm mt-sm">Check your connection and try again.</p>
        <Button
          variant="secondary"
          className="mt-lg"
          onClick={() => fetchData(true)}
          loading={refreshing}
        >
          Try again
        </Button>
      </div>
    );
  }

  const { appointment, position, estimated_wait_minutes, clinic, intake_submitted } = data;
  const status = appointment.status as AppointmentStatus;
  const session = sessionRef.current!;

  return (
    <div className="flex flex-col min-h-screen">
      {/* Offline banner */}
      {offline && (
        <div className="bg-warning/10 border-b border-warning/30 px-md py-2 flex items-center gap-2">
          <WifiOff size={14} className="text-warning shrink-0" />
          <span className="text-xs text-amber-700">Unable to connect — retrying…</span>
        </div>
      )}

      {/* Header */}
      <header className="flex items-center justify-between px-md py-md border-b border-border">
        <div>
          <p className="text-xs text-text-secondary">Your visit at</p>
          <h1 className="text-base font-semibold text-text-primary leading-tight">
            {clinic.name}
          </h1>
        </div>
        <button
          onClick={() => fetchData(true)}
          disabled={refreshing}
          aria-label="Refresh"
          className="p-2 rounded-lg text-text-secondary hover:text-primary hover:bg-blue-50 transition-colors"
        >
          <RefreshCw size={18} className={refreshing ? "animate-spin" : ""} />
        </button>
      </header>

      {/* Main content */}
      <div className="flex flex-col flex-1 px-md py-lg gap-lg">
        <StatusCard
          status={status}
          position={position}
          estimatedWaitMinutes={estimated_wait_minutes}
        />

        {/* Intake prompt */}
        {status === "waiting" && !intake_submitted && (
          <Link
            href={`/q/${appointmentId}/intake`}
            className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-md hover:border-primary/40 hover:bg-blue-50/30 transition-colors"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 shrink-0">
              <ClipboardList size={20} className="text-primary" />
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-text-primary">Complete quick intake</p>
              <p className="text-xs text-text-secondary">Help the doctor prepare for your visit</p>
            </div>
            <span className="text-xs font-medium text-primary">Start →</span>
          </Link>
        )}

        {/* Intake done indicator */}
        {intake_submitted && status === "waiting" && (
          <div className="flex items-center gap-3 rounded-2xl border border-accent/30 bg-emerald-50/40 p-md">
            <CheckCircle2 size={20} className="text-accent shrink-0" />
            <p className="text-sm text-accent-dark font-medium">Intake submitted</p>
          </div>
        )}

        {/* Last updated */}
        {lastUpdated && !offline && (
          <p className="text-xs text-text-secondary text-center">
            Updated {formatRelativeTime(lastUpdated)}
          </p>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────
// Status-specific card
// ─────────────────────────────────────────
interface StatusCardProps {
  status: AppointmentStatus;
  position: number;
  estimatedWaitMinutes: number;
}

function StatusCard({ status, position, estimatedWaitMinutes }: StatusCardProps) {
  if (status === "waiting") {
    return (
      <div className="rounded-2xl border border-border bg-surface p-lg text-center">
        <Badge status="waiting" />
        <div className="mt-lg">
          <p className="text-5xl font-bold text-text-primary">#{position}</p>
          <p className="text-text-secondary mt-sm text-sm">
            {position === 1 ? "You're next in line" : `in line`}
          </p>
        </div>
        {estimatedWaitMinutes > 0 && (
          <div className="mt-lg border-t border-border pt-md">
            <p className="text-xs text-text-secondary uppercase tracking-wider">
              Estimated wait
            </p>
            <p className="text-xl font-semibold text-text-primary mt-xs">
              ~{estimatedWaitMinutes} min
            </p>
            <p className="text-xs text-text-secondary mt-xs">
              This is an estimate only — actual times may vary
            </p>
          </div>
        )}
      </div>
    );
  }

  if (status === "in_consultation") {
    return (
      <div className="rounded-2xl border border-accent/30 bg-emerald-50/40 p-lg text-center">
        <Badge status="in_consultation" />
        <div className="mt-lg flex flex-col items-center gap-md">
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-accent/10">
            <Stethoscope size={32} className="text-accent" />
          </span>
          <div>
            <p className="text-lg font-semibold text-accent-dark">You&apos;re being seen now</p>
            <p className="text-sm text-text-secondary mt-xs">Please make your way to the consultation room</p>
          </div>
        </div>
      </div>
    );
  }

  if (status === "done") {
    return (
      <div className="rounded-2xl border border-accent/30 bg-emerald-50/40 p-lg text-center">
        <Badge status="done" />
        <div className="mt-lg flex flex-col items-center gap-md">
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-accent/10">
            <CheckCircle2 size={32} className="text-accent" />
          </span>
          <div>
            <p className="text-lg font-semibold text-accent-dark">Visit complete</p>
            <p className="text-sm text-text-secondary mt-xs">Thank you for visiting. Take care!</p>
          </div>
        </div>
      </div>
    );
  }

  if (status === "cancelled") {
    return (
      <div className="rounded-2xl border border-border bg-surface p-lg text-center">
        <Badge status="cancelled" />
        <p className="text-sm text-text-secondary mt-md">
          This appointment was cancelled. Please speak to reception if you need assistance.
        </p>
      </div>
    );
  }

  return null;
}

// ─────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────
function formatRelativeTime(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 10) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  return `${Math.floor(seconds / 60)}m ago`;
}
