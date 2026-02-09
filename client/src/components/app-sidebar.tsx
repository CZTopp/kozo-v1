import { useLocation, Link } from "wouter";
import {
  LayoutDashboard,
  DollarSign,
  FileSpreadsheet,
  BarChart3,
  Wallet,
  Calculator,
  Scale,
  Briefcase,
  TrendingUp,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarHeader,
} from "@/components/ui/sidebar";

const modelingItems = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Revenue Forecast", url: "/revenue", icon: DollarSign },
  { title: "Income Statement", url: "/income-statement", icon: FileSpreadsheet },
  { title: "Balance Sheet", url: "/balance-sheet", icon: BarChart3 },
  { title: "Cash Flow", url: "/cash-flow", icon: Wallet },
  { title: "DCF Valuation", url: "/dcf", icon: Calculator },
  { title: "Valuation Compare", url: "/valuation", icon: Scale },
];

const portfolioItems = [
  { title: "Portfolio", url: "/portfolio", icon: Briefcase },
  { title: "Market Data", url: "/market-data", icon: TrendingUp },
];

export function AppSidebar() {
  const [location] = useLocation();

  return (
    <Sidebar>
      <SidebarHeader className="p-4">
        <Link href="/" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary">
            <TrendingUp className="h-4 w-4 text-primary-foreground" />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-semibold" data-testid="text-app-name">Foresight</span>
            <span className="text-xs text-muted-foreground">Financial Modeling</span>
          </div>
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Financial Model</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {modelingItems.map((item) => {
                const isActive = location === item.url || (item.url !== "/" && location.startsWith(item.url));
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild isActive={isActive}>
                      <Link href={item.url} data-testid={`link-nav-${item.title.toLowerCase().replace(/\s/g, "-")}`}>
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>Portfolio & Markets</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {portfolioItems.map((item) => {
                const isActive = location === item.url || (item.url !== "/" && location.startsWith(item.url));
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild isActive={isActive}>
                      <Link href={item.url} data-testid={`link-nav-${item.title.toLowerCase().replace(/\s/g, "-")}`}>
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
