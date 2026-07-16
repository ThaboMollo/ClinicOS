import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  let body: { clinic_slug?: string; name?: string; phone?: string };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { clinic_slug, name } = body;
  // Normalize so "082 123 4567" and "0821234567" match the same patient
  const phone = body.phone?.replace(/[^\d+]/g, "");

  if (!clinic_slug || !name?.trim() || !phone) {
    return new Response(
      JSON.stringify({ error: "clinic_slug, name, and phone are required" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // 1. Look up clinic by slug
  const { data: clinic, error: clinicError } = await supabase
    .from("clinics")
    .select("id, name, slug")
    .eq("slug", clinic_slug)
    .single();

  if (clinicError || !clinic) {
    return new Response(JSON.stringify({ error: "Clinic not found" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // 1b. Per-IP rate limit: 20 joins/hour, counted from queue_joined events (§6.1)
  const clientIp =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

  const { count: ipJoins } = await supabase
    .from("appointment_events")
    .select("*", { count: "exact", head: true })
    .eq("event_type", "queue_joined")
    .eq("metadata->>ip", clientIp)
    .gt("created_at", oneHourAgo);

  if ((ipJoins ?? 0) >= 20) {
    return new Response(
      JSON.stringify({ error: "Too many requests. Please try again later." }),
      { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // 2. Find or create patient by (clinic_id, phone)
  let patientId: string;
  const { data: existingPatient } = await supabase
    .from("patients")
    .select("id")
    .eq("clinic_id", clinic.id)
    .eq("phone", phone)
    .single();

  if (existingPatient) {
    patientId = existingPatient.id;
    // Update name in case it changed
    await supabase
      .from("patients")
      .update({ name: name.trim() })
      .eq("id", patientId);
  } else {
    const { data: newPatient, error: createPatientError } = await supabase
      .from("patients")
      .insert({ clinic_id: clinic.id, name: name.trim(), phone })
      .select("id")
      .single();

    if (createPatientError || !newPatient) {
      return new Response(JSON.stringify({ error: "Failed to create patient" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    patientId = newPatient.id;
  }

  const today = new Date().toISOString().split("T")[0];

  // 3. Check for an active appointment today (waiting or in_consultation)
  const { data: activeAppointment } = await supabase
    .from("appointments")
    .select("id, access_token, status, entered_queue_at")
    .eq("clinic_id", clinic.id)
    .eq("patient_id", patientId)
    .eq("appointment_date", today)
    .in("status", ["waiting", "in_consultation"])
    .order("entered_queue_at", { ascending: false })
    .limit(1)
    .single();

  let appointmentId: string;
  let accessToken: string;
  let isReconnect: boolean;
  let enteredQueueAt: string;

  if (activeAppointment) {
    // Reconnect to existing appointment
    appointmentId = activeAppointment.id;
    accessToken = activeAppointment.access_token;
    enteredQueueAt = activeAppointment.entered_queue_at;
    isReconnect = true;
  } else {
    // Per-phone rate limit: 3 new appointments/hour (§6.1) — reconnects above
    // never reach this, so a patient re-scanning the QR is unaffected
    const { count: recentJoins } = await supabase
      .from("appointments")
      .select("*", { count: "exact", head: true })
      .eq("patient_id", patientId)
      .gt("created_at", oneHourAgo);

    if ((recentJoins ?? 0) >= 3) {
      return new Response(
        JSON.stringify({ error: "Too many attempts with this phone number. Please try again later." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create a fresh appointment (previous one was done/cancelled or none existed)
    const { data: newAppointment, error: apptError } = await supabase
      .from("appointments")
      .insert({
        clinic_id: clinic.id,
        patient_id: patientId,
        status: "waiting",
        appointment_date: today,
        entered_queue_at: new Date().toISOString(),
      })
      .select("id, access_token, entered_queue_at")
      .single();

    if (apptError || !newAppointment) {
      return new Response(JSON.stringify({ error: "Failed to create appointment" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    appointmentId = newAppointment.id;
    accessToken = newAppointment.access_token;
    enteredQueueAt = newAppointment.entered_queue_at;
    isReconnect = false;

    // Log the event; the ip in metadata feeds the per-IP rate limit
    await supabase.from("appointment_events").insert({
      clinic_id: clinic.id,
      appointment_id: appointmentId,
      actor_type: "patient",
      event_type: "queue_joined",
      to_status: "waiting",
      metadata: { ip: clientIp },
    });
  }

  // 4. Compute queue position
  const { count } = await supabase
    .from("appointments")
    .select("*", { count: "exact", head: true })
    .eq("clinic_id", clinic.id)
    .eq("appointment_date", today)
    .eq("status", "waiting")
    .lt("entered_queue_at", enteredQueueAt);

  const position = (count ?? 0) + 1;

  return new Response(
    JSON.stringify({
      appointment_id: appointmentId,
      access_token: accessToken,
      clinic_name: clinic.name,
      position,
      is_reconnect: isReconnect,
    }),
    {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    }
  );
});
