"use client";

import { FormEvent, useEffect, useState } from "react";
import { signIn } from "next-auth/react";

const quranVerses = [
  {
    text: "Indeed, Allah is with the patient.",
    reference: "Surah Al-Baqarah 2:153, Sahih International",
  },
  {
    text: "So remember Me; I will remember you.",
    reference: "Surah Al-Baqarah 2:152, Sahih International",
  },
  {
    text: "And whoever relies upon Allah - then He is sufficient for him.",
    reference: "Surah At-Talaq 65:3, Sahih International",
  },
  {
    text: "Indeed, with hardship will be ease.",
    reference: "Surah Ash-Sharh 94:6, Sahih International",
  },
  {
    text: "And Allah is the best of providers.",
    reference: "Surah Al-Jumu'ah 62:11, Sahih International",
  },
  {
    text: "And your Lord is going to give you, and you will be satisfied.",
    reference: "Surah Ad-Duhaa 93:5, Sahih International",
  },
  {
    text: "So be patient. Indeed, the promise of Allah is truth.",
    reference: "Surah Ar-Rum 30:60, Sahih International",
  },
  {
    text: "Unquestionably, by the remembrance of Allah hearts are assured.",
    reference: "Surah Ar-Ra'd 13:28, Sahih International",
  },
  {
    text: "And He found you lost and guided you.",
    reference: "Surah Ad-Duhaa 93:7, Sahih International",
  },
  {
    text: "And Allah loves the doers of good.",
    reference: "Surah Aal-E-Imran 3:134, Sahih International",
  },
  {
    text: "Our Lord, accept from us. Indeed You are the Hearing, the Knowing.",
    reference: "Surah Al-Baqarah 2:127, Sahih International",
  },
  {
    text: "My success is not but through Allah.",
    reference: "Surah Hud 11:88, Sahih International",
  },
];

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [roleOptions, setRoleOptions] = useState<
    { role: string; label: string }[]
  >([]);
  const [verse, setVerse] = useState(quranVerses[0]);

  useEffect(() => {
    setIsMounted(true);
    setVerse(quranVerses[Math.floor(Math.random() * quranVerses.length)]);
  }, []);

  function resetLoginState() {
    setError("");
    setRoleOptions([]);
  }

  function getSafeRoles(data: unknown) {
    if (!data || typeof data !== "object" || !("roles" in data)) {
      return [];
    }

    const roles = (data as { roles?: unknown }).roles;

    if (!Array.isArray(roles)) {
      return [];
    }

    return roles
      .filter((role): role is { role: string; label: string } => {
        if (!role || typeof role !== "object") {
          return false;
        }

        const option = role as { role?: unknown; label?: unknown };

        return (
          typeof option.role === "string" &&
          typeof option.label === "string"
        );
      })
      .filter((option) =>
        ["superadmin", "admin", "manager", "member"].includes(option.role)
      );
  }

  async function completeSignIn(role?: string) {
    setError("");
    setIsSubmitting(true);

    try {
      const result = await signIn("credentials", {
        email,
        password,
        role,
        redirect: false,
        callbackUrl: "/",
      });

      if (!result || result.error) {
        setRoleOptions([]);
        setError("Invalid email or password.");
        return;
      }

      if (typeof window !== "undefined") {
        window.location.href = result.url ?? "/";
      }
    } catch {
      setRoleOptions([]);
      setError("Unable to sign in right now. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    resetLoginState();
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/auth/role-options", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        setError("Unable to check login options. Please try again.");
        return;
      }

      const contentType = response.headers.get("content-type") ?? "";
      const data = contentType.includes("application/json")
        ? ((await response.json()) as unknown)
        : null;
      const roles = getSafeRoles(data);

      if (roles.length === 0) {
        setError("Invalid email or password.");
        return;
      }

      if (roles.length === 1) {
        await completeSignIn(roles[0].role);
        return;
      }

      setRoleOptions(roles);
    } catch {
      setRoleOptions([]);
      setError("Unable to check login options. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#F8F7FB] px-4 py-10">
      <form
        onSubmit={handleSubmit}
        className="flex w-full max-w-md flex-col gap-5 rounded-lg border border-[#E5E7EB] bg-white p-6 shadow-sm sm:p-8"
      >
        <div className="text-center">
          <p className="text-sm font-medium uppercase text-[#770FC2]">
            Digiart Creation
          </p>
          <h1 className="mt-2 text-2xl font-semibold text-[#1F2937]">
            Welcome back to Digiart Creation Office Space
          </h1>
        </div>

        <label className="flex flex-col gap-2">
          <span className="text-sm font-medium text-[#1F2937]">Email</span>
          <input
            className="rounded-md border border-[#E5E7EB] px-3 py-2"
            name="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => {
              setEmail(event.target.value);
              resetLoginState();
            }}
            required
          />
        </label>

        <label className="flex flex-col gap-2">
          <span className="text-sm font-medium text-[#1F2937]">Password</span>
          <input
            className="rounded-md border border-[#E5E7EB] px-3 py-2"
            name="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => {
              setPassword(event.target.value);
              resetLoginState();
            }}
            required
          />
        </label>

        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        {roleOptions.length > 1 ? (
          <div className="grid gap-2 rounded-md border border-[#E5E7EB] bg-[#F8F7FB] p-3">
            <p className="text-sm font-medium text-[#1F2937]">
              Select workspace
            </p>
            {roleOptions.map((option) => (
              <button
                key={option.role}
                type="button"
                onClick={() => completeSignIn(option.role)}
                disabled={isSubmitting}
                className="rounded-md border border-[#A05DD0]/40 bg-white px-3 py-2 text-left text-sm font-medium text-[#770FC2] transition hover:bg-[#F3E8FF]"
              >
                {option.label}
              </button>
            ))}
          </div>
        ) : null}

        <blockquote className="rounded-md border border-[#E5E7EB] bg-[#F8F7FB] p-4 text-sm leading-6 text-[#4B5563]">
          <p>&quot;{isMounted ? verse.text : quranVerses[0].text}&quot;</p>
          <footer className="mt-2 text-xs font-medium text-[#770FC2]">
            - {isMounted ? verse.reference : quranVerses[0].reference}
          </footer>
        </blockquote>

        <button
          className="rounded-md bg-[#770FC2] px-4 py-2 font-medium text-white transition hover:bg-[#6B1BBD] disabled:opacity-60"
          type="submit"
          disabled={isSubmitting}
        >
          {isSubmitting ? "Signing in..." : "Sign In"}
        </button>
      </form>
    </main>
  );
}
