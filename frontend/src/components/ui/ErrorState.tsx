import Link from "next/link";
import Card from "@/components/ui/Card";

interface ErrorStateProps {
  title?: string;
  message: string;
  /** Optional link back to somewhere useful. */
  href?: string;
  linkLabel?: string;
}

export default function ErrorState({
  title = "Something went wrong",
  message,
  href = "/providers",
  linkLabel = "Back to providers",
}: ErrorStateProps) {
  return (
    <Card className="max-w-lg mt-10 p-6">
      <h1 className="text-lg font-semibold text-gray-900">{title}</h1>
      <p className="mt-2 text-sm text-gray-600">{message}</p>
      <Link href={href} className="mt-4 inline-block text-sm text-accent-600 hover:underline">
        {linkLabel}
      </Link>
    </Card>
  );
}
