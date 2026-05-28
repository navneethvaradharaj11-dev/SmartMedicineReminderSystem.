interface ScreenHeaderProps {
  title: string;
  subtitle?: string;
}

const ScreenHeader = ({ title, subtitle }: ScreenHeaderProps) => (
  <div className="mx-auto w-full max-w-xl px-5 pt-4 pb-3 sm:px-6">
    <h1 className="break-words text-2xl font-bold text-foreground">{title}</h1>
    {subtitle && <p className="mt-0.5 text-sm leading-6 text-muted-foreground">{subtitle}</p>}
  </div>
);

export default ScreenHeader;
