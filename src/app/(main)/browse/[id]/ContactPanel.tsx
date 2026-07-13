import { Mail, MessageSquare, Phone } from "lucide-react";

import { CONTACT_METHODS, CONTACT_METHOD_LABELS } from "@/lib/types";
import { cn, formatPhoneDisplay } from "@/lib/utils";

import { CopyButton } from "./CopyButton";

import type { ContactMethod } from "@/lib/types";
import type { LucideIcon } from "lucide-react";

const CONTACT_MICRO_LABEL_CLASS =
  "text-[0.62rem] font-semibold uppercase tracking-[0.16em] text-[#a08a72]";
const CONTACT_PILL_CLASS =
  "inline-flex items-center gap-1.5 rounded-full border border-[#b58d5f]/70 bg-[#b3854c]/12 px-3.5 py-1.5 text-[0.64rem] font-semibold uppercase tracking-[0.12em] text-[#8a6232] transition-colors hover:bg-[#b3854c]/20";

const CONTACT_METHOD_ICONS: Record<ContactMethod, LucideIcon> = {
  call: Phone,
  text: MessageSquare,
};
const CONTACT_METHOD_HREF: Record<ContactMethod, (phone: string) => string> = {
  call: (phone) => `tel:${phone}`,
  text: (phone) => `sms:${phone}`,
};

type ContactAction = {
  href: string;
  label: string;
  icon: LucideIcon;
};

function ContactActionLink({
  href,
  label,
  icon: Icon,
  sold,
}: ContactAction & { sold: boolean }) {
  return (
    <a
      href={sold ? undefined : href}
      aria-disabled={sold || undefined}
      tabIndex={sold ? -1 : undefined}
      aria-label={`${label} the seller`}
      className={cn(
        CONTACT_PILL_CLASS,
        sold && "pointer-events-none opacity-40 grayscale",
      )}
    >
      <Icon className="size-3.5 shrink-0" aria-hidden="true" />
      {label}
    </a>
  );
}

type ContactChannelProps = {
  icon: LucideIcon;
  label: string;
  value: string;
  copyLabel: string;
  actions: ContactAction[];
  sold: boolean;
};

function ContactChannel({
  icon: Icon,
  label,
  value,
  copyLabel,
  actions,
  sold,
}: ContactChannelProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
      <div className="flex min-w-0 items-center gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full border border-[#e7dccb] bg-[#fff9f0] text-[#8a6232]">
          <Icon className="size-4" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className={CONTACT_MICRO_LABEL_CLASS}>{label}</p>
          {!sold && (
            <div className="flex min-w-0 items-center gap-2">
              <p className="min-w-0 truncate text-sm font-medium text-[#3f3025]">
                {value}
              </p>
              <CopyButton value={value} label={copyLabel} />
            </div>
          )}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {actions.map((action) => (
          <ContactActionLink key={action.label} {...action} sold={sold} />
        ))}
      </div>
    </div>
  );
}

type ContactPanelProps = {
  contactEmail: string | null;
  contactPhone: string | null;
  contactMethods: ContactMethod[];
  sold: boolean;
};

export function ContactPanel({
  contactEmail,
  contactPhone,
  contactMethods,
  sold,
}: ContactPanelProps) {
  const selectedMethods = CONTACT_METHODS.filter((method) =>
    contactMethods.includes(method),
  );
  // No declared methods → default to a single call action (the prior behavior).
  const phoneMethods: ContactMethod[] =
    selectedMethods.length > 0 ? selectedMethods : ["call"];

  return (
    <div className="surface-panel hairline flex flex-col gap-4 rounded-2xl p-5">
      <p className="text-[0.62rem] font-semibold uppercase tracking-[0.18em] text-[#a08a72]">
        {sold ? "No longer available" : "Contact the Seller"}
      </p>

      {contactEmail && (
        <ContactChannel
          icon={Mail}
          label="Email"
          value={contactEmail}
          copyLabel="Copy email address"
          actions={[
            { href: `mailto:${contactEmail}`, label: "Email", icon: Mail },
          ]}
          sold={sold}
        />
      )}

      {contactEmail && contactPhone && <div className="soft-divider" />}

      {contactPhone && (
        <ContactChannel
          icon={Phone}
          label="Phone"
          value={formatPhoneDisplay(contactPhone)}
          copyLabel="Copy phone number"
          actions={phoneMethods.map((method) => ({
            href: CONTACT_METHOD_HREF[method](contactPhone),
            label: CONTACT_METHOD_LABELS[method],
            icon: CONTACT_METHOD_ICONS[method],
          }))}
          sold={sold}
        />
      )}
    </div>
  );
}
