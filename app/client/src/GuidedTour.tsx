import {useEffect, useRef} from 'react';
import {Compass} from 'lucide-react';
import {driver, type Driver, type DriveStep} from 'driver.js';
import 'driver.js/dist/driver.css';
import './tour.css';

export type GuideStep = {target: string; title: string; description: string; chapter: string; prepare?: () => void};

export function TourButton({steps, label = 'Take a tour', disabled = false, onEnd}: {
  steps: GuideStep[]; label?: string; disabled?: boolean; onEnd?: () => void;
}) {
  const active = useRef<Driver | null>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => () => {active.current?.destroy();}, []);

  function start() {
    if (active.current?.isActive()) return;
    const origin = {x: scrollX, y: scrollY};
    const inertElements = new Map<HTMLElement, boolean>();
    const visited = new Set<HTMLElement>();
    let transitioning = false;
    const restore = (element?: Element) => {
      if (element instanceof HTMLElement && inertElements.has(element)) {
        element.inert = inertElements.get(element)!;
        inertElements.delete(element);
      }
    };
    const tourSteps: DriveStep[] = steps.map(step => ({
      element: () => {
        step.prepare?.();
        return document.querySelector(step.target) || document.body;
      },
      popover: {title: step.title, description: step.description, side: 'bottom', align: 'start'},
      onHighlightStarted: element => {
        transitioning = true;
        if (element instanceof HTMLElement && element !== document.body) {
          visited.add(element);
          inertElements.set(element, element.inert);
          element.inert = true;
        }
      },
      onHighlighted: (_element, _step, {state, driver}) => {
        transitioning = false;
        if (state.popover) {
          state.popover.nextButton.disabled = false;
          state.popover.previousButton.disabled = driver.isFirstStep();
        }
      },
      onDeselected: restore,
    }));
    active.current = driver({
      steps: tourSteps,
      animate: !matchMedia('(prefers-reduced-motion: reduce)').matches,
      smoothScroll: false,
      overlayColor: '#061d24', overlayOpacity: .72, stagePadding: 8, stageRadius: 12,
      disableActiveInteraction: true, allowKeyboardControl: true, allowClose: true,
      overlayClickBehavior: () => {},
      showProgress: true, progressText: '{{current}} / {{total}}',
      nextBtnText: 'Next →', prevBtnText: 'Back', doneBtnText: 'Finish tour',
      popoverClass: 'shopibricks-tour',
      onNextClick: (_element, _step, {driver}) => {if (!transitioning) driver.isLastStep() ? driver.destroy() : driver.moveNext();},
      onPrevClick: (_element, _step, {driver}) => {if (!transitioning) driver.movePrevious();},
      onPopoverRender: (popover, {state}) => {
        const chapter = document.createElement('div');
        chapter.className = 'tour-chapter';
        chapter.textContent = steps[state.activeIndex || 0].chapter;
        popover.wrapper.prepend(chapter);
        popover.closeButton.setAttribute('aria-label', 'Exit tour');
        popover.nextButton.setAttribute('aria-label', (state.activeIndex || 0) === steps.length - 1 ? 'Finish tour' : 'Next tour step');
        popover.previousButton.setAttribute('aria-label', 'Previous tour step');
        popover.nextButton.disabled = transitioning;
        popover.previousButton.disabled = transitioning || !state.activeIndex;
      },
      onDestroyed: () => {
        for (const element of inertElements.keys()) restore(element);
        // Also clean up a highlight closed before Driver's animation completes.
        for (const element of visited) {
          element.classList.remove('driver-active-element', 'driver-no-interaction');
          for (const attribute of ['aria-haspopup', 'aria-expanded', 'aria-controls']) element.removeAttribute(attribute);
        }
        active.current = null;
        onEnd?.();
        trigger.current?.focus({preventScroll: true});
        requestAnimationFrame(() => {
          trigger.current?.focus({preventScroll: true});
          window.scrollTo({left: origin.x, top: origin.y, behavior: 'instant'});
        });
      },
    });
    active.current.drive();
  }

  return <button ref={trigger} aria-label={label} className="tour-button" onClick={start} disabled={disabled}><Compass size={16}/><span>{label}</span></button>;
}

