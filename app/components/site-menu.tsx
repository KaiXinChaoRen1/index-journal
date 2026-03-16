"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

// 导航刻意保持稀疏。低频但重要的页面以后可以继续加在这里，
// 但首页不应该因为"预留"而变成一排空壳入口。
// 彩蛋永远放在最后一个。
const MENU_ITEMS = [
  {
    href: "/",
    label: "首页",
    description: "查看两个核心市场的盘后表现。",
  },
  {
    href: "/forex",
    label: "汇率观察",
    description: "补充观察美元相关汇率与区间变化。",
  },
  {
    href: "/btc",
    label: "BTC 观察",
    description: "补充观察 BTC/USD 的位置与区间变化。",
  },
  {
    href: "/cn-funds",
    label: "场内基金（证券账户）",
    description: "查看固定基金列表的最近季度报告抓取结果。",
  },
  {
    href: "/otc-funds",
    label: "场外基金（支付宝等）",
    description: "查看场外基金季报中的多份额净值表现表格。",
  },
  {
    href: "/log",
    label: "彩蛋",
    description: "查看产品迭代脉络与设计决策。",
  },
] as const;

export function SiteMenu() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  return (
    <div className="site-menu" ref={rootRef}>
      <button
        type="button"
        className={isOpen ? "menu-trigger active" : "menu-trigger"}
        aria-label="打开页面菜单"
        aria-expanded={isOpen}
        aria-haspopup="menu"
        onClick={() => setIsOpen((current) => !current)}
      >
        <span className="menu-trigger-icon" aria-hidden="true">
          <span />
          <span />
          <span />
        </span>
        <span className="menu-trigger-label">导航</span>
      </button>

      {isOpen ? (
        <nav className="menu-popover" aria-label="页面导航">
          <div className="menu-list">
            {MENU_ITEMS.map((item) => {
              const isActive = pathname === item.href;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={isActive ? "menu-link active" : "menu-link"}
                  onClick={() => setIsOpen(false)}
                >
                  {isActive ? <span className="menu-link-kicker">当前页</span> : null}
                  <strong>{item.label}</strong>
                  <span>{item.description}</span>
                </Link>
              );
            })}
          </div>
        </nav>
      ) : null}
    </div>
  );
}
