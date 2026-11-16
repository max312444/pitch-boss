// 월드컵 모드 협회 평가 (주기가 끝난 뒤): 경질 → 다른 나라 고르기 (필수) · 목표를 크게 넘음 → 더 큰 나라 제안 (선택)
import { STAGE_KO } from '../../engine/intl';
import { confedOf } from '../../engine/national';
import { nationKo } from '../../data/db';
import { useGame } from '../../store/game';
import { useWorld } from '../hooks';
import { Crest } from './Crest';

export function IntlJobModal() {
  const w = useWorld();
  const choose = useGame((s) => s.chooseIntlJob);
  const job = w.intl?.job;
  if (!job) return null;
  const sacked = job.reason === 'sacked';
  return (
    <div className="fixed inset-0 z-50 grid animate-[fade_0.2s_ease-out] place-items-center bg-ink-950/80 p-3 backdrop-blur-sm">
      <div className={`panel w-full max-w-[480px] border ${sacked ? 'border-red/50' : 'border-neon/50'} px-5 py-5`}>
        <div className={`text-[12px] font-semibold ${sacked ? 'text-red' : 'text-neon'}`}>{sacked ? '협회 결정' : '감독 제안'}</div>
        <div className="mt-1 text-[19px] font-semibold">{sacked ? `${nationKo(w.intl!.nation)} 대표팀에서 경질됐습니다` : '다른 나라가 감독으로 모시고 싶어 합니다'}</div>
        <div className="mt-1.5 text-[13px] leading-relaxed text-mid">
          지난 월드컵 성적 <b className="text-hi">{STAGE_KO[job.stage]}</b> (목표 {STAGE_KO[job.objective]}). {sacked ? '아래 나라 중 한 곳을 골라 감독 커리어를 이어 가세요.' : '옮기거나, 지금 대표팀에 남을 수 있습니다.'}
        </div>
        <div className="mt-4 grid gap-2">
          {job.offers.map((n) => (
            <button key={n} onClick={() => choose(n)} className="flex items-center gap-3 rounded-lg bg-ink-850 px-4 py-3 text-left ring-1 ring-line hover:bg-ink-800 hover:ring-neon/50">
              <Crest clubId={`nt-${n}`} size={30} />
              <span className="flex-1"><b className="text-[15px]">{nationKo(n)}</b> <span className="text-[12px] text-lo">· {confedOf(n) ?? ''}</span></span>
              <span className="text-[13px] font-semibold text-neon">맡기 →</span>
            </button>
          ))}
        </div>
        {!sacked && <button onClick={() => choose(null)} className="mt-3 h-11 w-full rounded-lg text-[13px] text-mid ring-1 ring-line hover:text-hi">{nationKo(w.intl!.nation)} 대표팀에 남기</button>}
      </div>
    </div>
  );
}
