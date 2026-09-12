import { MiniHomeSkeleton } from "@/app/mini/_components/mini-home-skeleton";

/**
 * Граница Suspense для корня Mini App.
 *
 * До этого между тапом и контентом был белый экран: на кухонном 3G
 * это полторы-три секунды, в которые человек не понимает, нажалось ли.
 * Скелетон уже был написан и показывался вручную из `page.tsx` — здесь
 * он переиспользуется как штатный `loading.tsx`, то есть работает и при
 * серверной навигации, а не только после монтирования клиента.
 */
export default function MiniLoading() {
  return <MiniHomeSkeleton />;
}
