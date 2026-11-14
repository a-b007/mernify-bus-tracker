import { Link } from 'react-router-dom';
import {
  MapPin,
  MagnifyingGlass,
  Funnel,
  Bus,
  CalendarCheck,
  Bell,
  ChartLineUp,
  Crosshair,
  Moon,
  Lightbulb,
  CaretDown,
} from '@phosphor-icons/react';

type Section = {
  id: string;
  icon: typeof MapPin;
  title: string;
  intro: string;
  steps: string[];
  tip?: string;
  link?: { to: string; label: string };
};

const sections: Section[] = [
  {
    id: 'start',
    icon: MapPin,
    title: 'Start from where you are',
    intro: 'The Map page opens on Bengaluru with all buses moving. A card asks where you are.',
    steps: [
      'Tap Use my location to let the app find the stops closest to you. Your browser will ask for permission first.',
      'Or tap Search a place or bus stop and type a name such as Majestic or Electronic City.',
      'Or tap Just show me the map to look around on your own.',
    ],
    tip: 'Location is only requested after you tap the button, never when the page loads. If you are outside Bengaluru, the map shows Majestic instead.',
  },
  {
    id: 'plan',
    icon: MagnifyingGlass,
    title: 'Find buses between two stops',
    intro: 'Use the two boxes at the top of the panel to say where you are and where you are going.',
    steps: [
      'In the first box, type your boarding stop. Matching stops appear as you type, so pick one from the list.',
      'In the second box, type your destination stop and pick it.',
      'The panel fills with every bus that serves both stops, in the right direction, with the soonest first.',
    ],
    tip: 'Use the swap button between the boxes to reverse your trip. Use the small clear button inside a box to start over.',
  },
  {
    id: 'read',
    icon: Bus,
    title: 'Read a bus in the list',
    intro: 'Each row tells you what you need at a glance.',
    steps: [
      'Route number and where the bus is heading, on the left.',
      'Bus type, how crowded it is likely to be, and your walking time to the stop.',
      'On the right, minutes until it arrives (shown as Due when it is at the stop) and the estimated fare.',
      'Buses you cannot reach in time are shown faded, so you can ignore them.',
    ],
    tip: 'The minutes count down by themselves. You never need to refresh the page.',
  },
  {
    id: 'filters',
    icon: Funnel,
    title: 'Filter the list',
    intro: 'The row of pills above the list narrows down what you see. Tap a pill to turn it on, tap again to turn it off.',
    steps: [
      'AC, Non-AC or Electric: choose the kind of bus you want.',
      'Not crowded: hide buses likely to be packed.',
      'Within 10 min: show only buses that are close.',
    ],
    tip: 'You can combine pills. AC plus Within 10 min shows only air-conditioned buses arriving soon.',
  },
  {
    id: 'detail',
    icon: Crosshair,
    title: 'Follow one bus on the map',
    intro: 'Tap a row in the list, or tap a bus on the map. Both open the same details panel, and the map follows that bus.',
    steps: [
      'The Live tab shows minutes to arrival, current speed, distance from your stop, and the route from start to end with its length and number of stops.',
      'Open Vehicle details to see the registration number, depot, seating capacity and bus type.',
      'Use the back arrow or the close button to return to the list.',
    ],
    tip: 'Use the plus and minus buttons at the bottom right of the map to zoom, and the target button to jump back to your location.',
  },
  {
    id: 'week',
    icon: CalendarCheck,
    title: 'Check how the bus did this week',
    intro: 'In the details panel, switch from Live to This week to see whether this bus is usually reliable.',
    steps: [
      'Tap a day, Monday to Sunday.',
      'Read the summary: how often it is on time, how late it runs on average, and how often it comes.',
      'Scroll the stop list to see that day\u2019s arrival time at every stop. Your boarding stop is marked.',
    ],
    tip: 'Compare a weekday rush hour with a Sunday to see how much traffic changes things.',
  },
  {
    id: 'alert',
    icon: Bell,
    title: 'Get alerted before it arrives',
    intro: 'Do not stand at the stop watching the road. Let the app tell you when to start walking.',
    steps: [
      'Open a bus and tap Notify me when it\u2019s close.',
      'Choose how early you want the alert: 2, 5 or 10 minutes before arrival.',
      'Tap to confirm. A tracking bar stays on screen with the route and the countdown, even while you explore the map.',
      'Tap the close button on the bar to stop tracking.',
    ],
    tip: 'Keep the tab open on your phone while you walk. Choose 10 minutes if the stop is a long walk away.',
  },
  {
    id: 'analytics',
    icon: ChartLineUp,
    title: 'Explore the Analytics page',
    intro: 'For the bigger picture, open Analytics from the menu at the top right.',
    steps: [
      'Check the summary cards: buses running, updates received per second, average speed and on-time rate.',
      'Pick a route or a bus to see its details.',
      'Read the two charts: scheduled versus actual arrival time, and how much delay builds up at each stop.',
      'Scroll to the table for every stop with its distance, scheduled time and status.',
    ],
    tip: 'Hover over a point on a chart to see the exact figure.',
    link: { to: '/analytics', label: 'Open Analytics' },
  },
  {
    id: 'theme',
    icon: Moon,
    title: 'Switch between light and dark',
    intro: 'Use the sun or moon button in the menu at the top right.',
    steps: [
      'Tap it once to switch theme. The map changes along with the page.',
    ],
    tip: 'Dark mode is easier on the eyes at night and on phone batteries.',
  },
];

