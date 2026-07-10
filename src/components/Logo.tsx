type LogoProps = {
  className?: string;
};

export default function Logo({ className }: LogoProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 250 96"
      preserveAspectRatio="xMinYMid meet"
      className={className}
      role="img"
      aria-label="JGowns"
    >
      <text
        x="2"
        y="54"
        textAnchor="start"
        dominantBaseline="middle"
        fill="#B2854C"
        fontSize="64"
        fontFamily="Fraunces, Iowan Old Style, Times New Roman, serif"
        letterSpacing="-0.03em"
      >
        JGowns
      </text>
    </svg>
  );
}
