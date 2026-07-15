import Link from "next/link";

import LegalPageShell from "@/components/LegalPageShell";
import LegalSection from "@/components/LegalSection";
import { CONTACT_EMAIL } from "@/lib/site";
import { LEGAL_LINK_CLASS } from "@/lib/styles";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Use",
  description:
    "The terms that govern your use of JGowns.",
};

const LAST_UPDATED = "July 14, 2026";

export default function TermsPage() {
  return (
    <LegalPageShell title="Terms of Use" updatedAt={LAST_UPDATED}>
      <p>
        These Terms of Use (&quot;Terms&quot;) govern your access to and use of
        JGowns (the &quot;Service&quot;), a marketplace where people list and
        discover pre-loved modest gowns. By using the Service you agree to these
        Terms. If you do not agree, do not use the Service.
      </p>

      <LegalSection title="1. Acceptance of these terms">
        <p>
          By accessing, browsing, creating an account, or listing a gown on
          JGowns, you agree to be bound by these Terms and by our{" "}
          <Link href="/privacy" className={LEGAL_LINK_CLASS}>
            Privacy Policy
          </Link>
          , which is incorporated here by reference. These Terms apply to every
          visitor, buyer, and seller.
        </p>
      </LegalSection>

      <LegalSection title="2. Eligibility">
        <p>
          You must be at least 18 years old to create an account or list a gown.
          By using the Service you represent that you are 18 or older and that
          the information you provide is accurate. We may suspend or remove any
          account we believe does not meet this requirement.
        </p>
      </LegalSection>

      <LegalSection title="3. The Service is a venue, not a party to any sale">
        <p>
          JGowns is a venue that connects buyers and sellers. We are not a party
          to any transaction. We do not process payments, hold funds, provide
          escrow, take commissions, ship goods, or take possession of any gown.
          Buyers and sellers deal with each other directly and arrange payment
          and delivery entirely between themselves.
        </p>
        <p>
          We do not vet, endorse, or guarantee any user, listing, gown, price,
          or the accuracy of any content. Any dispute arising from a
          transaction is solely between the buyer and the seller. You use the
          Service, and contact other users, at your own risk.
        </p>
      </LegalSection>

      <LegalSection title="4. Accounts & security">
        <p>
          Sellers create an account with an email and password, or by signing in
          with Google. You are responsible for keeping your credentials
          confidential and for all activity under your account. Notify us
          promptly if you believe your account has been used without your
          permission.
        </p>
      </LegalSection>

      <LegalSection title="5. Listings & seller responsibilities">
        <p>As a seller, you are solely responsible for your listings. You agree that:</p>
        <ul className="ml-5 flex list-disc flex-col gap-2">
          <li>
            Every listing is accurate and not misleading, including size,
            category, condition, price, and location.
          </li>
          <li>
            You own or have the right to sell the gown, and to publish the
            photos and text you upload.
          </li>
          <li>
            You understand that the contact information you add to a listing
            (an email address or phone number, and any call or text options) is
            published publicly on the listing so buyers can reach you directly.
            You provide it for that purpose.
          </li>
          <li>
            You will not upload photos of identifiable people without their
            permission. Our automated face-blurring is best-effort and may miss
            faces; final responsibility for every photo you upload rests with
            you.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="6. Buyer conduct">
        <p>
          Contact sellers only with a genuine interest in a gown. You may not
          scrape, harvest, or collect listings or contact information; send
          spam, chain messages, or solicitations; or use another person&apos;s
          contact details for any purpose other than a good-faith inquiry about
          their listing.
        </p>
      </LegalSection>

      <LegalSection title="7. Prohibited uses">
        <p>You agree not to use the Service to:</p>
        <ul className="ml-5 flex list-disc flex-col gap-2">
          <li>Post false, deceptive, infringing, or unlawful content;</li>
          <li>List anything other than a gown you are genuinely offering;</li>
          <li>
            Harass, threaten, defraud, or impersonate any person, or invade
            anyone&apos;s privacy;
          </li>
          <li>
            Interfere with, disrupt, or attempt to gain unauthorized access to
            the Service, its systems, or other accounts;
          </li>
          <li>
            Use bots, scrapers, or automated means to access the Service or
            collect data from it.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="8. Our content & intellectual property">
        <p>
          The Service (including the JGowns name, logo, design, and software)
          is owned by us and protected by intellectual-property laws. We grant
          you a limited, personal, non-transferable license to use the Service
          as intended. You may not copy, modify, or create derivative works from
          the Service except for content you own.
        </p>
      </LegalSection>

      <LegalSection title="9. Your content & the license you grant">
        <p>
          You keep ownership of the photos and text you submit. By submitting
          them, you grant JGowns a worldwide, non-exclusive, royalty-free
          license to host, store, process (including automated face-blurring and
          image optimization), display, and promote your listing in connection
          with operating the Service. This license ends
          when your listing is removed, except for reasonable backups and any
          copies required by law.
        </p>
        <p>
          You are responsible for the accuracy and legality of everything you
          submit. We may remove any listing, or suspend or terminate any
          account, that we believe violates these Terms or the rights of others.
        </p>
      </LegalSection>

      <LegalSection title="10. Third-party services & links">
        <p>
          We rely on third-party providers to operate the Service, including
          Supabase, Google, and Railway. The Service may also link to third-party
          sites. We are not responsible for the content, policies, or practices
          of any third party, and your use of their services is governed by
          their terms.
        </p>
      </LegalSection>

      <LegalSection title="11. Disclaimers">
        <p>
          The Service is provided &quot;as is&quot; and &quot;as available,&quot;
          without warranties of any kind, express or implied, including
          merchantability, fitness for a particular purpose, and
          non-infringement. We do not warrant that the Service will be
          uninterrupted or error-free, or that any gown, seller, or buyer is
          genuine, safe, or suitable. Because we are only a venue, we make no
          warranty about any gown or transaction.
        </p>
      </LegalSection>

      <LegalSection title="12. Limitation of liability">
        <p>
          To the fullest extent permitted by law, JGowns and its operators will
          not be liable for any indirect, incidental, special, consequential, or
          punitive damages, or for any loss arising from your use of the Service,
          from any transaction or communication with another user, or from any
          gown you buy or sell. Our total liability for any claim relating to the
          Service will not exceed one hundred U.S. dollars (USD $100).
        </p>
      </LegalSection>

      <LegalSection title="13. Indemnification">
        <p>
          You agree to indemnify and hold harmless JGowns and its operators from
          any claim, loss, or expense (including reasonable legal fees) arising
          from your use of the Service, your content, your transactions with
          other users, or your violation of these Terms or of any law or
          third-party right.
        </p>
      </LegalSection>

      <LegalSection title="14. Termination, governing law, changes & contact">
        <p>
          We may suspend or terminate your access to the Service at any time if
          you violate these Terms or if we discontinue the Service. You may stop
          using the Service and delete your account at any time.
        </p>
        <p>
          These Terms are governed by the laws of the State of [State], without
          regard to its conflict-of-law rules.
        </p>
        <p>
          We currently do not process payments or charge fees. If we introduce
          transactions, payments, or fees in the future, we will update these
          Terms before doing so. We may otherwise update these Terms from time to
          time; the &quot;Last updated&quot; date above reflects the latest
          version, and your continued use after a change means you accept it.
        </p>
        <p>
          Questions about these Terms? Reach us through our{" "}
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
