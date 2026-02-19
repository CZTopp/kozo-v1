import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ThemeToggle } from "@/components/theme-toggle";
import heroImage from "@/assets/images/hero-finance.png";
import {
  BarChart3,
  TrendingUp,
  Shield,
  LineChart,
  PieChart,
  Coins,
  ArrowRight,
  Sparkles,
  Target,
  Brain,
} from "lucide-react";

const features = [
  {
    icon: BarChart3,
    title: "Financial Modeling",
    description:
      "Build complete financial models with linked Income Statement, Balance Sheet, and Cash Flow projections across multiple years.",
  },
  {
    icon: TrendingUp,
    title: "DCF & Valuation",
    description:
      "Run discounted cash flow analysis with WACC calculations, sensitivity tables, and multi-method valuation comparisons.",
  },
  {
    icon: LineChart,
    title: "Revenue Forecasting",
    description:
      "10-year mixed-period forecasting with growth decay, target margin convergence, and bull/base/bear scenario modeling.",
  },
  {
    icon: PieChart,
    title: "Portfolio Management",
    description:
      "Track your portfolio with live market data, technical indicators, risk analysis, and red flag detection.",
  },
  {
    icon: Coins,
    title: "Crypto Analysis",
    description:
      "Tokenomics modeling, DeFi protocol financials from DefiLlama, and honest valuation frameworks for digital assets.",
  },
  {
    icon: Brain,
    title: "AI Copilot",
    description:
      "GPT-powered financial assistant that understands your models and provides real-time analysis and insights.",
  },
];

const metrics = [
  { value: "10+", label: "Analysis Modules" },
  { value: "15+", label: "Stock Tracking" },
  { value: "3", label: "Financial Statements" },
  { value: "5x5", label: "Sensitivity Tables" },
];

export default function Landing() {
  return (
    <div className="min-h-screen bg-background" data-testid="landing-page">
      <nav className="fixed top-0 left-0 right-0 z-50 border-b bg-background/80 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4 px-6 py-3">
          <div className="flex items-center gap-2">
            <Target className="h-6 w-6 text-primary" />
            <span className="font-serif text-xl font-bold tracking-tight">Foresight</span>
          </div>
          <div className="hidden md:flex items-center gap-6">
            <a href="#features" className="text-sm text-muted-foreground hover-elevate px-2 py-1 rounded-md" data-testid="link-features">
              Features
            </a>
            <a href="#metrics" className="text-sm text-muted-foreground hover-elevate px-2 py-1 rounded-md" data-testid="link-metrics">
              Why Foresight
            </a>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button variant="outline" asChild data-testid="button-login-nav">
              <a href="/api/login">Log In</a>
            </Button>
            <Button asChild data-testid="button-get-started-nav">
              <a href="/api/login">Get Started</a>
            </Button>
          </div>
        </div>
      </nav>

      <section className="relative pt-24 pb-16 overflow-hidden">
        <div className="absolute inset-0 z-0">
          <img
            src={heroImage}
            alt=""
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/60 to-background" />
        </div>

        <div className="relative z-10 max-w-7xl mx-auto px-6 pt-16 pb-20">
          <div className="max-w-3xl">
            <div className="flex items-center gap-2 mb-6">
              <Sparkles className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium text-primary">Wall Street-Grade Analytics</span>
            </div>
            <h1 className="font-serif text-4xl md:text-5xl lg:text-6xl font-bold text-white leading-tight mb-6">
              Financial Modeling
              <br />
              <span className="text-primary">Made Powerful</span>
            </h1>
            <p className="text-lg text-white/70 max-w-xl mb-8 leading-relaxed">
              Build institutional-quality financial models, run DCF valuations,
              manage portfolios, and analyze crypto protocols — all in one platform
              with an AI copilot at your side.
            </p>
            <div className="flex flex-wrap items-center gap-3 mb-8">
              <Button size="lg" asChild data-testid="button-get-started-hero">
                <a href="/api/login">
                  Get Started Free
                  <ArrowRight className="ml-2 h-4 w-4" />
                </a>
              </Button>
              <Button size="lg" variant="outline" className="bg-white/5 backdrop-blur-sm border-white/20 text-white" asChild data-testid="button-learn-more">
                <a href="#features">Learn More</a>
              </Button>
            </div>
            <div className="flex flex-wrap items-center gap-4 text-sm text-white/50">
              <div className="flex items-center gap-1">
                <Shield className="h-3 w-3" />
                <span>Free to start</span>
              </div>
              <div className="flex items-center gap-1">
                <Shield className="h-3 w-3" />
                <span>No credit card required</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="metrics" className="py-16 border-b">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {metrics.map((m) => (
              <div key={m.label} className="text-center">
                <div className="text-3xl font-bold font-serif text-primary mb-1">{m.value}</div>
                <div className="text-sm text-muted-foreground">{m.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="features" className="py-20">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-14">
            <h2 className="font-serif text-3xl md:text-4xl font-bold mb-4">
              Everything You Need to Model,
              <br />
              Value, and Invest
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              A comprehensive suite of tools designed for analysts, investors, and
              finance professionals who demand precision.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {features.map((f, i) => (
              <Card key={i} className="p-6 hover-elevate transition-all duration-200">
                <f.icon className="h-8 w-8 text-primary mb-4" />
                <h3 className="font-semibold text-lg mb-2">{f.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {f.description}
                </p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 border-t">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <h2 className="font-serif text-3xl md:text-4xl font-bold mb-4">
            Ready to level up your analysis?
          </h2>
          <p className="text-muted-foreground mb-8">
            Join analysts and investors using Foresight for Wall Street-grade
            financial modeling and valuation.
          </p>
          <Button size="lg" asChild data-testid="button-get-started-cta">
            <a href="/api/login">
              Start Building Models
              <ArrowRight className="ml-2 h-4 w-4" />
            </a>
          </Button>
        </div>
      </section>

      <footer className="border-t py-8">
        <div className="max-w-7xl mx-auto px-6 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Target className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Foresight</span>
          </div>
          <p className="text-xs text-muted-foreground">
            &copy; {new Date().getFullYear()} Foresight. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
