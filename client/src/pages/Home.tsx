import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useDog } from "@/lib/auth";
import { InsightCardView } from "@/components/InsightCard";
import { Card } from "@/components/ui";
import type { InsightCard } from "@shared/types";

export default function Home() {
  const { dogId } = useDog();
  const { data, isLoading } = useQuery({
    queryKey: ["insights", dogId],
    queryFn: () => api<{ metrics: any; cards: InsightCard[] }>(`/api/insights/${dogId}`),
    enabled: !!dogId,
  });

  if (!dogId) return <Card>강아지를 등록하면 분석을 시작할게요. ⚙️ 설정에서 추가하세요.</Card>;
  if (isLoading) return <div>분석 중…</div>;

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <div className="text-sm text-slate-500">오늘 체중</div>
        <div className="text-2xl font-bold">{data?.metrics?.todayWeightKg ?? "—"} kg</div>
        <div className="text-sm text-slate-500">목표 대비 {data?.metrics?.gapKg !== null && data?.metrics?.gapKg !== undefined ? `${data.metrics.gapKg > 0 ? "+" : ""}${data.metrics.gapKg}kg` : "—"}</div>
      </Card>
      {data?.cards?.map((c, i) => <InsightCardView key={i} card={c} />)}
    </div>
  );
}
