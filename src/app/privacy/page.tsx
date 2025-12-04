import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy | Inner Garden Photo Queue",
  description:
    "How Inner Garden Education collects, uses, and safeguards personal information for our holiday photo experience.",
};

export default function PrivacyPage() {
  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-8 px-4 py-10 sm:px-8">
      <header className="rounded-3xl bg-gradient-to-r from-ig-forest/50 via-ig-card to-ig-card p-6 shadow-xl ring-1 ring-white/10">
        <p className="text-sm uppercase tracking-[0.3em] text-ig-gold/80">
          Privacy and Trust
        </p>
        <h1 className="mt-2 font-display text-3xl text-ig-cream sm:text-4xl">
          Privacy Policy
        </h1>
        <p className="mt-3 max-w-2xl text-ig-cream/75">
          Last updated: July 22, 2025. Inner Garden Education respects the
          privacy of parents, guardians, and children. For our full policy,
          visit{" "}
          <a
            href="https://www.innergardenedu.com/privacy-policy"
            className="text-ig-gold underline underline-offset-4"
            target="_blank"
            rel="noreferrer"
          >
            innergardenedu.com/privacy-policy
          </a>
          .
        </p>
      </header>

      <section className="card p-6 sm:p-8">
        <div className="space-y-4 text-sm text-ig-cream/80">
          <p>
            The form and data on this site are used solely to manage the Inner
            Garden Christmas 2025 photo queue and gallery delivery. We do not use
            this information for any other purpose or marketing.
          </p>
          <p>
            For details on collection, use, sharing, security, and your rights,
            please refer to our full Privacy Policy above. If you have questions
            or need to request access or corrections, contact our Privacy Officer
            at it@innergardenedu.com.
          </p>
        </div>
      </section>
    </div>
  );
}
