import Link from "next/link";
import Image from "next/image";
import { MapPin, Phone, ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import type { Clinic } from "@/lib/supabase/types";
import ResumeBanner from "./ResumeBanner";

type ClinicListItem = Pick<Clinic, "id" | "name" | "slug" | "address" | "phone">;

export default async function Home() {
  const supabase = await createClient();

  const { data } = await supabase
    .from("clinics")
    .select("id, name, slug, address, phone")
    .order("name");

  const clinics = (data ?? []) as ClinicListItem[];

  return (
    <main className="mx-auto w-full max-w-5xl px-md py-lg sm:px-lg sm:py-xl">
      {/* Header */}
      <header className="flex items-center gap-3">
        <Image
          src="/icon.png"
          alt="ClinicOS"
          width={40}
          height={40}
          className="rounded-xl"
        />
        <div>
          <h1 className="text-2xl font-bold leading-tight text-text-primary">ClinicOS</h1>
          <p className="text-sm text-text-secondary">
            Find your clinic and join the queue.
          </p>
        </div>
      </header>

      <ResumeBanner />

      {/* Clinic directory */}
      {clinics.length === 0 ? (
        <p className="mt-xl text-center text-sm text-text-secondary">
          No clinics are available yet. Open your clinic&apos;s link to join the queue.
        </p>
      ) : (
        <div className="mt-lg grid grid-cols-1 gap-md sm:grid-cols-2 lg:grid-cols-3">
          {clinics.map((clinic) => (
            <Link
              key={clinic.id}
              href={`/c/${clinic.slug}`}
              className="group flex flex-col gap-sm rounded-2xl border border-border bg-surface p-md shadow-sm transition-colors hover:border-primary/40 hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-sm">
                <h2 className="text-base font-semibold leading-snug text-text-primary">
                  {clinic.name}
                </h2>
                <ChevronRight
                  size={18}
                  className="mt-0.5 shrink-0 text-text-secondary transition-colors group-hover:text-primary"
                />
              </div>

              <div className="flex flex-col gap-1">
                {clinic.address && (
                  <span className="flex items-center gap-1.5 text-sm text-text-secondary">
                    <MapPin size={14} className="shrink-0" />
                    {clinic.address}
                  </span>
                )}
                {clinic.phone && (
                  <span className="flex items-center gap-1.5 text-sm text-text-secondary">
                    <Phone size={14} className="shrink-0" />
                    {clinic.phone}
                  </span>
                )}
              </div>

              <span className="mt-auto pt-sm text-sm font-medium text-primary">
                Join the queue
              </span>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
