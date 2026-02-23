"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface Props {
  clinicId: string;
  userId: string;
  today: string;
  waitingCount: number;
  onClose: () => void;
  onSuccess: (message: string) => void;
}

export default function AddWalkInModal({
  clinicId,
  userId,
  today,
  waitingCount,
  onClose,
  onSuccess,
}: Props) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [dob, setDob] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();

    // 1. Find or create patient
    let patientId: string;

    const { data: existingPatient } = await supabase
      .from("patients")
      .select("id")
      .eq("clinic_id", clinicId)
      .eq("phone", phone)
      .maybeSingle();

    if (existingPatient) {
      patientId = existingPatient.id;
    } else {
      const { data: newPatient, error: patientError } = await supabase
        .from("patients")
        .insert({
          clinic_id: clinicId,
          name,
          phone,
          email: email || null,
          dob: dob || null,
        })
        .select("id")
        .single();

      if (patientError || !newPatient) {
        setError(patientError?.message ?? "Failed to create patient.");
        setLoading(false);
        return;
      }
      patientId = newPatient.id;
    }

    // 2. Check for active appointment today
    const { data: activeAppt } = await supabase
      .from("appointments")
      .select("id, status")
      .eq("clinic_id", clinicId)
      .eq("patient_id", patientId)
      .eq("appointment_date", today)
      .in("status", ["waiting", "in_consultation"])
      .maybeSingle();

    if (activeAppt) {
      setError("This patient is already active in today's queue.");
      setLoading(false);
      return;
    }

    // 3. Insert appointment
    const { data: appt, error: apptError } = await supabase
      .from("appointments")
      .insert({
        clinic_id: clinicId,
        patient_id: patientId,
        status: "waiting",
        appointment_date: today,
      })
      .select("id")
      .single();

    if (apptError || !appt) {
      setError(apptError?.message ?? "Failed to create appointment.");
      setLoading(false);
      return;
    }

    // 4. Audit event
    await supabase.from("appointment_events").insert({
      clinic_id: clinicId,
      appointment_id: appt.id,
      actor_type: "staff",
      actor_user_id: userId,
      event_type: "queue_joined",
      from_status: null,
      to_status: "waiting",
    });

    onSuccess(`Added to queue — position #${waitingCount + 1}`);
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E2E8F0]">
          <h2 className="text-lg font-bold text-[#0F172A]">Add Walk-In</h2>
          <button
            onClick={onClose}
            className="p-2 text-[#475569] hover:text-[#0F172A] transition-colors rounded-lg"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-[#0F172A] mb-1">
              Full name <span className="text-[#EF4444]">*</span>
            </label>
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg border border-[#E2E8F0] text-sm focus:outline-none focus:ring-2 focus:ring-[#0B5AA8]"
              placeholder="Patient name"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[#0F172A] mb-1">
              Phone <span className="text-[#EF4444]">*</span>
            </label>
            <input
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg border border-[#E2E8F0] text-sm focus:outline-none focus:ring-2 focus:ring-[#0B5AA8]"
              placeholder="+27 82 000 0000"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[#0F172A] mb-1">
              Email <span className="text-[#475569] font-normal">(optional)</span>
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg border border-[#E2E8F0] text-sm focus:outline-none focus:ring-2 focus:ring-[#0B5AA8]"
              placeholder="patient@email.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[#0F172A] mb-1">
              Date of birth <span className="text-[#475569] font-normal">(optional)</span>
            </label>
            <input
              type="date"
              value={dob}
              onChange={(e) => setDob(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg border border-[#E2E8F0] text-sm focus:outline-none focus:ring-2 focus:ring-[#0B5AA8]"
            />
          </div>

          {error && (
            <p className="text-sm text-[#EF4444] bg-red-50 px-3 py-2 rounded-lg">
              {error}
            </p>
          )}

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 border border-[#E2E8F0] rounded-lg text-sm font-medium text-[#475569] hover:bg-[#F7FAFC] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !name || !phone}
              className="flex-1 bg-[#0B5AA8] hover:bg-[#083E78] text-white font-medium py-2.5 rounded-lg transition-colors disabled:opacity-50 text-sm"
            >
              {loading ? "Adding…" : "Add to Queue"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
