import type { JoinQueueResponse, AppointmentView } from "./supabase/types";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;

function edgeFunctionUrl(name: string) {
  return `${SUPABASE_URL}/functions/v1/${name}`;
}

async function callEdgeFunction<T>(
  name: string,
  body: Record<string, unknown>
): Promise<T> {
  const res = await fetch(edgeFunctionUrl(name), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data?.error ?? `Request failed (${res.status})`);
  }

  return data as T;
}

export async function joinQueue(params: {
  clinic_slug: string;
  name: string;
  phone: string;
}): Promise<JoinQueueResponse> {
  return callEdgeFunction<JoinQueueResponse>("join-queue", params);
}

export async function getAppointment(params: {
  appointment_id: string;
  access_token: string;
}): Promise<AppointmentView> {
  return callEdgeFunction<AppointmentView>("get-appointment", params);
}

export async function submitIntake(params: {
  appointment_id: string;
  access_token: string;
  answers: {
    question_id: string;
    question_key: string;
    question_text: string;
    answer: string;
  }[];
}): Promise<void> {
  await callEdgeFunction("submit-intake", params);
}
