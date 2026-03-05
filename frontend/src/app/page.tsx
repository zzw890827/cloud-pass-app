"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Spinner from "@/components/ui/Spinner";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    // CF Access handles authentication — always redirect to providers
    router.replace("/providers");
  }, [router]);

  return <Spinner className="mt-20" />;
}
