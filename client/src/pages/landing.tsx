import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ThemeToggle } from "@/components/theme-toggle";
import heroImage from "@/assets/images/hero-fintech.png";
import {
  BarChart3,
  TrendingUp,
  LineChart,
  PieChart,
  Coins,
  ArrowRight,
  Zap,
  Target,
  Brain,
  ChevronRight,
  Activity,
  Lock,
  Globe,
} from "lucide-react";

const features = [
  {
    icon: BarChart3,
    title: "Financial Modeling",
    description:
      "Linked P&L, Balance Sheet, and Cash Flow projections with cascading recalculation across multiple years.",
    gradient: "from-blue-500/20 to-cyan-500/20",
    iconColor: "text-blue-400",
  },
  {
    icon: TrendingUp,
    title: "DCF & Valuation",
    description:
      "WACC-driven DCF, 5x5 sensitivity tables, and multi-method comparisons with bull/base/bear scenarios.",
    gradient: "from-violet-500/20 to-purple-500/20",
    iconColor: "text-violet-400",
  },
  {
    icon: LineChart,
    title: "Revenue Forecasting",
    description:
      "10-year mixed-period forecasting with growth decay, margin convergence, and scenario multipliers.",
    gradient: "from-emerald-500/20 to-teal-500/20",
    iconColor: "text-emerald-400",
  },
  {
    icon: PieChart,
    title: "Portfolio Tracker",
    description:
      "Live market data, MA50/MA200 indicators, golden cross detection, stop-loss alerts, and risk analysis.",
    gradient: "from-orange-500/20 to-amber-500/20",
    iconColor: "text-orange-400",
  },
  {
    icon: Coins,
    title: "Crypto Analysis",
    description:
      "Tokenomics modeling, DeFi protocol revenue from DefiLlama, and honest valuation for digital assets.",
    gradient: "from-pink-500/20 to-rose-500/20",
    iconColor: "text-pink-400",
  },
  {
    icon: Brain,
    title: "AI Copilot",
    description:
      "GPT-powered assistant that reads your models and delivers real-time analysis, insights, and recommendations.",
    gradient: "from-cyan-500/20 to-blue-500/20",
    iconColor: "text-cyan-400",
  },
];

const stats = [
  { value: "10+", label: "Analysis Modules", icon: Activity },
  { value: "15+", label: "Stocks Tracked", icon: TrendingUp },
  { value: "3", label: "Financial Statements", icon: BarChart3 },
  { value: "5x5", label: "Sensitivity Tables", icon: Target },
];

const trustPoints = [
  { icon: Lock, text: "Bank-grade encryption" },
  { icon: Zap, text: "Real-time data feeds" },
  { icon: Globe, text: "Global market coverage" },
];

