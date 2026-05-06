import {
  Wallet,
  Smartphone,
  CreditCard,
  LayoutGrid,
  TrendingUp,
  BarChart2,
  Bitcoin,
  Gem,
  PiggyBank,
  Home,
  Car,
  Building2,
  Receipt,
  Landmark,
  Flag,
  Shield,
  HandCoins,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface CategoryNode {
  name: string;
  icon: LucideIcon;
  children?: CategoryNode[];
}

export interface TopCategory {
  name: string;
  color: string;
  textColor: string;
  isLiability: boolean;
  children: CategoryNode[];
}

export const CATEGORIES: TopCategory[] = [
  {
    name: "流動資金",
    color: "#FFFFFF",
    textColor: "#1c1c1e",
    isLiability: false,
    children: [
      { name: "現金", icon: Wallet },
      {
        name: "數位錢包",
        icon: Smartphone,
        children: [
          { name: "Line Pay", icon: Smartphone },
          { name: "Apple Pay", icon: Smartphone },
        ],
      },
      { name: "金融卡", icon: CreditCard },
      { name: "其他", icon: LayoutGrid },
    ],
  },
  {
    name: "負債",
    color: "#C7C7D4",
    textColor: "#1c1c1e",
    isLiability: true,
    children: [
      { name: "貸款", icon: Landmark },
      { name: "信用卡", icon: CreditCard },
      { name: "其他負債", icon: HandCoins },
    ],
  },
  {
    name: "投資",
    color: "#66788E",
    textColor: "#ffffff",
    isLiability: false,
    children: [
      { name: "投資基金", icon: TrendingUp },
      {
        name: "股票",
        icon: BarChart2,
        children: [
          { name: "台股", icon: Flag },
          { name: "美股", icon: Flag },
        ],
      },
      { name: "加密貨幣", icon: Bitcoin },
      { name: "貴金屬", icon: Gem },
      { name: "其他投資", icon: PiggyBank },
    ],
  },
  {
    name: "固定資產",
    color: "#374254",
    textColor: "#ffffff",
    isLiability: false,
    children: [
      { name: "房屋", icon: Home },
      { name: "車輛", icon: Car },
      { name: "其他資產", icon: Building2 },
      { name: "保險", icon: Shield },
    ],
  },

  {
    name: "應收款",
    color: "#0e1424",
    textColor: "#ffffff",
    isLiability: false,
    children: [{ name: "一般應收款", icon: Receipt }],
  },
];

/** Find a node anywhere in the tree by name */
function findNode(nodes: CategoryNode[], name: string): CategoryNode | null {
  for (const node of nodes) {
    if (node.name === name) return node;
    if (node.children) {
      const found = findNode(node.children, name);
      if (found) return found;
    }
  }
  return null;
}

export function getTopCategory(topName: string): TopCategory | undefined {
  return CATEGORIES.find((c) => c.name === topName);
}

export function getNodeIcon(topName: string, nodeName: string): LucideIcon {
  const top = getTopCategory(topName);
  if (!top) return Wallet;
  const node = findNode(top.children, nodeName);
  return node?.icon ?? top.children[0]?.icon ?? Wallet;
}
