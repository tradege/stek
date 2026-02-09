'use client';
import Link from 'next/link';
import MainLayout from '@/components/layout/MainLayout';

const sportsCategories = [
  { 
    name: 'Football', 
    icon: '⚽', 
    matches: 142, 
    leagues: ['Premier League', 'La Liga', 'Champions League', 'Bundesliga'],
    color: 'from-green-500/20 to-green-600/10',
    borderColor: 'border-green-500/30'
  },
  { 
    name: 'Basketball', 
    icon: '🏀', 
    matches: 89, 
    leagues: ['NBA', 'EuroLeague', 'NCAA', 'FIBA'],
    color: 'from-orange-500/20 to-orange-600/10',
    borderColor: 'border-orange-500/30'
  },
  { 
    name: 'Tennis', 
    icon: '🎾', 
    matches: 56, 
    leagues: ['ATP Tour', 'WTA Tour', 'Grand Slams', 'Davis Cup'],
    color: 'from-yellow-500/20 to-yellow-600/10',
    borderColor: 'border-yellow-500/30'
  },
  { 
    name: 'eSports', 
    icon: '🎮', 
    matches: 203, 
    leagues: ['CS2', 'League of Legends', 'Dota 2', 'Valorant'],
    color: 'from-purple-500/20 to-purple-600/10',
    borderColor: 'border-purple-500/30'
  },
  { 
    name: 'MMA / UFC', 
    icon: '🥊', 
    matches: 24, 
    leagues: ['UFC', 'Bellator', 'ONE Championship', 'PFL'],
    color: 'from-red-500/20 to-red-600/10',
    borderColor: 'border-red-500/30'
  },
  { 
    name: 'Racing', 
    icon: '🏎️', 
    matches: 18, 
    leagues: ['Formula 1', 'NASCAR', 'MotoGP', 'WRC'],
    color: 'from-blue-500/20 to-blue-600/10',
    borderColor: 'border-blue-500/30'
  },
];

export default function SportsPage() {
  return (
    <MainLayout>
    <div className="min-h-screen p-4 lg:p-8">
      {/* Hero Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-accent-primary/20 via-purple-600/10 to-blue-600/10 border border-accent-primary/20 p-8 lg:p-12 mb-8">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMjAiIGN5PSIyMCIgcj0iMSIgZmlsbD0icmdiYSgyNTUsMjU1LDI1NSwwLjAzKSIvPjwvc3ZnPg==')] opacity-50" />
        <div className="relative z-10 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-accent-primary/20 rounded-full mb-4">
            <span className="w-2 h-2 bg-accent-primary rounded-full animate-pulse" />
            <span className="text-accent-primary text-sm font-semibold">COMING SOON</span>
          </div>
          <h1 className="text-4xl lg:text-5xl font-bold text-white mb-4">
            Sports Betting
          </h1>
          <p className="text-lg text-text-secondary max-w-2xl mx-auto mb-6">
            Get ready for the ultimate sports betting experience. Live odds, in-play betting, 
            and thousands of markets across all major sports.
          </p>
          <div className="flex items-center justify-center gap-6 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-2xl">🏆</span>
              <div>
                <p className="text-white font-semibold">500+</p>
                <p className="text-text-secondary">Events Daily</p>
              </div>
            </div>
            <div className="w-px h-10 bg-white/10" />
            <div className="flex items-center gap-2">
              <span className="text-2xl">⚡</span>
              <div>
                <p className="text-white font-semibold">Live</p>
                <p className="text-text-secondary">In-Play Betting</p>
              </div>
            </div>
            <div className="w-px h-10 bg-white/10" />
            <div className="flex items-center gap-2">
              <span className="text-2xl">💰</span>
              <div>
                <p className="text-white font-semibold">Best</p>
                <p className="text-text-secondary">Crypto Odds</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Sports Categories Grid */}
      <h2 className="text-2xl font-bold text-white mb-6">Popular Sports</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {sportsCategories.map((sport) => (
          <div
            key={sport.name}
            className={`relative overflow-hidden rounded-xl bg-gradient-to-br ${sport.color} border ${sport.borderColor} p-6 hover:scale-[1.02] transition-all cursor-pointer group`}
          >
            <div className="flex items-start justify-between mb-4">
              <div>
                <span className="text-3xl">{sport.icon}</span>
                <h3 className="text-xl font-bold text-white mt-2">{sport.name}</h3>
              </div>
              <div className="text-right">
                <span className="inline-flex items-center gap-1 px-2 py-1 bg-white/10 rounded-full text-xs text-text-secondary">
                  <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
                  {sport.matches} matches
                </span>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {sport.leagues.map((league) => (
                <span key={league} className="px-2 py-1 bg-white/5 rounded text-xs text-text-secondary">
                  {league}
                </span>
              ))}
            </div>
            {/* Coming Soon Overlay */}
            <div className="absolute inset-0 bg-bg-main/60 backdrop-blur-[1px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <div className="px-4 py-2 bg-accent-primary/20 border border-accent-primary/40 rounded-lg">
                <span className="text-accent-primary font-semibold">Coming Soon</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Notify Me Section */}
      <div className="rounded-xl bg-bg-card border border-white/10 p-8 text-center">
        <h3 className="text-xl font-bold text-white mb-2">Get Notified When We Launch</h3>
        <p className="text-text-secondary mb-6">Be the first to know when sports betting goes live.</p>
        <div className="flex items-center justify-center gap-3 max-w-md mx-auto">
          <input
            type="email"
            placeholder="Enter your email..."
            className="flex-1 bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-text-secondary focus:outline-none focus:border-accent-primary/50 transition-colors"
          />
          <button className="px-6 py-3 bg-accent-primary hover:bg-accent-primary/90 text-black font-semibold rounded-lg transition-colors whitespace-nowrap">
            Notify Me
          </button>
        </div>
      </div>

      {/* Back to Casino */}
      <div className="mt-8 text-center">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-accent-primary hover:text-accent-primary/80 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back to Casino
        </Link>
      </div>
    </div>
    </MainLayout>
  );
}
