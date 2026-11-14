import {
  Bus,
  MapPin,
  Clock,
  Snowflake,
  CurrencyInr,
  IdentificationCard,
  ChartLineUp,
  Bell,
  CalendarCheck,
  Broadcast,
  GearSix,
  Database,
  Eye,
  Info,
  XCircle,
  CheckCircle,
} from '@phosphor-icons/react';

const stats = [
  { value: '600', label: 'buses on the map' },
  { value: '80', label: 'route directions' },
  { value: '138', label: 'bus stops' },
  { value: '1 sec', label: 'between position updates' },
];

const journey = [
  {
    icon: Broadcast,
    title: 'Buses report in',
    desc: 'Every bus sends its position and speed once a second, the way a real GPS tracker on a BMTC bus would.',
  },
  {
    icon: GearSix,
    title: 'We make sense of it',
    desc: 'The app works out where each bus is along its route, how fast it is going, and when it will reach every stop ahead.',
  },
  {
    icon: Database,
    title: 'We remember it',
    desc: 'Arrivals and delays are saved in a database, which is how the app can tell you how a bus usually behaves through the week.',
  },
  {
    icon: Eye,
    title: 'You see it live',
    desc: 'Only the buses you care about are sent to your screen, so the map moves smoothly even on a slow phone connection.',
  },
];

const features = [
  {
    icon: MapPin,
    title: 'Every bus on one map',
    desc: 'Open the Map page and the whole fleet is moving in front of you. Zoom into your neighbourhood, tap a bus, and follow it as it travels.',
  },
  {
    icon: Clock,
    title: 'Buses between your two stops',
    desc: 'Pick where you are and where you are going. The app lists only the buses that stop at both places, in the right direction, soonest first. The minutes count down on their own, so there is no refreshing.',
  },
  {
    icon: Snowflake,
    title: 'Filters for how you like to travel',
    desc: 'Narrow the list to AC, Non-AC or Electric buses, hide crowded ones, or show only buses arriving within 10 minutes.',
  },
  {
    icon: CurrencyInr,
    title: 'Fare before you board',
    desc: 'The ticket price is estimated from the distance between your stops and the type of bus, and shown right next to the arrival time.',
  },
  {
    icon: IdentificationCard,
    title: 'A profile for every bus',
    desc: 'Each bus has its own record: registration number, depot, seating capacity and type. Tap any bus to see it.',
  },
  {
    icon: Bell,
    title: 'A heads-up when it is close',
    desc: 'Choose to be alerted 2, 5 or 10 minutes before your bus arrives. A tracking bar keeps the countdown on screen while you walk to the stop.',
  },
  {
    icon: CalendarCheck,
    title: 'How the bus did this week',
    desc: 'For any bus, see its arrival time at every stop for each day of the week, plus how often it is on time and how late it tends to run.',
  },
  {
    icon: ChartLineUp,
    title: 'Analytics from the live data',
    desc: 'The Analytics page turns the stream of positions into charts: scheduled versus actual arrival times, delay at each stop, and fleet-wide speed and punctuality.',
  },
];


const lateCosts = [
  'A half-day of pay cut, or a warning from the manager, for arriving late again.',
  'A missed meeting, a missed exam, or a missed shift.',
  'An expensive auto or cab ride taken in panic, which eats into a month\u2019s budget.',
  'Standing at a roadside in the dark or the rain, not knowing if the bus is coming.',
];

const whoBenefits = [
  { title: 'Office-goers', desc: 'Leave home at the right minute, not 40 minutes early just to be safe.' },
  { title: 'Students', desc: 'Reach class and exams on time without guessing at the schedule.' },
  { title: 'Daily-wage workers', desc: 'A late bus can mean a lost day\u2019s earnings. Knowing helps you decide in time.' },
  { title: 'Elders and women travelling early or late', desc: 'Spend less time waiting alone at a stop, and walk there only when the bus is close.' },
  { title: 'Newcomers and visitors', desc: 'No need to know the routes by heart. Pick your two stops and the app does the rest.' },
];

