import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useDog } from "@/lib/auth";
import { InsightCardView } from "@/components/InsightCard";
import { QuickRecord } from "@/components/QuickRecord";
import { Card, SectionTitle } from "@/components/ui";
import type { AggregatedMetrics, InsightCard } from "@shared/types";
import type { Dog } from "@shared/schema";

const todayStr = () => new Date().toISOString().slice(0, 10);

export default function Home() {
  const { dogId } = useDog();
  const { data: dogs } = useQuery({ queryKey: ["dogs"], queryFn: () => api<Dog[]>("/api/dogs") });
  const { data, isLoading } = useQuery({
    queryKey: ["insights", dogId],
    queryFn: () => api<{ metrics: AggregatedMetrics; cards: InsightCard[] }>(`/api/insights/${dogId}`),
    enabled: !!dogId,
  });

  if (!dogs?.length) {
    return (
      <Card className="mt-2 text-center">
        <div className="mb-1 text-2xl">🐶</div>
        <div className="font-bold text-ink">아직 등록된 아이가 없어요</div>
        <p className="mt-1 text-sm text-ink-soft">⚙️ 설정에서 레오·아미를 추가하면<br />오늘의 현황과 분석을 보여드릴게요.</p>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-5 pb-2">
      {/* 오늘의 현황 */}
      <section>
        <SectionTitle>오늘의 현황</SectionTitle>
        <div className="flex flex-col gap-2">
          {dogs.map((d) => <DogStatusRow key={d.id} dog={d} active={d.id === dogId} metrics={d.id === dogId ? data?.metrics : undefined} />)}
        </div>
      </section>

      {/* AI 인사이트 */}
      <section>
        <SectionTitle>오늘의 코치</SectionTitle>
        {isLoading ? (
          <Card className="text-sm text-ink-soft">분석 중…</Card>
        ) : (
          <div className="flex flex-col gap-2">
            {data?.cards?.map((c, i) => <InsightCardView key={i} card={c} />)}
          </div>
        )}
      </section>

      {/* 빠른 기록 */}
      <section>
        <SectionTitle>빠른 기록</SectionTitle>
        <Card><QuickRecord /></Card>
      </section>
    </div>
  );
}

function DogStatusRow({ dog, active, metrics }: { dog: Dog; active: boolean; metrics?: AggregatedMetrics }) {
  const { data: daily } = useQuery({
    queryKey: ["daily", dog.id, todayStr()],
    queryFn: () => api<{ walks: unknown[]; feedings: unknown[] }>(`/api/daily/${dog.id}/${todayStr()}`),
  });
  const walked = (daily?.walks?.length ?? 0) > 0;
  const fed = (daily?.feedings?.length ?? 0) > 0;

  return (
    <Card className={active ? "ring-2 ring-brand/30" : ""}>
      <div className="flex items-center gap-3">
        <div className="grid h-11 w-11 place-items-center rounded-full bg-brand-soft text-xl">🐕</div>
        <div className="flex-1">
          <div className="font-bold text-ink">{dog.name}</div>
          <div className="text-xs text-ink-soft">{dog.breed ?? "견종 미입력"}</div>
        </div>
        <div className="text-right">
          <div className="text-[11px] text-ink-soft">몸무게</div>
          <div className="font-bold text-ink">{metrics?.todayWeightKg != null ? `${metrics.todayWeightKg}kg` : "—"}</div>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <StatusPill ok={walked} okText="산책 완료" noText="산책 미완료" icon="🐾" />
        <StatusPill ok={fed} okText="식사 완료" noText="식사 미완료" icon="🍚" />
      </div>
    </Card>
  );
}

function StatusPill({ ok, okText, noText, icon }: { ok: boolean; okText: string; noText: string; icon: string }) {
  return (
    <div className={`flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-semibold ${ok ? "bg-cat-food-bg text-cat-food" : "bg-cat-health-bg text-cat-health"}`}>
      <span>{icon}</span>
      {ok ? okText : noText}
    </div>
  );
}
