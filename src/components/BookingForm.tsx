"use client";

import { useRef, useState } from "react";

export interface BookingFormValues {
  name: string;
  phone: string;
  email: string;
}

interface BookingFormProps {
  onSubmit: (values: BookingFormValues) => void;
  disabled?: boolean;
  submitLabel?: string;
}

function validate(values: BookingFormValues): Record<string, string> {
  const errors: Record<string, string> = {};

  if (!values.name.trim()) {
    errors.name = "Please enter your name.";
  }

  const digits = values.phone.replace(/\D/g, "");
  if (digits.length < 7) {
    errors.phone = "Please enter a valid phone number.";
  }

  if (values.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) {
    errors.email = "Please enter a valid email address.";
  }

  return errors;
}

export default function BookingForm({
  onSubmit,
  disabled = false,
  submitLabel = "Confirm booking",
}: BookingFormProps) {
  const [values, setValues] = useState<BookingFormValues>({
    name: "",
    phone: "",
    email: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const nameRef = useRef<HTMLInputElement>(null);
  const phoneRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const fieldRefMap: Record<keyof BookingFormValues, React.RefObject<HTMLInputElement | null>> = {
    name: nameRef,
    phone: phoneRef,
    email: emailRef,
  };

  const canSubmit =
    !disabled &&
    values.name.trim().length > 0 &&
    values.phone.replace(/\D/g, "").length >= 7;

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const nextErrors = validate(values);
    setErrors(nextErrors);
    const firstInvalid = (["name", "phone", "email"] as const).find(
      (field) => nextErrors[field],
    );
    if (firstInvalid) {
      fieldRefMap[firstInvalid].current?.focus();
      return;
    }
    onSubmit(values);
  }

  function update(field: keyof BookingFormValues, value: string) {
    setValues((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  }

  const inputClass = (field: string) =>
    [
      "w-full rounded-lg border bg-card px-4 py-3 text-base outline-none transition-colors",
      "placeholder:text-ink-soft/50 focus:border-blue focus:ring-2 focus:ring-blue/30",
      errors[field] ? "border-red-500" : "border-line",
    ].join(" ");

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
      <div>
        <label htmlFor="customer-name" className="mb-1.5 block text-sm font-medium">
          Full name
        </label>
        <input
          id="customer-name"
          ref={nameRef}
          type="text"
          autoComplete="name"
          required
          aria-required="true"
          aria-invalid={Boolean(errors.name)}
          aria-describedby={errors.name ? "customer-name-error" : undefined}
          value={values.name}
          onChange={(event) => update("name", event.target.value)}
          className={inputClass("name")}
          placeholder="Jean Smith"
        />
        {errors.name && (
          <p id="customer-name-error" className="mt-1.5 text-sm text-red-600">
            {errors.name}
          </p>
        )}
      </div>

      <div>
        <label htmlFor="customer-phone" className="mb-1.5 block text-sm font-medium">
          Phone number
        </label>
        <input
          id="customer-phone"
          ref={phoneRef}
          type="tel"
          autoComplete="tel"
          inputMode="tel"
          required
          aria-required="true"
          aria-invalid={Boolean(errors.phone)}
          aria-describedby={
            errors.phone ? "customer-phone-error" : undefined
          }
          value={values.phone}
          onChange={(event) => update("phone", event.target.value)}
          className={inputClass("phone")}
          placeholder="+230 5xxx xxxx"
        />
        <p className="mt-1.5 text-xs text-ink-soft">
          Used for booking confirmations and reminders.
        </p>
        {errors.phone && (
          <p id="customer-phone-error" className="mt-1.5 text-sm text-red-600">
            {errors.phone}
          </p>
        )}
      </div>

      <div>
        <label htmlFor="customer-email" className="mb-1.5 block text-sm font-medium">
          Email <span className="font-normal text-ink-soft">(optional)</span>
        </label>
        <input
          id="customer-email"
          ref={emailRef}
          type="email"
          autoComplete="email"
          inputMode="email"
          aria-invalid={Boolean(errors.email)}
          aria-describedby={errors.email ? "customer-email-error" : undefined}
          value={values.email}
          onChange={(event) => update("email", event.target.value)}
          className={inputClass("email")}
          placeholder="you@example.com"
        />
        {errors.email && (
          <p id="customer-email-error" className="mt-1.5 text-sm text-red-600">
            {errors.email}
          </p>
        )}
      </div>

      <button
        type="submit"
        disabled={!canSubmit}
        className="mt-2 rounded-full bg-blue px-6 py-3.5 text-base font-semibold text-white transition-colors hover:bg-blue-strong disabled:cursor-not-allowed disabled:opacity-60"
      >
        {submitLabel}
      </button>
    </form>
  );
}