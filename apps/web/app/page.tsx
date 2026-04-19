import { Navbar } from "@/components/Navbar";
import { HeroSection } from "@/components/HeroSection";
import { FeaturesSection } from "@/components/FeaturesSection";
import { QnaSection } from "@/components/QnaSection";
import { CallToActionSection } from "@/components/CallToActionSection";
import { Footer } from "@/components/Footer";
import { LenisScroll } from "@/components/lenis-scroll";

export default function Home() {
  return (
    <main className="relative">
      <LenisScroll>
        <Navbar />
        <HeroSection />
        <FeaturesSection />
        <QnaSection />
        <CallToActionSection />
        <Footer />
      </LenisScroll>
    </main>
  );
}
