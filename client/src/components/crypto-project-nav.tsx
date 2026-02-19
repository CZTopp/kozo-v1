import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { ArrowLeft, Coins, BarChart3, Target, TrendingUp, GitBranch } from "lucide-react";

const NAV_ITEMS = [
  { label: "Tokenomics", path: "tokenomics", icon: Coins },
  { label: "Financials", path: "financials", icon: BarChart3 },
  { label: "Valuation", path: "valuation", icon: Target },
  { label: "Revenue", path: "revenue", icon: TrendingUp },
  { label: "Token Flows", path: "token-flows", icon: GitBranch },
];

interface CryptoProjectNavProps {
  projectId: string;
  projectName?: string;
  projectImage?: string | null;
  projectSymbol?: string;
}

export function CryptoProjectNav({ projectId, projectName, projectImage, projectSymbol }: CryptoProjectNavProps) {
  const [location] = useLocation();

  return (
    <div className="flex items-center gap-2 flex-wrap" data-testid="crypto-project-nav">
      <Link href="/crypto">
        <Button variant="ghost" size="icon" data-testid="button-back-dashboard">
          <ArrowLeft className="h-4 w-4" />
        </Button>
      </Link>
      <Avatar className="h-6 w-6" data-testid="img-project-nav">
        {projectImage && <AvatarImage src={projectImage} alt={projectName || ""} />}
        <AvatarFallback className="text-[10px]">
          {(projectSymbol || projectName || "?").slice(0, 2).toUpperCase()}
        </AvatarFallback>
      </Avatar>
      {projectName && (
        <span className="text-sm font-medium text-muted-foreground mr-1" data-testid="text-project-nav-name">
          {projectName}{projectSymbol ? ` (${projectSymbol.toUpperCase()})` : ""}
        </span>
      )}
      <div className="flex items-center gap-1 flex-wrap">
        {NAV_ITEMS.map((item) => {
          const href = `/crypto/${item.path}/${projectId}`;
          const isActive = location.startsWith(href);
          return (
            <Link key={item.path} href={href}>
              <Button
                variant={isActive ? "secondary" : "ghost"}
                size="sm"
                className={isActive ? "toggle-elevate toggle-elevated" : ""}
                data-testid={`nav-crypto-${item.path}`}
              >
                <item.icon className="h-3.5 w-3.5 mr-1.5" />
                {item.label}
              </Button>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
