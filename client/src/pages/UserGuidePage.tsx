import {
  MagnifyingGlass,
  MapTrifold,
  Clock,
  Bell,
  ChartLineUp,
  Lightbulb,
} from '@phosphor-icons/react';

export default function UserGuidePage() {
  const steps = [
    {
      step: '01',
      title: 'Find Buses by Origin & Destination',
      icon: MagnifyingGlass,
      color: 'text-[var(--primary-700)]',
      bg: 'bg-[var(--primary-100)]',
      desc: 'At the top of the Home page, use the dual search box to pick your Current Bus Stop and Destination Bus Stop. As you type, the system instantly autocompletes from over 2,000 official BMTC stops across Bengaluru.',
      tip: 'Click the swap button (⇄) in between to instantly reverse your journey direction!',
    },
    {
      step: '02',
      title: 'View Connecting Buses in Ascending Order of Arrival',
      icon: Clock,
      color: 'text-[var(--primary-700)]',
      bg: 'bg-[var(--primary-100)]',
      desc: 'The system queries all active BMTC routes and filters down to buses that service BOTH your boarding and destination stops in the correct direction. Buses appear ordered strictly by arrival time (soonest first), with live fare and crowding indicators.',
      tip: 'Use the filter pills to isolate AC (Vajra), Non-AC, or Electric buses.',
    },
    {
      step: '03',
      title: 'Click Any Bus to Inspect & Track on Map',
      icon: MapTrifold,
      color: 'text-[var(--primary-700)]',
      bg: 'bg-[var(--primary-100)]',
      desc: 'Clicking any bus row or map marker highlights that bus in glowing amber and slides open the Bus Details panel on the right. You will see its live coordinates, real-time speed (km/h), registration number, and stop-by-stop progress.',
      tip: 'The map camera automatically tracks the selected bus as it moves through traffic.',
    },
    {
      step: '04',
      title: 'Inspect 7-Day Historical Stop Arrivals',
      icon: Clock,
      color: 'text-[var(--primary-700)]',
      bg: 'bg-[var(--primary-100)]',
      desc: 'Inside the Bus Details panel, switch to the "Weekly Analysis" tab to see Monday through Sunday arrival history for EVERY stop along the route. Check on-time rates and average delay to see if your bus typically runs on schedule.',
      tip: 'Pick different days (Mon–Sun) to see how peak-hour congestion impacts arrival times.',
    },
    {
      step: '05',
      title: 'Set Proximity Arrival Alerts',
      icon: Bell,
      color: 'text-[var(--primary-700)]',
      bg: 'bg-[var(--primary-100)]',
      desc: 'Click "Notify Me When Approaching" and select your preferred warning threshold (2, 5, or 10 minutes). The app initiates a pulse alert when your bus crosses the threshold so you never miss your ride.',
      tip: 'Keep the tab open in your mobile browser while walking to the stop.',
    },
    {
      step: '06',
      title: 'Explore Route & Fleet Telemetry in Analytics',
      icon: ChartLineUp,
      color: 'text-[var(--primary-700)]',
      bg: 'bg-[var(--primary-100)]',
      desc: 'Head over to the Analytics page in the top nav to search any bus or route. View real-time telemetry metrics, delay distribution, and interactive charts comparing scheduled ETA vs actual arrival times across every stop.',
      tip: 'Hover over chart points to see precise delay differences in minutes.',
    },
  ];

  const faqs = [
    {
      q: 'Why does the app ask for location access?',
      a: 'If allowed, the app uses your device GPS to automatically detect your nearest bus stop in Bengaluru (e.g. Electronic City or Majestic), saving you typing time.',
    },
    {
      q: 'Are the bus positions real?',
      a: 'The application runs a high-throughput digital twin simulation that models actual BMTC bus routes, speeds, and GPS telemetry according to Bengaluru road geography.',
    },
    {
      q: 'How is the BMTC fare calculated?',
      a: 'Fare is dynamically estimated using official BMTC stage distances (₹5–₹35 for non-AC, up to ₹110 for AC Vajra services) calculated along the actual route path.',
    },
  ];

  return (
    <div className="min-h-screen bg-[var(--paper)] text-[var(--text)] pt-24 pb-24 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-16">
        {/* Header */}
        <div className="space-y-4 max-w-2xl">
          <h1 className="text-2xl sm:text-3xl text-[var(--text)]">
            User Guide & How to Use
          </h1>
          <p className="text-[var(--text-2)] text-md">
            Master the Bengaluru Bus Twin in 6 simple steps. Plan trips, track live arrivals, and inspect transit performance effortlessly.
          </p>
        </div>

        {/* Steps List */}
        <div className="space-y-6">
          {steps.map((s, idx) => (
            <div
              key={idx}
              className="p-6 rounded-[var(--r-lg)] panel-surface dots flex flex-col sm:flex-row gap-5 items-start"
            >
              <div className="flex sm:flex-col items-center gap-3 shrink-0">
                <span className="text-xs tabular-nums font-bold text-[var(--text-3)]">
                  STEP {s.step}
                </span>
                <div className={`w-12 h-12 rounded-[var(--r-md)] ${s.bg} ${s.color} flex items-center justify-center`}>
                  <s.icon size={26} weight="duotone" />
                </div>
              </div>

              <div className="flex-1 space-y-2">
                <h3 className="text-base sm:text-lg font-bold text-[var(--text)]">
                  {s.title}
                </h3>
                <p className="text-sm text-[var(--text-2)] leading-relaxed">
                  {s.desc}
                </p>
                <div className="flex items-center gap-2 pt-1 text-xs font-medium text-[var(--primary-700)] bg-[var(--primary-50)] px-3 py-2 rounded-lg w-fit">
                  <Lightbulb size={16} weight="fill" className="shrink-0" />
                  <span>Pro Tip: {s.tip}</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Frequently Asked Questions */}
        <div className="space-y-4 pt-4 border-t border-[var(--border)]">
          <h2 className="text-xl font-bold text-[var(--text)]">
            Frequently Asked Questions
          </h2>
          <div className="space-y-3">
            {faqs.map((faq, i) => (
              <div
                key={i}
                className="p-4 rounded-[var(--r-md)] panel-surface"
              >
                <h4 className="text-sm font-bold text-[var(--text)] mb-1">
                  {faq.q}
                </h4>
                <p className="text-xs sm:text-sm text-[var(--text-2)]">
                  {faq.a}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
