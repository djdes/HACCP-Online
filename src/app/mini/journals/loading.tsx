import { MiniListSkeleton } from "@/app/mini/_components/mini-list-skeleton";

export default function Loading() {
  return <MiniListSkeleton rows={5} label="Загружаем журналы" />;
}
