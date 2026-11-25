import type { ResearchText, SegForm, SegmentRef } from '../../research/text';

function seg(s: SegmentRef, form: SegForm): string {
  const name = s.kind === 'scene' ? `Scene ${s.n}` : `Section ${s.range}`;
  return form === 'nom' ? name : form === 'loc' ? `in ${name.toLowerCase()}` : name.toLowerCase();
}
const dec = (v: number, digits = 1) => v.toFixed(digits);
const lower = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);
const ppl = (n: number) => (n === 1 ? 'viewer' : 'viewers');

/** Analytical texts in English (§8.3). */
export const research: ResearchText = {
  scene: (n) => `Scene ${n}`,
  seg,
  version: (id) => `Version ${id}`,
  sampleLevel: {
    none: 'No valid sessions.',
    preview: 'Preview: a single viewer changes the curve a lot, so findings are preliminary.',
    indicative: 'Preliminary result: the direction is visible, but decide with care. A reliable curve needs 30 viewers.',
    reliable: 'The sample is large enough for editing decisions.',
  },
  headline: {
    empty: 'The report appears after the first valid session.',
    drop: (p) => `The biggest drop in attention happened between ${p.from} and ${p.to}${p.where ? ` (${lower(p.where)})` : ''}.`,
    dropDetail: (p) => `The share of viewers looking falls from ${p.fromPct}% to ${p.toPct}%, that is by ${p.deltaPp} pp. Across the whole video, ${p.meanPct}% of viewers look on average.`,
    stable: (p) => `Attention holds steady: on average ${p.meanPct}% of viewers are looking.`,
    stableDetail: 'The curve has no drops larger than 10 pp.',
    feed: (p) => `${p.stopPct}% of viewers stopped on the clip${p.fillerPct !== null ? ` (other feed clips: ${p.fillerPct}%)` : ''}.`,
    feedDetail: (p) => [p.dwell !== null ? `Median time on the clip: ${dec(p.dwell)} s.` : null, p.meanPct !== null ? `While they stay, ${p.meanPct}% of them look on average.` : null].filter(Boolean).join(' '),
    grid: (p) => `${p.lookedPct}% of viewers looked at the tested thumbnail${p.firstLook !== null ? `, typically after ${dec(p.firstLook)} s` : ''}.`,
    gridDetail: (p) => [p.chosenPct !== null ? `${p.chosenPct}% of viewers chose this video (declared).` : null, p.positionIndex !== null ? `Index against thumbnails in the same position: ${dec(p.positionIndex, 2)}× (1× = average).` : null].filter(Boolean).join(' '),
    carousel: (p) => `${p.completedPct}% of viewers reached the last slide (of ${p.slides}).`,
    carouselDetail: (p) => (p.worst === null ? 'No slide stands out with drop-offs.' : `Most viewers stop at slide ${p.worst}: ${p.lost} ${p.lost === 1 ? 'person' : 'people'}.`),
  },
  findings: {
    drop: {
      title: (p) => `${p.where ? `${p.where}: ` : ''}attention drops by ${p.deltaPp} pp (${p.from}–${p.to})`,
      fact: (p) => `Between ${p.from} and ${p.to} the share of viewers looking falls from ${p.fromPct}% to ${p.toPct}% (−${p.deltaPp} pp, about ${p.lost} of ${p.n} ${ppl(p.n)}).`,
      start: {
        observation: 'The drop starts in the first seconds.',
        hypothesis: 'The first frame gives no reason to stay.',
        recommendation: 'Open with your strongest shot and a promise in the first second: a face, action or a result. No intro or logo at the start.',
      },
      afterCut: {
        observation: (s) => `The drop starts right after the cut to ${seg(s, 'gen')}.`,
        hypothesis: 'The new shot has no anchor for the eye (a face, movement or text).',
        recommendation: (s) => `Open ${seg(s, 'gen')} more strongly: a close-up, movement or a short caption in the first second of the shot.`,
      },
      intoScene: {
        observation: (p) => `The drop starts ${p.seconds}s into ${seg(p.seg, 'gen')}.`,
        hypothesis: 'The scene is too long or too static at this point.',
        recommendation: (p) => `Cut ${seg(p.seg, 'gen')} by about ${p.cut}s or add a change of shot (pattern interrupt) before ${p.before}.`,
      },
      genericRecommendation: (p) => `Check what happens on screen between ${p.from} and ${p.to}: a change of shot, movement or a caption can hold the eye.`,
    },
    weak: {
      title: (p) => (p.low ? `${seg(p.seg, 'nom')} has ${p.lowest ? 'the lowest' : 'low'} attention` : `${seg(p.seg, 'nom')} loses attention`),
      fact: (p) => `${seg(p.seg, 'nom')} (${p.from}–${p.to}) averages ${p.meanPct}% attention, against ${p.filmPct}% for the whole video.`,
      change: (pp) => ` Attention falls by ${pp} pp during it.`,
      hypothesis: 'The pace or content of this part engages less than the rest of the video.',
      recommendation: (s) => `Shorten or speed up ${seg(s, 'gen')} and test the new cut in an A/B comparison.`,
    },
    hook: {
      title: 'The hook doesn’t stop every viewer',
      fact: (p) => `After 3 seconds, ${p.pct}% of viewers are looking (good-hook threshold: ${p.limitPct}%).`,
      hypothesis: 'The first shot doesn’t catch the eye or doesn’t promise anything specific.',
      recommendationVertical: 'Open with your strongest shot and a promise in the first second: a face, action or a result. No intro or logo at the start.',
      recommendationHorizontal: 'Shorten the intro: show the topic and the host in the first seconds and move the title card later.',
    },
    ending: {
      title: 'The ending loses attention',
      fact: (p) => `In the last 3s, ${p.pct}% of viewers are looking (video average ${p.filmPct}%).`,
      hypothesis: 'The ending (end card, credits) doesn’t hold attention.',
      recommendation: 'Shorten the ending or move the CTA and key message before the last seconds.',
    },
    aoi: {
      title: (name) => `Few viewers look at “${name}”`,
      fact: (p) => `${p.pct}% of viewers (${p.lookers} of ${p.n}) looked at “${p.name}” between ${p.from} and ${p.to}.`,
      small: ' The area is smaller than the measurement accuracy, so the result is approximate.',
      hypothesis: 'The element is too small, visible too briefly or placed away from where most viewers look.',
      recommendation: 'Make the element bigger, keep it on screen longer or move it closer to where viewers look.',
    },
    text: {
      title: (name) => `“${name}”: viewers may not have time to read it`,
      factShort: (p) => `“${p.name}” is on screen for ${p.seconds}s, but ${p.words} ${p.words === 1 ? 'word needs' : 'words need'} about ${p.needed}s.`,
      factFew: (p) => `Viewers who looked at “${p.name}” looked for ${p.median}s on average, less than half of the ${p.needed}s needed.`,
      hypothesis: 'The text is too long for its screen time or competes with the face and motion in the frame.',
      recommendation: 'Keep the text on screen for at least 2.5s or cut it to 5–6 words; move it to where viewers look.',
    },
    unsafe: {
      title: (name) => `“${name}” sits in a covered area`,
      fact: (p) => `The area “${p.name}” overlaps the part of the frame covered by the platform interface (caption and buttons).`,
      hypothesis: 'On the platform, part of the text, logo or CTA may be hidden.',
      recommendation: (p) => `Move the text higher: the bottom ~${p.bottomPct}% of the frame is covered by the platform’s caption and buttons.`,
    },
    brand: {
      title: 'Viewers see the brand too late',
      fact: (p) => `${p.median === null ? 'Most viewers didn’t look at the logo or product.' : `Median first look at the logo or product: ${p.median}s.`} By 3s, ${p.by3Pct}% of viewers had seen the brand; over the whole video, ${p.reachPct}%.`,
      hypothesis: 'The product or logo appears late or where nobody is looking.',
      recommendation: 'Show the product or logo in the first 3 seconds, ideally in hand or next to the face.',
    },
    cta: {
      title: (name) => `The CTA “${name}” is rarely noticed`,
      fact: (p) => `${p.pct}% of viewers (${p.lookers} of ${p.n}) who stayed until the CTA “${p.name}” appeared looked at it.`,
      hypothesis: 'The CTA is too small, too brief or competes with another element in the frame.',
      recommendation: 'Make the CTA bigger, keep it on screen longer and say it out loud; place it where viewers look in the last seconds.',
    },
    feedSkip: {
      title: 'In the feed, viewers scroll past this clip more often than others',
      fact: (p) => `${p.stopPct}% of viewers stayed on the clip for at least ${p.seconds}s, against ${p.fillerPct}% on the other feed clips on average.`,
      hypothesis: 'The first frame doesn’t stand out in the feed or doesn’t promise anything specific.',
      recommendation: 'Strengthen the first frame: contrast, a close-up face and a short promise in text from the first second.',
    },
    strong: {
      title: (s) => `${seg(s, 'nom')} holds attention best`,
      fact: (p) => `${seg(p.seg, 'nom')} averages ${p.pct}% attention (whole video: ${p.filmPct}%).`,
      recommendation: 'Keep this part; it’s a good pacing model for the rest of the video.',
    },
  },
  ab: {
    noData: 'Not enough data to compare the versions.',
    means: (list) => `Mean attention: ${list}.`,
    unclear: (p) => `The difference is within the uncertainty${p.enough ? '' : ' (too few viewers in one of the versions)'}.`,
    winner: (p) => `Version ${p.win} holds attention ${p.pp} pp higher on average (${p.winVal} vs ${p.loseVal}).`,
    biggest: (p) => `Biggest difference: ${lower(p.label)}, version ${p.win} ${p.pp} pp higher.`,
    testLine: (p) => `Welch’s t-test on viewers’ mean attention${p.holm ? ' (Holm correction)' : ''}: p ${/^[<>]/.test(p.p) ? p.p : `= ${p.p}`}. A difference is conclusive at p < 0.05 with at least ${p.min} viewers in each version.`,
    hookLine: (p) => `Two-proportion test for hook retention @3s${p.holm ? ' (Holm correction)' : ''}: p ${/^[<>]/.test(p.p) ? p.p : `= ${p.p}`}.`,
    sharedRest: (p) => `From ${p.from} the versions are identical; there the difference in mean attention is ${p.pp} pp.`,
  },
  demo: {
    reelProject: 'Demo reel: hook test',
    videoProject: 'Demo YouTube video',
    feedProject: 'Demo reel in the feed',
    gridProject: 'Demo thumbnail in a YouTube grid',
    carouselProject: 'Demo carousel (5 slides)',
    thumbTitle: 'Three things I check before publishing',
    creator: 'Demo studio',
    reelA: 'Demo reel A (15s, 9:16)',
    reelB: 'Demo reel B (15s, 9:16)',
    video: 'Demo video (60s, 16:9)',
    versionA: 'Version A (logo first)',
    versionB: 'Version B (strong hook)',
    caption: 'Three things I check before posting',
    aoi: { face: 'Face', hook: 'Hook', captions: 'Bottom captions', product: 'Product', logo: 'Logo', cta: 'CTA', chart: 'Chart', title: 'Title' },
  },
};
