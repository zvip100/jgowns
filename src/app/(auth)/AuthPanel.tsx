type AuthPanelProps = {
  title: string;
  subtitle: string;
  children: React.ReactNode;
};

export default function AuthPanel({ title, subtitle, children }: AuthPanelProps) {
  return (
    <div className="mx-auto mt-12 max-w-md sm:mt-20">
      <div className="surface-panel hairline stagger-rise rounded-[1.7rem] p-7 sm:p-9">
        <div className="mb-7 text-center">
          <h1 className="text-[2rem] text-[#2f241b]">{title}</h1>
          <p className="mt-2 text-sm text-[#7d6652]">{subtitle}</p>
        </div>
        {children}
      </div>
    </div>
  );
}
