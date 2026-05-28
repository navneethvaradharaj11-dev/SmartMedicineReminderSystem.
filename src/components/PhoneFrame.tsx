import { ReactNode } from "react";

interface PhoneFrameProps {
  children: ReactNode;
}

const PhoneFrame = ({ children }: PhoneFrameProps) => {
  return (
    <div className="relative flex min-h-screen w-full items-stretch justify-center overflow-hidden bg-page sm:items-center sm:p-5 md:p-6">
      <div className="relative flex min-h-screen w-full flex-col overflow-hidden bg-background sm:h-[880px] sm:min-h-0 sm:max-h-[96vh] sm:max-w-[500px] sm:rounded-[2.25rem] sm:shadow-float md:max-w-[520px]">
        {children}
      </div>
    </div>
  );
};

export default PhoneFrame;
