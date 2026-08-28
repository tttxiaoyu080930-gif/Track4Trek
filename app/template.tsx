import { PageTransitionFrame } from "./_components/page-transition-frame";

export default function Template({ children }: Readonly<{ children: React.ReactNode }>) {
  return <PageTransitionFrame>{children}</PageTransitionFrame>;
}
