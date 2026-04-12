"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

type DocumentBackLinkProps = {
  href: string;
  label?: string;
  className?: string;
};

export function DocumentBackLink({
  href,
  label = "Журналы",
  className,
}: DocumentBackLinkProps) {
  return (
    <div className={className ?? "mb-6"}>
      <Button
        asChild
        variant="ghost"
        className="h-11 rounded-[14px] px-3 text-[15px] text-[#5566f6] hover:bg-[#eef1ff]"
      >
        <Link href={href}>
          <ArrowLeft className="size-5" />
          {label}
        </Link>
      </Button>
    </div>
  );
}
