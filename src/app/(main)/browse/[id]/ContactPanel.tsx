import { Mail, MessageSquare, Phone } from "lucide-react";

import { BUYER_EVENTS } from "@/lib/analytics/events";
import { CONTACT_METHODS, CONTACT_METHOD_LABELS } from "@/lib/types";
import { formatPhoneDisplay } from "@/lib/utils";

import { ContactActionLink } from "./ContactActionLink";
import { CopyButton } from "./CopyButton";

import type { AnalyticsEventName, ListingContactProperties } from "@/lib/analytics/events";
import type { ContactMethod } from "@/lib/types";
import type { LucideIcon } from "lucide-react";

const CONTACT_MICRO_LABEL_CLASS =
  "text-[0.62rem] font-semibold uppercase tracking-[0.16em] text-[#a08a72]";

const CONTACT_METHOD_ICONS: Record<ContactMethod, LucideIcon> = {
  call: Phone,
  text: MessageSquare,
};
const CONTACT_METHOD_HREF: Record<ContactMethod, (phone: string) => string> = {
  call: (phone) => `tel:${phone}`,
  text: (phone) => `sms:${phone}`,
};
const CONTACT_METHOD_EVENTS: Record<ContactMethod, AnalyticsEventName> = {
  call: BUYER_EVENTS.contactCallClicked,
  text: BUYER_EVENTS.contactTextClicked,
};

type ContactAction = {
  href: string;
  label: string;
  icon: LucideIcon;
  eventName: AnalyticsEventName;
};

type ContactChannelProps = {
  icon: LucideIcon;
  label: string;
  value: string;
  copyLabel: string;
  actions: ContactAction[];
  contactProperties: ListingContactProperties;
  sold: boolean;
};

function ContactChannel({
  icon: Icon,
  label,
  value,
  copyLabel,
  actions,
  contactProperties,
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
              <CopyButton
                value={value}
                label={copyLabel}
                contactProperties={contactProperties}
              />
            </div>
          )}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {actions.map(({ href, label: actionLabel, icon: ActionIcon, eventName }) => (
          <ContactActionLink
            key={actionLabel}
            href={href}
            label={actionLabel}
            eventName={eventName}
            contactProperties={contactProperties}
            sold={sold}
          >
            <ActionIcon className="size-3.5 shrink-0" aria-hidden="true" />
          </ContactActionLink>
        ))}
      </div>
    </div>
  );
}

type ContactPanelProps = {
  contactEmail: string | null;
  contactPhone: string | null;
  contactMethods: ContactMethod[];
  contactProperties: ListingContactProperties;
  sold: boolean;
};

export function ContactPanel({
  contactEmail,
  contactPhone,
  contactMethods,
  contactProperties,
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
            {
              href: `mailto:${contactEmail}`,
              label: "Email",
              icon: Mail,
              eventName: BUYER_EVENTS.contactEmailClicked,
            },
          ]}
          contactProperties={contactProperties}
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
            eventName: CONTACT_METHOD_EVENTS[method],
          }))}
          contactProperties={contactProperties}
          sold={sold}
        />
      )}
    </div>
  );
}