const morning = {
  without: [
    { t: '8:05', e: 'You reach the stop and start waiting. You have no idea when the next bus is due.' },
    { t: '8:30', e: 'Still waiting. Then two buses arrive together, and the first is too packed to board.' },
    { t: '9:35', e: 'You reach the office late, stressed and out of breath.' },
  ],
  with: [
    { t: '7:55', e: 'You check the app at home. Your bus is 18 minutes away, so you finish breakfast.' },
    { t: '8:08', e: 'You get the alert you set, 5 minutes before arrival, and walk to the stop.' },
    { t: '8:14', e: 'You pick the less crowded bus, already knowing the fare. You arrive on time.' },
  ],
};

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-[var(--paper)] text-[var(--text)] pt-24 pb-24 px-4 sm:px-6 lg:px-8">
      <style>{`
        @keyframes twin-drive { from { left: -6%; } to { left: 104%; } }
        .twin-bus { position: absolute; top: 50%; transform: translateY(-50%); animation: twin-drive linear infinite; }
        @media (prefers-reduced-motion: reduce) {
          .twin-bus { animation: none; left: var(--rest); }
        }
      `}</style>

      <div className="max-w-5xl mx-auto space-y-20">
        {/* Hero */}
        <header className="space-y-8">
          <div className="space-y-4 max-w-3xl">
            <p className="text-sm font-medium text-[var(--primary-700)]">
              MERNIFY Hackathon 2026
            </p>
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight leading-tight">
              Know where your bus is before you leave home.
            </h1>
            <p className="text-md text-[var(--text-2)] leading-relaxed max-w-2xl">
              Bengaluru BusDekho is a live map of the city&rsquo;s BMTC buses. Tell it where you are and where you
              want to go, and it shows which buses will take you there and how many minutes each one is away,
              updated every second.
            </p>
          </div>

          {/* Signature: buses driving along a route */}
          <div
            className="relative h-24 rounded-[var(--r-lg)] panel-surface dots overflow-hidden"
            role="img"
            aria-label="Illustration of buses moving along a route between bus stops"
          >
            <div className="absolute left-0 right-0 top-1/2 h-1.5 -translate-y-1/2 bg-[var(--sage-200)]" />
            {[8, 27, 46, 65, 84].map((p) => (
              <span
                key={p}
                className="absolute top-1/2 w-4 h-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--surface)] border-[3px] border-[var(--primary-600)]"
                style={{ left: `${p}%` }}
              />
            ))}
            {[
              { dur: '14s', delay: '-2s', rest: '18%', hot: false },
              { dur: '14s', delay: '-9s', rest: '57%', hot: true },
              { dur: '14s', delay: '-12s', rest: '82%', hot: false },
            ].map((b, i) => (
              <span
                key={i}
                className="twin-bus"
                style={{ animationDuration: b.dur, animationDelay: b.delay, ['--rest' as string]: b.rest }}
              >
                <span
                  className={`flex items-center justify-center w-9 h-9 rounded-[var(--r-md)] shadow-[var(--shadow-panel)] ${b.hot ? 'bg-[var(--amber-500)] text-[var(--on-amber)]' : 'bg-[var(--ink)] text-[var(--on-ink)]'
                    }`}
                >
                  <Bus size={20} weight="fill" aria-hidden="true" />
                </span>
              </span>
            ))}
          </div>
        </header>

        {/* What it is */}
        <section className="grid md:grid-cols-5 gap-8 md:gap-12">
          <h2 className="md:col-span-2 text-2xl font-bold tracking-tight">
            Waiting is the hard part of taking a bus.
          </h2>
          <div className="md:col-span-3 space-y-4 text-[var(--text-2)] leading-relaxed">
            <p>
              Over 50 lakh people in Bengaluru ride buses every day, and many spend 25 to 40 minutes at a stop
              not knowing whether the next bus is two minutes away or twenty. Traffic makes timetables unreliable,
              so a printed schedule does not help much.
            </p>
            <p>
              BusDekho is a &ldquo;digital twin&rdquo; of the BMTC network: a living copy of the city&rsquo;s buses on
              a screen. Each bus moves along its real route, at a realistic speed, and the app keeps calculating when
              it will reach each stop. You get an answer you can plan around, and you can see the bus coming.
            </p>
            <p>
              It is also built to handle a lot at once. Hundreds of buses report their position every second, and
              the app keeps up with all of them while showing each person only what they asked to see.
            </p>
          </div>
        </section>

        {/* Impact */}
        <section className="space-y-10" aria-labelledby="impact-title">
          <div className="max-w-3xl space-y-3">
            <h2 id="impact-title" className="text-2xl sm:text-3xl font-bold tracking-tight">
              Missing the bus should not cost you your day.
            </h2>
            <p className="text-[var(--text-2)] leading-relaxed">
              For lakhs of Bengaluru commuters, the bus is not a choice, it is the only way to reach work, college or
              home. Buses get stuck in traffic and arrive in bunches, and a timetable cannot warn you. So people leave
              early &ldquo;just in case&rdquo;, wait at the stop with no information, and still end up late. When
              a bus is missed, someone pays for it.
            </p>
          </div>

          <div className="grid lg:grid-cols-2 gap-4">
            <div className="p-6 rounded-[var(--r-lg)] panel-surface space-y-4">
              <h3 className="flex items-center gap-2 font-bold text-[var(--red-600)]">
                <XCircle size={22} weight="fill" aria-hidden="true" />
                A morning without live information
              </h3>
              <ol className="space-y-3">
                {morning.without.map((m) => (
                  <li key={m.t} className="flex gap-3 text-sm leading-relaxed">
                    <span className="shrink-0 w-12 font-semibold tabular-nums text-[var(--text-3)]">{m.t}</span>
                    <span className="text-[var(--text-2)]">{m.e}</span>
                  </li>
                ))}
              </ol>
            </div>
            <div className="p-6 rounded-[var(--r-lg)] panel-surface space-y-4 border-[var(--primary-600)]">
              <h3 className="flex items-center gap-2 font-bold text-[var(--primary-700)]">
                <CheckCircle size={22} weight="fill" aria-hidden="true" />
                The same morning with BusDekho
              </h3>
              <ol className="space-y-3">
                {morning.with.map((m) => (
                  <li key={m.t} className="flex gap-3 text-sm leading-relaxed">
                    <span className="shrink-0 w-12 font-semibold tabular-nums text-[var(--text-3)]">{m.t}</span>
                    <span className="text-[var(--text-2)]">{m.e}</span>
                  </li>
                ))}
              </ol>
            </div>
          </div>
          <p className="text-xs text-[var(--text-3)] -mt-6">An illustrative example. Times will vary by route and traffic.</p>

          <div className="grid md:grid-cols-2 gap-10">
            <div className="space-y-4">
              <h3 className="text-lg font-bold">What a late arrival really costs</h3>
              <ul className="space-y-3">
                {lateCosts.map((c) => (
                  <li key={c} className="flex gap-3 text-sm sm:text-base text-[var(--text-2)] leading-relaxed">
                    <span className="mt-2 w-1.5 h-1.5 rounded-full bg-[var(--red-600)] shrink-0" aria-hidden="true" />
                    {c}
                  </li>
                ))}
              </ul>
              <p className="text-sm sm:text-base leading-relaxed">
                BusDekho gives that time back. Even ten minutes of certainty each morning adds up to hours every
                month, and to far less worry.
              </p>
            </div>
            <div className="space-y-4">
              <h3 className="text-lg font-bold">Who it is for</h3>
              <ul className="space-y-3">
                {whoBenefits.map((w) => (
                  <li key={w.title} className="text-sm sm:text-base leading-relaxed">
                    <span className="font-semibold">{w.title}. </span>
                    <span className="text-[var(--text-2)]">{w.desc}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* Numbers */}
        <section aria-label="The network at a glance">
          <dl className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {stats.map((s) => (
              <div key={s.label} className="p-5 rounded-[var(--r-lg)] panel-surface">
                <dt className="order-2 text-sm text-[var(--text-2)] mt-1">{s.label}</dt>
                <dd className="text-3xl font-bold tabular-nums tracking-tight text-[var(--primary-700)]">{s.value}</dd>
              </div>
            ))}
          </dl>
        </section>

        {/* How it works */}
        <section className="space-y-8">
          <div className="max-w-2xl space-y-2">
            <h2 className="text-2xl font-bold tracking-tight">How it works, in plain words</h2>
            <p className="text-[var(--text-2)]">
              From a bus on the road to a number on your phone takes four steps, and it repeats every second.
            </p>
          </div>

          <ol className="grid md:grid-cols-4 gap-4">
            {journey.map((j, i) => (
              <li key={j.title} className="relative p-5 rounded-[var(--r-lg)] panel-surface space-y-3">
                <div className="flex items-center justify-between">
                  <span className="w-11 h-11 rounded-[var(--r-md)] bg-[var(--primary-100)] text-[var(--primary-700)] flex items-center justify-center">
                    <j.icon size={24} weight="duotone" aria-hidden="true" />
                  </span>
                  <span className="text-sm tabular-nums font-semibold text-[var(--text-3)]">{i + 1} of 4</span>
                </div>
                <h3 className="font-bold">{j.title}</h3>
                <p className="text-sm text-[var(--text-2)] leading-relaxed">{j.desc}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* Features */}
        <section className="space-y-8">
          <div className="max-w-2xl space-y-2">
            <h2 className="text-2xl font-bold tracking-tight">What you can do with it</h2>
            <p className="text-[var(--text-2)]">
              Everything below is live. The numbers change as the buses move.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            {features.map((f) => (
              <article
                key={f.title}
                className="p-6 rounded-[var(--r-lg)] panel-surface dots flex gap-4 items-start"
              >
                <span className="shrink-0 w-11 h-11 rounded-[var(--r-md)] bg-[var(--primary-100)] text-[var(--primary-700)] flex items-center justify-center">
                  <f.icon size={24} weight="duotone" aria-hidden="true" />
                </span>
                <div className="space-y-1.5">
                  <h3 className="font-bold text-base">{f.title}</h3>
                  <p className="text-sm text-[var(--text-2)] leading-relaxed">{f.desc}</p>
                </div>
              </article>
            ))}
          </div>
        </section>

        {/* Honest note */}
        <section className="p-6 rounded-[var(--r-lg)] bg-[var(--amber-100)] text-[var(--text)] flex gap-4 items-start">
          <Info size={26} weight="fill" className="shrink-0 text-[var(--amber-500)] mt-0.5" aria-hidden="true" />
          <div className="space-y-1.5">
            <h2 className="font-bold">About the buses you see</h2>
            <p className="text-sm leading-relaxed">
              BMTC does not publish a public live GPS feed, so the bus movements here are simulated. The routes,
              stops and road paths are real Bengaluru data, and each simulated bus drives along them the way a
              real one would. Treat this as a working prototype, not an official timetable.
            </p>
          </div>
        </section>

        {/* Closing */}
        <section className="p-8 sm:p-10 rounded-[var(--r-lg)] bg-[var(--primary-700)] text-[var(--on-primary)] space-y-3">
          <h2 className="text-xl font-bold">Why it matters</h2>
          <p className="opacity-90 leading-relaxed max-w-3xl">
            A bus ride is a small part of the day, but being late because of it can spoil the rest. BusDekho gives
            riders certainty: when to leave, which bus to take and what it will cost. For the people who run the
            buses, the same data shows where delays build up, so buses can be put where they are needed. Fewer missed
            buses means fewer missed meetings, calmer mornings and more trust in public transport.
          </p>
        </section>
      </div>
    </div>
  );
}