export function demoTour(show: (tab: string) => void): GuideStep[] {
  const shop = () => show('Shop');
  const operations = () => show('Operations');
  const protocol = () => show('Protocol studio');
  return [
    {target: '.hero-cta', title: 'Your Paris story starts here.', description: 'Describe a weekend, a budget, or an idea. The concierge turns it into a collection you can explore.', chapter: '01 / DISCOVER', prepare: shop},
    {target: '.section-top', title: 'Find your next favourite.', description: 'Search the collection, then use the category filters below to narrow the selection. Prices include VAT.', chapter: '01 / DISCOVER', prepare: shop},
    {target: '.agent-roster', title: 'Five specialists, one conversation.', description: 'Watch the active agent as the concierge searches the catalog, checks stock, prepares checkout, or answers a merchant question.', chapter: '02 / CONVERSE', prepare: shop},
    {target: '.composer', title: 'Make it personal.', description: 'Ask for a kit under €250, compare two products, or request a draft checkout. Product cards appear in the conversation for your review.', chapter: '02 / CONVERSE', prepare: shop},
    {target: '.bag-button', title: 'Your bag. Your decision.', description: 'Add products, review quantities and delivery details, then approve the sandbox order yourself. Open the bag for a dedicated checkout guide.', chapter: '03 / CHECKOUT', prepare: shop},
    {target: '.metric-grid', title: 'See the merchant’s view.', description: 'These metrics read operational orders and current inventory from Lakebase. Each card shows its scope and source.', chapter: '04 / OPERATE', prepare: operations},
    {target: '.traffic-panel', title: 'Follow the streaming signals.', description: 'Synthetic traffic flows through Lakeflow and Delta. Inspect the query and freshness beneath the chart to see what is actually being read.', chapter: '04 / OPERATE', prepare: operations},
    {target: '.orders-panel', title: 'Every order has a paper trail.', description: 'An order link opens its saved receipt for the account that placed it. The receipt keeps the quantities and totals captured at checkout.', chapter: '04 / OPERATE', prepare: operations},
    {target: '.protocol-cards', title: 'OpenAI, governed by Databricks.', description: 'Inspect Unity Gateway status, the AG-UI and MCP integration, and the ACP sandbox. ChatGPT merchant onboarding remains a separate step.', chapter: '05 / UNDER THE HOOD', prepare: protocol},
    {target: '.protocol-log', title: 'See the actual handoffs.', description: 'Select a timeline event to inspect its payload. Agent runs and commerce actions generate these records; start a conversation if the timeline is empty.', chapter: '05 / UNDER THE HOOD', prepare: protocol},
    {target: '.persona-bar', title: 'Three sides of the same story.', description: 'Switch between shopper discovery, merchant growth and developer inspection. These are demo perspectives; your signed-in permissions stay the same.', chapter: '06 / EXPLORE PERSONAS', prepare: shop},
    {target: '.profile-section', title: 'A different person. A different possibility.', description: 'Four fictional profiles change interests, default budget, product ranking and agent context. Each profile keeps its own bag and conversation. Try a travel or gift specialist too.', chapter: '06 / EXPLORE PERSONAS', prepare: shop},
    {target: '.brand-studio', title: 'Bring your brand into the conversation.', description: 'Preview editorial, concise or playful language using live product facts. Your chosen voice also guides the agents in this browser session.', chapter: '07 / GROW YOUR BRAND', prepare: () => show('Growth studio:brand')},
    {target: '.distribution-panel', title: 'Understand channel readiness.', description: 'Inspect catalog completeness and export an internal feed. External AI platforms are clearly marked as not connected; the native storefront works here.', chapter: '07 / GROW YOUR BRAND', prepare: () => show('Growth studio:channels')},
    {target: '.intent-panel', title: 'See the language behind demand.', description: 'Explore interactive clusters, inspect catalog matches and gaps, and try a question in the storefront. Switch between clearly labeled fictional examples and your own recorded questions.', chapter: '07 / GROW YOUR BRAND', prepare: () => show('Growth studio:atlas')},
    {target: '.presentation-button', title: 'Ready for the Paris session.', description: 'Present mode makes the experience easier to read on stage. Replay this tour anytime, or explore freely. Laurent + Hatim, back to back.', chapter: '06 / TAKE THE STAGE', prepare: shop},
  ];
}

export const receiptTour: GuideStep[] = [
  {target: '.receipt-reference', title: 'An order you can come back to.', description: 'This reference identifies the saved order. Bookmark the page and reopen it with the same signed-in account.', chapter: 'YOUR SAVED ORDER'},
  {target: '.receipt-items', title: 'Exactly what you confirmed.', description: 'Quantities and line amounts come from the saved checkout. Changing catalog prices does not change this receipt.', chapter: 'YOUR COLLECTION'},
  {target: '.receipt-totals', title: 'Every amount accounted for.', description: 'Review the captured subtotal, VAT, delivery and final total. This sandbox receipt never represents a real payment.', chapter: 'YOUR TOTAL'},
  {target: '.receipt-delivery', title: 'The details stay with the order.', description: 'Your fictional customer and delivery details are saved here. Use Back to the collection when you are ready to explore again.', chapter: 'YOUR DETAILS'},
];
