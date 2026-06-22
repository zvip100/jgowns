import { signOut } from "@/lib/actions/auth";

type SignOutButtonProps = { className?: string };

export default function SignOutButton({ className }: SignOutButtonProps) {
  return (
    <form action={signOut} className="contents">
      <button type="submit" className={className}>
        Sign Out
      </button>
    </form>
  );
}
