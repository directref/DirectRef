'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { X } from 'lucide-react';
import { Rubik } from 'next/font/google';
import './tour.css';
import { useAuth } from '@/lib/context/AuthContext';
import { tourSteps, type TourStep } from '@/lib/tour/steps';

const rubik = Rubik({ subsets: ['latin'], weight: ['400', '500', '600'], variable: '--tour-font' });

const DONE_KEY = 'directref.tour.done.v1';
const STEP_KEY = 'directref.tour.step.v1';

const MAX_MEASURE_FRAMES = 150;
const SPOTLIGHT_PAD = 8;
const CARD_WIDTH = 320;
const VIEWPORT_GUTTER = 12;

type Rect = { top: number; left: number; width: number; height: number };

const matchesRoute = (step: TourStep, pathname: string) =>
  step.routeMatch ? step.routeMatch(pathname) : step.route === pathname;

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

// Guided product tour. Follows the design spec in full: data-tour anchors,
// spotlight+card positioning math, Rubik/OKLCH styling (tour.css), and the
// directref.tour.*.v1 localStorage keys. Two extensions beyond the spec's
// step model (see TourStep in steps.ts): routeMatch for the dynamic job
// detail page, and resolveNext for picking which specific job to walk
// through — neither can be a fixed string since both depend on live data.
export function ProductTour() {
  const { user } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  const [stepIndex, setStepIndex] = useState<number | null>(null);
  const [rect, setRect] = useState<Rect | null>(null);
  const hasScrolledIntoView = useRef(false);

  // Initialize once a session exists, from wherever localStorage says the
  // user left off. Runs once per user, not on every pathname change.
  useEffect(() => {
    if (!user) return;
    if (localStorage.getItem(DONE_KEY)) return;
    const stored = Number(localStorage.getItem(STEP_KEY) ?? 0);
    setStepIndex(Number.isFinite(stored) && stored < tourSteps.length ? stored : 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const finish = () => {
    localStorage.setItem(DONE_KEY, '1');
    localStorage.removeItem(STEP_KEY);
    setStepIndex(null);
    setRect(null);
  };

  // Reaching the end of the tour (as opposed to skipping mid-way) drops the
  // user back on the dashboard rather than wherever the last step happened
  // to leave them (the post-a-job form).
  const complete = () => {
    finish();
    router.push('/feed');
  };

  const goToStep = (i: number) => {
    localStorage.setItem(STEP_KEY, String(i));
    setRect(null);
    hasScrolledIntoView.current = false;
    setStepIndex(i);
  };

  const advance = () => {
    if (stepIndex === null) return;
    let i = stepIndex;
    while (i < tourSteps.length - 1) {
      const step = tourSteps[i];
      const wantsNav = !!(step.next || step.resolveNext);
      if (!wantsNav) {
        goToStep(i + 1);
        return;
      }
      const target = step.resolveNext ? step.resolveNext() : (step.next as string);
      if (target) {
        goToStep(i + 1);
        router.push(target);
        return;
      }
      // Can't reach i + 1 right now (e.g. no job currently send-able) —
      // treat it as transparent and keep looking from there.
      i += 1;
    }
    complete();
  };

  // Going back never needs to resolve anything dynamic — every step that
  // can be a "previous" target (i.e. every step except the dynamic job
  // detail one, which is never itself a backward destination — the step
  // right after it re-uses the same routeMatch) has a plain route string.
  const goBack = () => {
    if (stepIndex === null || stepIndex === 0) return;
    const prevIndex = stepIndex - 1;
    const prevStep = tourSteps[prevIndex];
    if (!matchesRoute(prevStep, pathname)) {
      goToStep(prevIndex);
      router.push(prevStep.route);
      return;
    }
    goToStep(prevIndex);
  };

  useEffect(() => {
    if (stepIndex === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') finish();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepIndex]);

  // Measurement: poll via rAF until the anchor exists (route transitions and
  // async data both delay it), then keep tracking it on scroll/resize. Give
  // up after MAX_MEASURE_FRAMES and auto-advance rather than dead-ending.
  useLayoutEffect(() => {
    if (stepIndex === null) return;
    const step = tourSteps[stepIndex];
    if (!matchesRoute(step, pathname)) return;

    let rafId = 0;
    let frame = 0;
    let cancelled = false;

    const measure = () => {
      const el = step.resolveElement ? step.resolveElement() : document.querySelector(`[data-tour="${step.anchor}"]`);
      if (!el) return false;
      const r = el.getBoundingClientRect();
      const offScreen = r.top < 0 || r.left < 0 || r.bottom > window.innerHeight || r.right > window.innerWidth;
      if (offScreen && !hasScrolledIntoView.current) {
        hasScrolledIntoView.current = true;
        el.scrollIntoView({ block: 'center', behavior: 'smooth' });
        return true; // re-measure on the next scroll event once settled
      }
      setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
      return true;
    };

    const loop = () => {
      if (cancelled) return;
      if (measure()) return;
      frame += 1;
      if (frame >= MAX_MEASURE_FRAMES) {
        advance();
        return;
      }
      rafId = requestAnimationFrame(loop);
    };
    loop();

    const onScrollOrResize = () => measure();
    window.addEventListener('scroll', onScrollOrResize, true);
    window.addEventListener('resize', onScrollOrResize);

    return () => {
      cancelled = true;
      cancelAnimationFrame(rafId);
      window.removeEventListener('scroll', onScrollOrResize, true);
      window.removeEventListener('resize', onScrollOrResize);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepIndex, pathname]);

  if (stepIndex === null || !rect || !user) return null;
  const step = tourSteps[stepIndex];
  if (!matchesRoute(step, pathname)) return null;

  const top = rect.top - SPOTLIGHT_PAD;
  const left = rect.left - SPOTLIGHT_PAD;
  const width = rect.width + 2 * SPOTLIGHT_PAD;
  const height = rect.height + 2 * SPOTLIGHT_PAD;
  const below = top + height + 200 < window.innerHeight || top < 200;
  const cardTop = below ? top + height + 12 : Math.max(VIEWPORT_GUTTER, top - 12);
  const cardLeft = clamp(left, VIEWPORT_GUTTER, window.innerWidth - (CARD_WIDTH + VIEWPORT_GUTTER));

  return (
    <div className={`directref-tour ${rubik.variable}`}>
      <div className="directref-tour__spotlight" style={{ top, left, width, height }} />
      <div
        className="directref-tour__card"
        style={{ top: cardTop, left: cardLeft, transform: below ? undefined : 'translateY(-100%)' }}
      >
        <button className="directref-tour__close" aria-label="Skip tour" onClick={finish}>
          <X size={16} />
        </button>
        <div className="directref-tour__eyebrow">
          Step {stepIndex + 1} of {tourSteps.length}
        </div>
        <div className="directref-tour__title">{step.title}</div>
        <div className="directref-tour__body">{step.body}</div>
        <div className="directref-tour__footer">
          <div className="directref-tour__footer-left">
            {stepIndex > 0 && (
              <button className="directref-tour__skip" onClick={goBack}>
                Back
              </button>
            )}
            <button className="directref-tour__skip" onClick={finish}>
              Skip
            </button>
          </div>
          <button className="directref-tour__next" onClick={advance}>
            {step.cta ?? 'Next'}
          </button>
        </div>
      </div>
    </div>
  );
}
