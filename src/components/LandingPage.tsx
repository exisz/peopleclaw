export default function LandingPage({ onLaunchApp }: { onLaunchApp: () => void }) {
  return (
    <div className="min-h-screen bg-[#0f0f23] text-white">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-4 max-w-6xl mx-auto">
        <div className="flex items-center gap-2 text-xl font-bold">
          <span className="text-2xl">🐾</span>
          <span>PeopleClaw</span>
        </div>
        <button
          onClick={onLaunchApp}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-sm font-medium transition-colors cursor-pointer"
        >
          Launch App
        </button>
      </nav>

      {/* Hero */}
      <section className="max-w-4xl mx-auto px-6 pt-20 pb-16 text-center">
        <h1 className="text-5xl md:text-6xl font-bold leading-tight mb-6">
          Workflows that put{' '}
          <span className="bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
            people first
          </span>
        </h1>
        <p className="text-lg md:text-xl text-gray-400 max-w-2xl mx-auto mb-10">
          Design business workflows visually. AI assists at every step, but humans approve what matters.
          Built for SMEs and the freelancer ITs who support them.
        </p>
        <div className="flex gap-4 justify-center">
          <button
            onClick={onLaunchApp}
            className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 rounded-lg font-medium transition-colors cursor-pointer text-lg"
          >
            Try the Demo →
          </button>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-5xl mx-auto px-6 py-16">
        <div className="grid md:grid-cols-3 gap-8">
          {[
            {
              icon: '🔀',
              title: 'Visual Workflow Builder',
              desc: 'Drag-and-drop canvas powered by XYFlow. Define human steps, AI steps, subflows, and triggers.',
            },
            {
              icon: '🧑‍⚖️',
              title: 'Human-in-the-Loop',
              desc: 'AI handles the heavy lifting. Humans approve at key decision points. Full audit trail for every case.',
            },
            {
              icon: '🏢',
              title: 'Multi-Tenant Ready',
              desc: 'Freelancer ITs manage workflows for multiple client organizations from a single dashboard.',
            },
            {
              icon: '📋',
              title: 'Case Tracking',
              desc: 'Every workflow run is a tracked case with step-by-step progress, notes, and status history.',
            },
            {
              icon: '⚡',
              title: 'AI-Powered Steps',
              desc: 'Integrate LLM calls, tool invocations, and automated actions directly into your workflows.',
            },
            {
              icon: '🔒',
              title: 'Approval Gates',
              desc: 'Pause workflows at critical points. Notify the right person. Wait for their decision before continuing.',
            },
          ].map((f) => (
            <div key={f.title} className="bg-[#1a1a2e] border border-gray-800 rounded-xl p-6">
              <div className="text-3xl mb-3">{f.icon}</div>
              <h3 className="text-lg font-semibold mb-2">{f.title}</h3>
              <p className="text-gray-400 text-sm leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-4xl mx-auto px-6 py-16 text-center">
        <h2 className="text-3xl font-bold mb-4">Ready to automate your workflows?</h2>
        <p className="text-gray-400 mb-8">Start with the interactive demo — no signup required.</p>
        <button
          onClick={onLaunchApp}
          className="px-8 py-3 bg-indigo-600 hover:bg-indigo-500 rounded-lg font-medium transition-colors cursor-pointer text-lg"
        >
          Launch PeopleClaw →
        </button>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-800 py-8 text-center text-gray-500 text-sm">
        © {new Date().getFullYear()} PeopleClaw. People-centric workflow automation.
      </footer>
    </div>
  );
}
