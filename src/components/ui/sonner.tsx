import { useTheme } from "next-themes";
import { Toaster as Sonner, toast } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      position="top-center"
      offset={{ top: "0.875rem" }}
      mobileOffset={{ top: "0.875rem", left: "1rem", right: "1rem" }}
      visibleToasts={1}
      duration={1600}
      gap={6}
      expand={false}
      className="toaster group"
      style={{ "--width": "min(380px, calc(100vw - 2rem))" } as React.CSSProperties}
      toastOptions={{
        classNames: {
          toast:
            "group toast w-full max-w-[380px] rounded-2xl px-4 py-3 text-sm group-[.toaster]:bg-background/95 group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-soft group-[.toaster]:backdrop-blur",
          description: "group-[.toast]:text-muted-foreground",
          actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
        },
      }}
      {...props}
    />
  );
};

export { Toaster, toast };
