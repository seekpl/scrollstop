import { useState } from 'react';
import { useT } from '../../i18n';
import type { QuestionId } from '../../research/model';
import { BRAND_DISTRACTORS, QUESTION_OPTIONS } from '../../research/questions';
import { BigButton, Screen, Title } from './parts';

/** Pytania po obejrzeniu (§10.10): 0–3 z gotowej listy, tylko odpowiedzi do wyboru. */
export function QuestionsScreen({ questions, brand, onDone }: { questions: QuestionId[]; brand: string; onDone(answers: Record<string, string>): void }) {
  const t = useT();
  const q = t.viewer.questions;
  const list = questions.filter((x): x is 'finish' | 'brand_recall' => x === 'finish' || x === 'brand_recall');
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const label = (id: 'finish' | 'brand_recall', opt: string): string => {
    if (id === 'finish') return q.finishOptions[opt as keyof typeof q.finishOptions];
    if (opt === 'brand') return brand;
    if (opt === 'none') return q.dontRemember;
    return BRAND_DISTRACTORS[Number(opt.slice(1)) - 1];
  };
  return (
    <Screen>
      <div className="space-y-7">
        <Title>{q.title}</Title>
        <p className="text-[15px] text-muted">{q.note}</p>
        {list.map((id) => (
          <fieldset key={id} className="space-y-2">
            <legend className="mb-1 text-[16px] font-semibold">{q.text[id]}</legend>
            {QUESTION_OPTIONS[id].map((opt) => (
              <label key={opt} className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-xl px-3 text-[15px] ring-1 ring-inset ${answers[id] === opt ? 'bg-cobalt/[0.07] ring-2 ring-cobalt' : 'bg-surface ring-field/60'}`}>
                <input type="radio" name={id} value={opt} checked={answers[id] === opt} onChange={() => setAnswers((a) => ({ ...a, [id]: opt }))} className="h-5 w-5 accent-cobalt" />
                {label(id, opt)}
              </label>
            ))}
          </fieldset>
        ))}
        <BigButton disabled={list.some((id) => !answers[id])} onClick={() => onDone(answers)}>
          {q.submit}
        </BigButton>
      </div>
    </Screen>
  );
}
