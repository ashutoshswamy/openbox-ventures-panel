import { DemoShell } from "@/components/demo-shell";

export default function Layout({ children }: { children: React.ReactNode }) {
  return <DemoShell section="hr">{children}</DemoShell>;
}
