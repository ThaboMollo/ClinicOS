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

  let body: { appointment_id?: string; access_token?: string };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { appointment_id, access_token } = body;

  if (!appointment_id || !access_token) {
    return new Response(
      JSON.stringify({ error: "appointment_id and access_token are required" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // 1. Fetch appointment and verify token
  const { data: appointment, error: apptError } = await supabase
    .from("appointments")
    .select(`
      id,
      clinic_id,
      status,
      appointment_date,
      entered_queue_at,
      consultation_started_at,
      completed_at,
      access_token,
      clinics (
        name,
        address,
        avg_consultation_minutes
      )
    `)
    .eq("id", appointment_id)
    .single();

  if (apptError || !appointment) {
    return new Response(JSON.stringify({ error: "Appointment not found" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // 2. Verify access token
  if (appointment.access_token !== access_token) {
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const clinic = appointment.clinics as {
    name: string;
    address: string | null;
    avg_consultation_minutes: number;
  };

  // 3. Compute queue position (only meaningful when waiting)
  let position = 0;
  if (appointment.status === "waiting") {
    const { count } = await supabase
      .from("appointments")
      .select("*", { count: "exact", head: true })
      .eq("clinic_id", appointment.clinic_id)
      .eq("appointment_date", appointment.appointment_date)
      .eq("status", "waiting")
      .lt("entered_queue_at", appointment.entered_queue_at);

    position = (count ?? 0) + 1;
  }

  const estimatedWaitMinutes =
    position > 1 ? clinic.avg_consultation_minutes * (position - 1) : 0;

  // 4. Check if intake already submitted
  const { count: intakeCount } = await supabase
    .from("intake_responses")
    .select("*", { count: "exact", head: true })
    .eq("appointment_id", appointment_id);

  const intakeSubmitted = (intakeCount ?? 0) > 0;

  // 5. Fetch clinic's active intake questions (resolved with templates)
  const { data: clinicQuestions } = await supabase
    .from("clinic_intake_questions")
    .select(`
      id,
      inherit_global,
      question_text,
      question_type,
      options,
      sort_order,
      template_id,
      intake_question_templates (
        question_key,
        question_text,
        question_type,
        options
      )
    `)
    .eq("clinic_id", appointment.clinic_id)
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  type QuestionRow = {
    id: string;
    inherit_global: boolean;
    question_text: string | null;
    question_type: string | null;
    options: string[] | null;
    sort_order: number;
    template_id: string | null;
    intake_question_templates: {
      question_key: string;
      question_text: string;
      question_type: string;
      options: string[] | null;
    } | null;
  };

  const questions = (clinicQuestions as QuestionRow[] ?? []).map((q) => {
    const tmpl = q.intake_question_templates;
    return {
      id: q.id,
      question_key: tmpl?.question_key ?? q.id,
      question_text: q.inherit_global && tmpl ? tmpl.question_text : (q.question_text ?? ""),
      question_type: q.inherit_global && tmpl ? tmpl.question_type : (q.question_type ?? "text"),
      options: q.inherit_global && tmpl ? tmpl.options : q.options,
      sort_order: q.sort_order,
    };
  });

  return new Response(
    JSON.stringify({
      appointment: {
        id: appointment.id,
        status: appointment.status,
        entered_queue_at: appointment.entered_queue_at,
        consultation_started_at: appointment.consultation_started_at,
        completed_at: appointment.completed_at,
      },
      position,
      estimated_wait_minutes: estimatedWaitMinutes,
      clinic: {
        name: clinic.name,
        address: clinic.address,
      },
      intake_submitted: intakeSubmitted,
      questions,
    }),
    {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    }
  );
});
