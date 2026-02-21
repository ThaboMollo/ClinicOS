"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Card from "@/components/ui/Card";
import { joinQueue } from "@/lib/api";
import { saveSession } from "@/lib/session";
import { Users } from "lucide-react";

interface JoinQueueFormProps {
  clinicSlug: string;
  clinicName: string;
}

interface FormErrors {
  name?: string;
  phone?: string;
  general?: string;
}

function validatePhone(phone: string): boolean {
  // Accept international or local formats
  return /^[+\d\s\-()]{7,15}$/.test(phone.trim());
}

export default function JoinQueueForm({ clinicSlug, clinicName }: JoinQueueFormProps) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [errors, setErrors] = useState<FormErrors>({});
  const [loading, setLoading] = useState(false);

  function validate(): boolean {
    const errs: FormErrors = {};
    if (!name.trim()) errs.name = "Please enter your name.";
    if (!phone.trim()) {
      errs.phone = "Please enter your phone number.";
    } else if (!validatePhone(phone)) {
      errs.phone = "Please enter a valid phone number.";
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    setErrors({});

    try {
      const result = await joinQueue({
        clinic_slug: clinicSlug,
        name: name.trim(),
        phone: phone.trim(),
      });

      saveSession({
        appointmentId: result.appointment_id,
        accessToken: result.access_token,
        clinicSlug,
      });

      router.push(`/q/${result.appointment_id}`);
    } catch (err) {
      setErrors({
        general:
          err instanceof Error
            ? err.message
            : "Something went wrong. Please try again.",
      });
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-md">
      {!expanded ? (
        <Button
          size="lg"
          onClick={() => setExpanded(true)}
          className="w-full"
        >
          <Users size={18} />
          Join Queue
        </Button>
      ) : (
        <Card>
          <h2 className="text-lg font-semibold text-text-primary mb-md">
            Join the queue at {clinicName}
          </h2>

          <form onSubmit={handleSubmit} className="flex flex-col gap-md" noValidate>
            <Input
              label="Your name"
              placeholder="e.g. Thabo Dlamini"
              value={name}
              onChange={(e) => setName(e.target.value)}
              error={errors.name}
              autoComplete="name"
              autoFocus
            />
            <Input
              label="Phone number"
              type="tel"
              placeholder="e.g. 082 123 4567"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              error={errors.phone}
              autoComplete="tel"
            />

            {errors.general && (
              <p className="text-sm text-error rounded-xl bg-red-50 border border-error/20 px-4 py-3">
                {errors.general}
              </p>
            )}

            <Button
              type="submit"
              size="lg"
              loading={loading}
              className="w-full mt-sm"
            >
              {loading ? "Joining queue…" : "Join Queue"}
            </Button>

            <button
              type="button"
              onClick={() => setExpanded(false)}
              className="text-sm text-text-secondary text-center mt-1 hover:text-text-primary transition-colors"
            >
              Cancel
            </button>
          </form>
        </Card>
      )}

      <p className="text-xs text-text-secondary text-center px-md">
        Your information is only used to manage your visit. We don&apos;t share it.
      </p>
    </div>
  );
}