const faqs = [
  {
    q: 'Are these real buses?',
    a: 'The bus movements are simulated, because BMTC does not offer a public live feed. The routes, stops and roads are real, and every bus follows its real route at a realistic speed. A \u201cDemo data\u201d note on the map reminds you of this.',
  },
  {
    q: 'Why do you ask for my location?',
    a: 'Only to find the bus stops near you, so you do not have to type. You can skip it and search for a stop by name.',
  },
  {
    q: 'How is the fare worked out?',
    a: 'It is estimated from the distance between your two stops and the type of bus: Non-AC, AC or Electric. Treat it as a guide. The conductor\u2019s ticket is what counts.',
  },
  {
    q: 'No buses appear for my two stops. What now?',
    a: 'No simulated bus connects them directly, or a filter is hiding them. Turn off the filter pills first. If the list is still empty, try a nearby stop or swap your boarding stop for a bigger interchange.',
  },
  {
    q: 'How accurate are the arrival times?',
    a: 'They are recalculated every second from the bus\u2019s current position and speed. They are most accurate for buses close to you and less certain for buses far away.',
  },
];

export default function UserGuidePage() {
  return (
    <div className="min-h-screen bg-[var(--paper)] text-[var(--text)] pt-24 pb-24 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto">
        <header className="space-y-4 max-w-2xl mb-12">
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight leading-tight">How to use BusDekho</h1>
          <p className="text-md text-[var(--text-2)] leading-relaxed">
            A walkthrough of every feature, from finding your first bus to checking how it has run all week. Each
            section is short, so jump to the one you need.
          </p>
        </header>

        <div className="lg:grid lg:grid-cols-[220px_1fr] lg:gap-12">
          {/* Contents */}
          <nav aria-label="On this page" className="mb-10 lg:mb-0">
            <div className="lg:sticky lg:top-24">
              <p className="text-sm font-bold mb-3">On this page</p>
              <ul className="flex lg:flex-col gap-1 overflow-x-auto no-scrollbar -mx-1 px-1 pb-1">
                {sections.map((s) => (
                  <li key={s.id} className="shrink-0">
                    <a
                      href={`#${s.id}`}
                      className="flex items-center gap-2 h-9 px-3 rounded-[var(--r-md)] text-sm text-[var(--text-2)] whitespace-nowrap hover:bg-[var(--surface-2)] hover:text-[var(--text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--primary-600)]"
                    >
                      <s.icon size={16} aria-hidden="true" />
                      {s.title.split(' ').slice(0, 3).join(' ')}
                    </a>
                  </li>
                ))}
                <li className="shrink-0">
                  <a
                    href="#faq"
                    className="flex items-center gap-2 h-9 px-3 rounded-[var(--r-md)] text-sm text-[var(--text-2)] whitespace-nowrap hover:bg-[var(--surface-2)] hover:text-[var(--text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--primary-600)]"
                  >
                    <Lightbulb size={16} aria-hidden="true" />
                    Common questions
                  </a>
                </li>
              </ul>
            </div>
          </nav>

          {/* Sections */}
          <main className="space-y-6 min-w-0">
            {sections.map((s) => (
              <section
                key={s.id}
                id={s.id}
                className="scroll-mt-24 p-6 sm:p-7 rounded-[var(--r-lg)] panel-surface dots space-y-5"
              >
                <div className="flex items-start gap-4">
                  <span className="shrink-0 w-12 h-12 rounded-[var(--r-md)] bg-[var(--primary-100)] text-[var(--primary-700)] flex items-center justify-center">
                    <s.icon size={26} weight="duotone" aria-hidden="true" />
                  </span>
                  <div className="space-y-1">
                    <h2 className="text-lg sm:text-xl font-bold tracking-tight">{s.title}</h2>
                    <p className="text-sm sm:text-base text-[var(--text-2)] leading-relaxed max-w-prose">{s.intro}</p>
                  </div>
                </div>

                <ol className="space-y-3 sm:pl-16">
                  {s.steps.map((step, i) => (
                    <li key={i} className="flex gap-3 text-sm sm:text-base leading-relaxed">
                      <span className="shrink-0 w-6 h-6 mt-0.5 rounded-full bg-[var(--surface-2)] border border-[var(--border)] text-xs font-semibold tabular-nums text-[var(--text-2)] flex items-center justify-center">
                        {i + 1}
                      </span>
                      <span className="max-w-prose">{step}</span>
                    </li>
                  ))}
                </ol>

                {(s.tip || s.link) && (
                  <div className="sm:pl-16 flex flex-col sm:flex-row sm:items-center gap-3">
                    {s.tip && (
                      <p className="flex items-start gap-2 text-sm text-[var(--text)] bg-[var(--amber-100)] px-3 py-2.5 rounded-[var(--r-md)] max-w-prose">
                        <Lightbulb size={18} weight="fill" className="shrink-0 mt-0.5 text-[var(--amber-500)]" aria-hidden="true" />
                        <span>{s.tip}</span>
                      </p>
                    )}
                    {s.link && (
                      <Link to={s.link.to} className="btn btn-secondary btn-sm w-fit">
                        {s.link.label}
                      </Link>
                    )}
                  </div>
                )}
              </section>
            ))}

            {/* FAQ */}
            <section id="faq" className="scroll-mt-24 pt-6 space-y-4">
              <h2 className="text-xl font-bold tracking-tight">Common questions</h2>
              <div className="space-y-2">
                {faqs.map((f) => (
                  <details key={f.q} className="group rounded-[var(--r-md)] panel-surface">
                    <summary className="flex items-center justify-between gap-4 cursor-pointer list-none px-4 py-3.5 font-semibold text-sm sm:text-base">
                      {f.q}
                      <CaretDown
                        size={18}
                        className="shrink-0 text-[var(--text-3)] transition-transform duration-[var(--dur-2)] group-open:rotate-180"
                        aria-hidden="true"
                      />
                    </summary>
                    <p className="px-4 pb-4 text-sm sm:text-base text-[var(--text-2)] leading-relaxed max-w-prose">{f.a}</p>
                  </details>
                ))}
              </div>
            </section>
          </main>
        </div>
      </div>
    </div>
  );
}