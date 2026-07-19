import Link from "next/link";

import LegalPageShell from "@/components/LegalPageShell";
import LegalSection from "@/components/LegalSection";
import { CONTACT_EMAIL } from "@/lib/site";
import { LEGAL_LINK_CLASS } from "@/lib/styles";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "How JGowns collects, uses, and protects your information.",
};

const LAST_UPDATED = "July 14, 2026";

export default function PrivacyPage() {
  return (
    <LegalPageShell title="Privacy Policy" updatedAt={LAST_UPDATED}>
      <p>
        This Privacy Policy explains what information JGowns collects, how we use
        it, and the choices you have. JGowns is a venue for buying and selling
        pre-loved modest gowns; we collect only what we need to run it.
      </p>

      <LegalSection title="1. What we collect">
        <ul className="ml-5 flex list-disc flex-col gap-2">
          <li>
            <span className="font-medium text-(--ink)">Account details:</span>{" "}
            the email and password you register with, or the identity from your
            Google account if you sign in with Google, and an optional phone
            number you may add to your profile.
          </li>
          <li>
            <span className="font-medium text-(--ink)">Listing content:</span>{" "}
            the photos and details you upload for a gown, and the contact
            information (email address or phone number, and any call or text
            options) you choose to publish with it.
          </li>
          <li>
            <span className="font-medium text-(--ink)">
              Contact submissions:
            </span>{" "}
            the email address and message you send us through the Contact form.
          </li>
          <li>
            <span className="font-medium text-(--ink)">Cookies:</span> Supabase
            authentication session cookies that keep you signed in.
          </li>
        </ul>
        <p>
          We do not use analytics or advertising, we do not track you across
          other sites, and we do not sell your information.
        </p>
      </LegalSection>

      <LegalSection title="2. How we use your information">
        <p>
          We use your information to operate the Service: to create and secure
          your account, publish and display your listings, let buyers contact
          you, process your listing photos, respond to your messages, and keep
          the Service safe and functioning. We do not use it for advertising or
          profiling.
        </p>
      </LegalSection>

      <LegalSection title="3. What is public">
        <p>
          When you publish a listing, its content (photos, details, and the
          contact information you added) is visible to anyone who visits the
          Service. This is the most significant way your information is shared,
          and it happens by your choice: the contact email or phone number on a
          listing is published so buyers can reach you directly, with the call,
          text, and copy actions you enable. Do not put anything in a listing
          that you do not want to be public.
        </p>
      </LegalSection>

      <LegalSection title="4. Photo processing & face blurring">
        <p>
          When you upload a listing photo, it is processed on our servers using
          a secure third-party service that detects faces, blurs them, and
          returns the processed image before it is published.
        </p>
        <p>
          Face blurring is a privacy protection, but it is best-effort: detection
          can miss faces, and if the detection service is unavailable the photo
          may be published without blurring. You remain responsible for the
          photos you upload and should not include identifiable people without
          their permission.
        </p>
      </LegalSection>

      <LegalSection title="5. Service providers">
        <p>
          We share information only with the providers that power the Service:
        </p>
        <ul className="ml-5 flex list-disc flex-col gap-2">
          <li>
            <span className="font-medium text-(--ink)">Supabase:</span>{" "}
            authentication, database, and image storage.
          </li>
          <li>
            <span className="font-medium text-(--ink)">Google:</span> Google
            sign-in (if you use it).
          </li>
          <li>
            <span className="font-medium text-(--ink)">Image processing:</span>{" "}
            a secure third-party service that detects and blurs faces in listing
            photos.
          </li>
          <li>
            <span className="font-medium text-(--ink)">Railway:</span> hosting.
          </li>
          <li>
            <span className="font-medium text-(--ink)">Gmail SMTP:</span>{" "}
            sending account and password-reset emails.
          </li>
        </ul>
        <p>No other third parties receive your information.</p>
      </LegalSection>

      <LegalSection title="6. Cookies">
        <p>
          We use only essential cookies: the Supabase session cookies that keep
          you signed in. We do not use advertising, analytics, or tracking
          cookies, so no cookie-consent banner is needed.
        </p>
      </LegalSection>

      <LegalSection title="7. Retention & deletion">
        <p>
          We keep your information for as long as your account is active. If you
          delete your account, your listings are deleted along with it, and the
          associated photos are removed from storage. Contact-form messages are
          kept so we can respond and maintain a record of inquiries.
        </p>
      </LegalSection>

      <LegalSection title="8. Your rights">
        <p>
          You may request access to, correction of, or deletion of your personal
          information, and you may ask us not to sell it (we never do). We honor
          these requests for all users. To make a request, use our{" "}
          <Link href="/contact" className={LEGAL_LINK_CLASS}>
            Contact page
          </Link>{" "}
          or email{" "}
          <a href={`mailto:${CONTACT_EMAIL}`} className={LEGAL_LINK_CLASS}>
            {CONTACT_EMAIL}
          </a>
          .
        </p>
      </LegalSection>

      <LegalSection title="9. Children">
        <p>
          The Service is not directed to children under 13, and we do not
          knowingly collect information from them. If you believe a child has
          provided us information, please contact us and we will delete it.
        </p>
      </LegalSection>

      <LegalSection title="10. Changes & contact">
        <p>
          We may update this Privacy Policy from time to time. The &quot;Last
          updated&quot; date above reflects the latest version. If we introduce
          payments or other new features in the future, we will update this
          policy to describe any new data practices before they take effect.
        </p>
        <p>
          Questions about your privacy? Reach us through our{" "}
          <Link href="/contact" className={LEGAL_LINK_CLASS}>
            Contact page
          </Link>{" "}
          or at{" "}
          <a href={`mailto:${CONTACT_EMAIL}`} className={LEGAL_LINK_CLASS}>
            {CONTACT_EMAIL}
          </a>
          .
        </p>
      </LegalSection>
    </LegalPageShell>
  );
}
