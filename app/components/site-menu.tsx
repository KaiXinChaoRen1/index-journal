"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

const PRIMARY_ITEMS = [
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
] as const;

// 低频但保留价值的页面继续放在次级菜单里，避免首页和顶栏被工具入口填满。
const SECONDARY_ITEMS = [
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
    <div className="site-nav" ref={rootRef}>
      <Link href="/" className={pathname === "/" ? "site-brand active" : "site-brand"}>
        <span className="site-brand-kicker">Index Journal</span>
        <strong>指数日志</strong>
      </Link>

      <nav className="site-primary-nav" aria-label="主要页面">
        {PRIMARY_ITEMS.map((item) => {
          const isActive = pathname === item.href;

          return (
            <Link key={item.href} href={item.href} className={isActive ? "site-primary-link active" : "site-primary-link"}>
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="site-menu">
        <button
          type="button"
          className={isOpen ? "menu-trigger active" : "menu-trigger"}
          aria-label="打开更多页面菜单"
          aria-expanded={isOpen}
          aria-haspopup="menu"
          onClick={() => setIsOpen((current) => !current)}
        >
          <span className="menu-trigger-icon" aria-hidden="true">
            <span />
            <span />
            <span />
          </span>
          <span className="menu-trigger-label">更多</span>
        </button>

        {isOpen ? (
          <nav className="menu-popover" aria-label="更多页面">
            <div className="menu-list">
              {[...PRIMARY_ITEMS, ...SECONDARY_ITEMS].map((item) => {
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
    </div>
  );
}
