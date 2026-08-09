import ProviderTheme from "@/components/ProviderTheme";

export default function ExamLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <ProviderTheme />
      {children}
    </>
  );
}