export default function Landing() {
  return (
    <div className="min-h-screen bg-background" data-testid="landing-page">
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border/50 bg-background/60 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4 px-6 py-3">
          <div className="flex items-center gap-2.5">
            <div className="relative flex items-center justify-center h-8 w-8 rounded-md bg-gradient-to-br from-blue-500 to-violet-600">
              <Target className="h-4 w-4 text-white" />
            </div>
            <span className="text-lg font-semibold tracking-tight" data-testid="text-brand-name">Foresight</span>
          </div>
          <div className="hidden md:flex items-center gap-1">
            <Button variant="ghost" size="sm" asChild data-testid="link-features">
              <a href="#features">Features</a>
            </Button>
            <Button variant="ghost" size="sm" asChild data-testid="link-stats">
              <a href="#stats">Platform</a>
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button variant="outline" asChild data-testid="button-login-nav">
              <a href="/api/login">Log In</a>
            </Button>
            <Button asChild className="bg-gradient-to-r from-blue-600 to-violet-600 border-blue-500" data-testid="button-get-started-nav">
              <a href="/api/login">Get Started</a>
            </Button>
          </div>
        </div>
      </nav>

      <section className="relative pt-24 pb-0 overflow-hidden">
        <div className="absolute inset-0 z-0">
          <img
            src={heroImage}
            alt=""
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/80 via-black/60 to-background" />
          <div className="absolute inset-0 bg-gradient-to-r from-blue-600/10 via-transparent to-violet-600/10" />
        </div>

        <div className="relative z-10 max-w-7xl mx-auto px-6 pt-20 pb-28">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 mb-8 px-3 py-1.5 rounded-md bg-white/10 backdrop-blur-sm border border-white/10" data-testid="badge-hero-tag">
              <Zap className="h-3.5 w-3.5 text-blue-400" />
              <span className="text-xs font-medium text-blue-300 tracking-wide uppercase" data-testid="text-hero-tag">Next-Gen Financial Intelligence</span>
            </div>

            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white leading-[1.1] mb-6 tracking-tight" data-testid="text-hero-heading">
              The modern platform
              <br />
              for{" "}
              <span className="bg-gradient-to-r from-blue-400 via-cyan-400 to-violet-400 bg-clip-text text-transparent">
                financial modeling
              </span>
            </h1>

            <p className="text-lg text-white/60 max-w-xl mb-10 leading-relaxed" data-testid="text-hero-description">
              Build institutional-quality models, run DCF valuations,
              track portfolios, and analyze crypto — with an AI copilot
              that understands your data.
            </p>

            <div className="flex flex-wrap items-center gap-3 mb-10">
              <Button size="lg" asChild className="bg-gradient-to-r from-blue-600 to-violet-600 border-blue-500" data-testid="button-get-started-hero">
                <a href="/api/login">
                  Start for Free
                  <ArrowRight className="ml-2 h-4 w-4" />
                </a>
              </Button>
              <Button size="lg" variant="outline" className="bg-white/5 backdrop-blur-sm border-white/15 text-white" asChild data-testid="button-learn-more">
                <a href="#features">
                  See Features
                  <ChevronRight className="ml-1 h-4 w-4" />
                </a>
              </Button>
            </div>

            <div className="flex flex-wrap items-center gap-6 text-sm text-white/40">
              {trustPoints.map((tp, i) => (
                <div key={tp.text} className="flex items-center gap-1.5" data-testid={`text-trust-point-${i}`}>
                  <tp.icon className="h-3.5 w-3.5" />
                  <span>{tp.text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="stats" className="py-16 border-b border-border/50">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {stats.map((s, i) => (
              <div key={s.label} className="text-center" data-testid={`stat-item-${i}`}>
                <div className="inline-flex items-center justify-center h-10 w-10 rounded-md bg-gradient-to-br from-blue-500/10 to-violet-500/10 mb-3">
                  <s.icon className="h-5 w-5 text-blue-400 dark:text-blue-400" />
                </div>
                <div className="text-3xl font-bold bg-gradient-to-r from-blue-500 to-violet-500 bg-clip-text text-transparent mb-1" data-testid={`text-stat-value-${i}`}>
                  {s.value}
                </div>
                <div className="text-sm text-muted-foreground" data-testid={`text-stat-label-${i}`}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="features" className="py-20">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-14">
            <div className="inline-flex items-center gap-2 mb-4 px-3 py-1.5 rounded-md bg-blue-500/10 border border-blue-500/20">
              <Zap className="h-3.5 w-3.5 text-blue-500" />
              <span className="text-xs font-medium text-blue-500 tracking-wide uppercase">Platform</span>
            </div>
            <h2 className="text-3xl md:text-4xl font-bold mb-4 tracking-tight" data-testid="text-features-heading">
              Everything you need to
              <br />
              <span className="bg-gradient-to-r from-blue-500 to-violet-500 bg-clip-text text-transparent">
                model, value, and invest
              </span>
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto" data-testid="text-features-description">
              A comprehensive suite built for analysts and investors who
              demand precision and speed.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {features.map((f, i) => (
              <Card
                key={i}
                className="group relative p-6 hover-elevate transition-all duration-300 overflow-visible"
                data-testid={`card-feature-${i}`}
              >
                <div className={`absolute inset-0 rounded-md bg-gradient-to-br ${f.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-300`} />
                <div className="relative">
                  <div className={`inline-flex items-center justify-center h-10 w-10 rounded-md bg-gradient-to-br ${f.gradient} mb-4`}>
                    <f.icon className={`h-5 w-5 ${f.iconColor}`} />
                  </div>
                  <h3 className="font-semibold text-lg mb-2" data-testid={`text-feature-title-${i}`}>{f.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {f.description}
                  </p>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20">
        <div className="max-w-7xl mx-auto px-6">
          <Card className="relative overflow-visible p-0">
            <div className="absolute inset-0 rounded-md bg-gradient-to-r from-blue-600/5 via-violet-600/5 to-cyan-600/5" />
            <div className="relative px-8 py-14 md:px-14 text-center">
              <h2 className="text-3xl md:text-4xl font-bold mb-4 tracking-tight" data-testid="text-cta-heading">
                Ready to upgrade your analysis?
              </h2>
              <p className="text-muted-foreground mb-8 max-w-lg mx-auto" data-testid="text-cta-description">
                Join analysts and investors using Foresight to build better
                models, faster. Free to start, no credit card needed.
              </p>
              <div className="flex flex-wrap justify-center gap-3">
                <Button size="lg" asChild className="bg-gradient-to-r from-blue-600 to-violet-600 border-blue-500" data-testid="button-get-started-cta">
                  <a href="/api/login">
                    Get Started Free
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </a>
                </Button>
              </div>
            </div>
          </Card>
        </div>
      </section>

      <footer className="border-t border-border/50 py-8">
        <div className="max-w-7xl mx-auto px-6 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="relative flex items-center justify-center h-6 w-6 rounded-md bg-gradient-to-br from-blue-500 to-violet-600">
              <Target className="h-3 w-3 text-white" />
            </div>
            <span className="text-sm text-muted-foreground font-medium" data-testid="text-footer-brand">Foresight</span>
          </div>
          <p className="text-xs text-muted-foreground" data-testid="text-footer-copyright">
            &copy; {new Date().getFullYear()} Foresight. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
