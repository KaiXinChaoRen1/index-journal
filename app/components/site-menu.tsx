"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

// 导航刻意保持稀疏。低频但重要的页面以后可以继续加在这里，
// 但首页不应该因为“预留”而变成一排空壳入口。
const MENU_ITEMS = [
  {
    href: "/",
    label: "首页",
    description: "查看两个核心市场的盘后表现。",
  },
  {
    href: "/log",
    label: "开发日志",
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
          <p className="menu-title">站点导航</p>
          <p className="menu-copy">低频但有价值的内容放在这里，首页继续保持清晰和克制。</p>
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
                  <span className="menu-link-kicker">{isActive ? "当前页" : "页面入口"}</span>
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
