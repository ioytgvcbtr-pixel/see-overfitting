import type { Metadata } from "next";
import "./globals.css";
import "./datasets.css";

export const metadata: Metadata = {
  title: "看见过拟合 · FitLab 交互实验室",
  description: "用一次可复现的交互实验，理解机器学习如何学会规律。",
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
